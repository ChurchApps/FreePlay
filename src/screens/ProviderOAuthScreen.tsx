import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableHighlight,
  BackHandler,
  ActivityIndicator,
  Animated,
  Easing
} from "react-native";
import { useTranslation } from "react-i18next";
import { Styles, CachedData, ProviderAuthHelper, Colors, Typography } from "../helpers";
import { SoundHelper } from "../helpers/SoundHelper";
import { ApiHelper } from "../helpers/ApiHelper";
import { ContentProviderAuthData, DropboxProvider } from "../interfaces";
import { DimensionHelper } from "../helpers/DimensionHelper";
import LinearGradient from "react-native-linear-gradient";
import { getProvider } from "../providers";
import QRCode from "react-native-qrcode-svg";
import * as Crypto from "expo-crypto";

type Props = {
  navigateTo(page: string, data?: any): void;
  sidebarState(state: boolean): void;
  sidebarExpanded?: boolean;
  providerId: string;
};

type FlowState =
  | { status: "loading" }
  | { status: "awaiting_user"; authUrl: string; expiresIn: number }
  | { status: "exchanging" }
  | { status: "success" }
  | { status: "error"; error: string }
  | { status: "expired" };

export const ProviderOAuthScreen = (props: Props) => {
  const { t } = useTranslation();
  const [flowState, setFlowState] = useState<FlowState>({ status: "loading" });
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollGenerationRef = useRef<number>(0);
  const codeVerifierRef = useRef<string>("");
  const redirectUriRef = useRef<string>("");

  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const provider = getProvider(props.providerId);
  const providerConfig = provider?.config;

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    ).start();
  };

  const fadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  };

  const generateCodeVerifier = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const randomBytes = Crypto.getRandomBytes(64);
    let result = "";
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(randomBytes[i] % chars.length);
    }
    return result;
  };

  const generateCodeChallenge = async (verifier: string): Promise<string> => {
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
    // Convert standard base64 to base64url
    return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const initOAuthFlow = async () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    pollGenerationRef.current += 1;
    const currentGeneration = pollGenerationRef.current;

    setFlowState({ status: "loading" });

    try {
      if (!provider) {
        setFlowState({ status: "error", error: t("providerOAuth.providerNotFound") });
        return;
      }

      const relayData = await ApiHelper.post("/oauth/relay/sessions", { provider: props.providerId }, "MembershipApi");
      if (!relayData?.sessionCode || !relayData?.redirectUri) {
        setFlowState({ status: "error", error: t("providerOAuth.sessionFailed") });
        return;
      }

      const { sessionCode, redirectUri, expiresIn } = relayData;
      redirectUriRef.current = redirectUri;

      const codeVerifier = generateCodeVerifier();
      codeVerifierRef.current = codeVerifier;

      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const dropboxProvider = provider as DropboxProvider;
      const authUrl = dropboxProvider.buildAuthUrlFromChallenge(codeChallenge, redirectUri, sessionCode);

      setFlowState({ status: "awaiting_user", authUrl, expiresIn });
      fadeIn();
      startPulseAnimation();

      startPolling(sessionCode, expiresIn, currentGeneration);
    } catch (error) {
      console.error("OAuth flow init error:", error);
      setFlowState({ status: "error", error: t("providerOAuth.unexpectedError") });
    }
  };

  const startPolling = (sessionCode: string, expiresIn: number, generation: number) => {
    const expiresAt = Date.now() + expiresIn * 1000;

    const poll = async () => {
      if (generation !== pollGenerationRef.current) return;

      if (Date.now() >= expiresAt) {
        setFlowState({ status: "expired", error: t("providerOAuth.sessionExpired") } as any);
        return;
      }

      try {
        const result = await ApiHelper.getAnonymous(`/oauth/relay/sessions/${sessionCode}`, "MembershipApi");

        if (generation !== pollGenerationRef.current) return;

        if (result?.status === "completed" && result?.authCode) {
          setFlowState({ status: "exchanging" });
          await exchangeCodeForTokens(result.authCode);
          return;
        }

        pollTimeoutRef.current = setTimeout(poll, 5000);
      } catch (error) {
        console.error("Polling error:", error);
        if (generation === pollGenerationRef.current) {
          pollTimeoutRef.current = setTimeout(poll, 5000);
        }
      }
    };

    pollTimeoutRef.current = setTimeout(poll, 5000);
  };

  const exchangeCodeForTokens = async (authCode: string) => {
    try {
      const dropboxProvider = provider as DropboxProvider;
      const authData: ContentProviderAuthData | null = await dropboxProvider.exchangeCodeForTokens(
        authCode,
        codeVerifierRef.current,
        redirectUriRef.current
      );

      if (!authData) {
        setFlowState({ status: "error", error: t("providerOAuth.exchangeFailed") });
        return;
      }

      await ProviderAuthHelper.setAuth(props.providerId, authData);
      await ProviderAuthHelper.setConnectionState(props.providerId, true);
      setFlowState({ status: "success" });
      SoundHelper.playChime();

      if (!CachedData.connectedProviders.includes(props.providerId)) {
        CachedData.connectedProviders.push(props.providerId);
      }
      CachedData.activeProvider = props.providerId;

      setTimeout(() => {
        props.navigateTo("contentBrowser", { providerId: props.providerId, folderStack: [] });
      }, 2000);
    } catch (error) {
      console.error("Token exchange error:", error);
      setFlowState({ status: "error", error: t("providerOAuth.tokenExchangeFailed") });
    }
  };

  const handleBack = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }
    props.sidebarState(true);
  };

  useEffect(() => {
    initOAuthFlow();

    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });

    return () => {
      backHandler.remove();
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  if (flowState.status === "loading" || flowState.status === "exchanging") {
    const message = flowState.status === "exchanging" ? t("providerOAuth.connecting") : t("providerOAuth.initializing");
    return (
      <View style={Styles.menuScreen}>
        <LinearGradient
          colors={["#1a0f17", "#160a14", "#100714"]}
          style={{
            flex: 1,
            width: "100%",
            alignItems: "center",
            justifyContent: "center"
          }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: DimensionHelper.wp("1.8%"),
              marginTop: DimensionHelper.hp("3%"),
              letterSpacing: 1
            }}>
            {message}
          </Text>
        </LinearGradient>
      </View>
    );
  }

  if (flowState.status === "error" || flowState.status === "expired") {
    return (
      <View style={Styles.menuScreen}>
        <LinearGradient
          colors={["#1a0f17", "#160a14", "#100714"]}
          style={{
            flex: 1,
            width: "100%",
            alignItems: "center",
            justifyContent: "center"
          }}>
          <Text
            style={{
              color: Colors.error,
              fontSize: DimensionHelper.wp("2%"),
              marginBottom: DimensionHelper.hp("4%"),
              textAlign: "center",
              paddingHorizontal: DimensionHelper.wp("10%")
            }}>
            {flowState.error}
          </Text>
          <TouchableHighlight
            onPress={initOAuthFlow}
            underlayColor={Colors.pressedBackground}
            hasTVPreferredFocus={true}
            style={{
              backgroundColor: Colors.primary,
              paddingVertical: DimensionHelper.hp("2%"),
              paddingHorizontal: DimensionHelper.wp("5%"),
              borderRadius: 8
            }}>
            <Text
              style={{
                color: Colors.textPrimary,
                fontSize: DimensionHelper.wp("2%"),
                fontWeight: "600"
              }}>
              {t("providerOAuth.tryAgain")}
            </Text>
          </TouchableHighlight>
        </LinearGradient>
      </View>
    );
  }

  if (flowState.status === "success") {
    return (
      <View style={Styles.menuScreen}>
        <LinearGradient
          colors={["#1a0f17", "#160a14", "#100714"]}
          style={{
            flex: 1,
            width: "100%",
            alignItems: "center",
            justifyContent: "center"
          }}>
          <Text
            style={{
              color: Colors.success,
              fontSize: DimensionHelper.wp("3%"),
              fontWeight: "bold"
            }}>
            {t("providerOAuth.connected")}
          </Text>
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: DimensionHelper.wp("1.6%"),
              marginTop: DimensionHelper.hp("2%")
            }}>
            {t("providerOAuth.loadingContent")}
          </Text>
        </LinearGradient>
      </View>
    );
  }

  const { authUrl } = flowState;

  return (
    <View style={Styles.menuScreen}>
      <LinearGradient
        colors={["#1a0f17", "#160a14", "#0d0510"]}
        style={{ flex: 1, width: "100%" }}>
        <Animated.View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            opacity: fadeAnim,
            paddingBottom: DimensionHelper.hp("5%")
          }}>
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: DimensionHelper.wp("2.5%"),
              fontWeight: "600",
              marginBottom: DimensionHelper.hp("2%")
            }}>
            {t("providerOAuth.connectTo", { name: providerConfig?.name || t("providerOAuth.fallbackProvider") })}
          </Text>

          <Text
            style={{
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: DimensionHelper.wp("1.4%"),
              letterSpacing: 0.5,
              marginBottom: DimensionHelper.hp("3%"),
              textAlign: "center",
              paddingHorizontal: DimensionHelper.wp("10%")
            }}>
            {t("providerOAuth.instructionsLine1")}{"\n"}
            {t("providerOAuth.instructionsLine2")}
          </Text>

          <View
            style={{
              backgroundColor: "#ffffff",
              padding: DimensionHelper.wp("1%"),
              borderRadius: 12,
              marginBottom: DimensionHelper.hp("3%")
            }}>
            <QRCode
              value={authUrl}
              size={DimensionHelper.wp("12%")}
              backgroundColor="#ffffff"
              color="#000000"
            />
          </View>

          <Animated.View
            style={{
              marginTop: DimensionHelper.hp("3%"),
              flexDirection: "row",
              alignItems: "center",
              opacity: pulseAnim
            }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: Colors.primary,
                marginRight: DimensionHelper.wp("1%")
              }}
            />
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.4)",
                fontSize: Typography.labelMedium,
                letterSpacing: 0.5
              }}>
              {t("providerOAuth.waiting")}
            </Text>
          </Animated.View>

          <Text
            style={{
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: Typography.labelMedium,
              marginTop: DimensionHelper.hp("1.5%"),
              letterSpacing: 0.3
            }}>
            {t("providerOAuth.secondary")}
          </Text>

          <Text
            style={{
              color: "rgba(255, 255, 255, 0.3)",
              fontSize: Typography.labelSmall,
              marginTop: DimensionHelper.hp("2%")
            }}>
            {t("providerOAuth.expiresIn", { minutes: Math.floor(flowState.expiresIn / 60) })}
          </Text>
        </Animated.View>

        <View
          style={{
            position: "absolute",
            bottom: DimensionHelper.hp("4%"),
            left: 0,
            right: 0,
            alignItems: "center"
          }}>
          <TouchableHighlight
            onPress={handleBack}
            underlayColor="rgba(255, 255, 255, 0.1)"
            hasTVPreferredFocus={false}
            style={{
              paddingVertical: DimensionHelper.hp("1%"),
              paddingHorizontal: DimensionHelper.wp("2%"),
              borderRadius: 4
            }}>
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.35)",
                fontSize: DimensionHelper.wp("1.2%"),
                letterSpacing: 0.3
              }}>
              {t("providerOAuth.cancel")}
            </Text>
          </TouchableHighlight>
        </View>
      </LinearGradient>
    </View>
  );
};
