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
import { createRelaySession, exchangeRelaySession, interpretExchangeBody, oauthRelayErrorKey, readOAuthRelayError, usesServerTokenExchange } from "../helpers/OAuthRelay";
import { ContentProviderAuthData } from "../interfaces";
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
  | { status: "expired"; error: string };

type PendingSession = { sessionCode: string; redirectUri: string; codeVerifier: string; authUrl: string; expiresAt: number; serverExchange: boolean; interval: number };
const pendingSessions: Record<string, PendingSession> = {};

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
      if (!provider?.buildAuthUrlFromChallenge || !provider.exchangeCodeForTokens) {
        setFlowState({ status: "error", error: t("providerOAuth.providerNotFound") });
        return;
      }

      const serverExchange = usesServerTokenExchange(props.providerId);
      let pending = pendingSessions[props.providerId];
      if (!pending || pending.expiresAt - Date.now() < 60000 || pending.serverExchange !== serverExchange) {
        let codeVerifier = "";
        let codeChallenge = "";
        if (serverExchange) {
          codeVerifier = generateCodeVerifier();
          codeChallenge = await generateCodeChallenge(codeVerifier);
        }
        const relayData = await createRelaySession(props.providerId, serverExchange ? codeChallenge : undefined);
        if (!relayData?.sessionCode || !relayData?.redirectUri) {
          setFlowState({ status: "error", error: t("providerOAuth.sessionFailed") });
          return;
        }
        if (!serverExchange) {
          codeVerifier = generateCodeVerifier();
          codeChallenge = await generateCodeChallenge(codeVerifier);
        }
        const authUrl = provider.buildAuthUrlFromChallenge(codeChallenge, relayData.redirectUri, relayData.sessionCode);
        pending = {
          sessionCode: relayData.sessionCode,
          redirectUri: relayData.redirectUri,
          codeVerifier,
          authUrl,
          expiresAt: Date.now() + relayData.expiresIn * 1000,
          serverExchange,
          interval: relayData.interval || 5
        };
        pendingSessions[props.providerId] = pending;
      }

      const { sessionCode, redirectUri, codeVerifier, authUrl } = pending;
      const expiresIn = Math.floor((pending.expiresAt - Date.now()) / 1000);
      redirectUriRef.current = redirectUri;
      codeVerifierRef.current = codeVerifier;

      setFlowState({ status: "awaiting_user", authUrl, expiresIn });
      fadeIn();
      startPulseAnimation();

      // GET /sessions/:code returns the auth code and deletes the session, so confidential providers poll the exchange instead.
      if (pending.serverExchange) startExchangePolling(sessionCode, codeVerifier, expiresIn, pending.interval || 5, currentGeneration);
      else startPolling(sessionCode, expiresIn, currentGeneration);
    } catch (error) {
      console.error("OAuth flow init error:", error);
      setFlowState({ status: "error", error: t(oauthRelayErrorKey(error) || "providerOAuth.unexpectedError") });
    }
  };

  const finishAuth = async (authData: ContentProviderAuthData | null) => {
    if (!authData?.access_token) {
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
  };

  const startExchangePolling = (sessionCode: string, codeVerifier: string, expiresIn: number, intervalSec: number, generation: number) => {
    let expiresAt = Date.now() + expiresIn * 1000;
    const delayMs = Math.max(1, intervalSec || 5) * 1000;

    const poll = async () => {
      if (generation !== pollGenerationRef.current) return;

      if (Date.now() >= expiresAt) {
        delete pendingSessions[props.providerId];
        setFlowState({ status: "expired", error: t("providerOAuth.sessionExpired") });
        return;
      }

      try {
        const result = await exchangeRelaySession(sessionCode, codeVerifier);
        if (generation !== pollGenerationRef.current) return;

        const outcome = interpretExchangeBody(result);
        if (outcome.kind === "pending") {
          if (typeof outcome.expiresIn === "number" && outcome.expiresIn <= 0) {
            delete pendingSessions[props.providerId];
            setFlowState({ status: "expired", error: t("providerOAuth.sessionExpired") });
            return;
          }
          if (typeof outcome.expiresIn === "number") expiresAt = Date.now() + outcome.expiresIn * 1000;
          pollTimeoutRef.current = setTimeout(poll, delayMs);
          return;
        }

        delete pendingSessions[props.providerId];
        if (outcome.kind === "invalid") {
          setFlowState({ status: "error", error: t("providerOAuth.exchangeFailed") });
          return;
        }
        setFlowState({ status: "exchanging" });
        await finishAuth(outcome.auth);
      } catch (error) {
        if (generation !== pollGenerationRef.current) return;
        const relayError = readOAuthRelayError(error);
        if (relayError.error || relayError.status) {
          delete pendingSessions[props.providerId];
          const expired = relayError.error === "not_found" || relayError.status === 404;
          setFlowState({ status: expired ? "expired" : "error", error: t(oauthRelayErrorKey(error) || "providerOAuth.tokenExchangeFailed") });
          return;
        }
        console.error("Polling error:", error);
        pollTimeoutRef.current = setTimeout(poll, delayMs);
      }
    };

    pollTimeoutRef.current = setTimeout(poll, delayMs);
  };

  const startPolling = (sessionCode: string, expiresIn: number, generation: number) => {
    const expiresAt = Date.now() + expiresIn * 1000;

    const poll = async () => {
      if (generation !== pollGenerationRef.current) return;

      if (Date.now() >= expiresAt) {
        delete pendingSessions[props.providerId];
        setFlowState({ status: "expired", error: t("providerOAuth.sessionExpired") });
        return;
      }

      try {
        const result = await ApiHelper.getAnonymous(`/oauth/relay/sessions/${sessionCode}`, "RelayApi");

        if (generation !== pollGenerationRef.current) return;

        if (result?.status === "completed" && result?.authCode) {
          delete pendingSessions[props.providerId];
          setFlowState({ status: "exchanging" });
          await exchangeCodeForTokens(result.authCode);
          return;
        }

        pollTimeoutRef.current = setTimeout(poll, 5000);
      } catch (error) {
        if (generation !== pollGenerationRef.current) return;
        if (String((error as Error)?.message).includes("not_found")) {
          // Session died server-side; a fresh QR beats dead-polling for 15 minutes.
          delete pendingSessions[props.providerId];
          initOAuthFlow();
          return;
        }
        console.error("Polling error:", error);
        pollTimeoutRef.current = setTimeout(poll, 5000);
      }
    };

    pollTimeoutRef.current = setTimeout(poll, 5000);
  };

  const exchangeCodeForTokens = async (authCode: string) => {
    try {
      if (!provider?.exchangeCodeForTokens) {
        setFlowState({ status: "error", error: t("providerOAuth.providerNotFound") });
        return;
      }
      const authData: ContentProviderAuthData | null = await provider.exchangeCodeForTokens(
        authCode,
        codeVerifierRef.current,
        redirectUriRef.current
      );
      await finishAuth(authData);
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
          <TouchableHighlight
            onPress={handleBack}
            underlayColor="rgba(255, 255, 255, 0.1)"
            hasTVPreferredFocus={false}
            style={{
              marginTop: DimensionHelper.hp("3%"),
              paddingVertical: DimensionHelper.hp("1.2%"),
              paddingHorizontal: DimensionHelper.wp("2.5%"),
              borderRadius: 6,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.15)"
            }}>
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.5)",
                fontSize: Typography.labelMedium,
                letterSpacing: 0.3
              }}>
              {t("providerOAuth.cancel")}
            </Text>
          </TouchableHighlight>
        </Animated.View>
      </LinearGradient>
    </View>
  );
};
