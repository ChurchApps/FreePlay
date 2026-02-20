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
import { Styles, CachedData, ProviderAuthHelper, Colors } from "../helpers";
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

  // Generate PKCE code verifier using expo-crypto (React Native compatible)
  const generateCodeVerifier = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const randomBytes = Crypto.getRandomBytes(64);
    let result = "";
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(randomBytes[i] % chars.length);
    }
    return result;
  };

  // Generate S256 code challenge using expo-crypto (React Native compatible)
  const generateCodeChallenge = async (verifier: string): Promise<string> => {
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
    // Convert standard base64 to base64url
    return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  // Build the Dropbox auth URL with PKCE (avoids browser-only crypto in OAuthHelper)
  const buildDropboxAuthUrl = async (codeVerifier: string, redirectUri: string, state: string): Promise<string> => {
    const config = provider!.config;
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      token_access_type: "offline",
      state
    });
    return `${config.oauthBase}/authorize?${params.toString()}`;
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
        setFlowState({ status: "error", error: "Provider not found." });
        return;
      }

      // Step 1: Create a relay session on the API
      const relayData = await ApiHelper.post("/oauth/relay/sessions", { provider: props.providerId }, "MembershipApi");
      if (!relayData?.sessionCode || !relayData?.redirectUri) {
        setFlowState({ status: "error", error: "Failed to create authorization session. Please try again." });
        return;
      }

      const { sessionCode, redirectUri, expiresIn } = relayData;
      redirectUriRef.current = redirectUri;

      // Step 2: Generate PKCE code verifier and build auth URL using expo-crypto
      const codeVerifier = generateCodeVerifier();
      codeVerifierRef.current = codeVerifier;

      const authUrl = await buildDropboxAuthUrl(codeVerifier, redirectUri, sessionCode);

      setFlowState({ status: "awaiting_user", authUrl, expiresIn });
      fadeIn();
      startPulseAnimation();

      // Step 3: Start polling the relay for the auth code
      startPolling(sessionCode, expiresIn, currentGeneration);
    } catch (error) {
      console.error("OAuth flow init error:", error);
      setFlowState({ status: "error", error: "An unexpected error occurred. Please try again." });
    }
  };

  const startPolling = (sessionCode: string, expiresIn: number, generation: number) => {
    const expiresAt = Date.now() + expiresIn * 1000;

    const poll = async () => {
      if (generation !== pollGenerationRef.current) return;

      if (Date.now() >= expiresAt) {
        setFlowState({ status: "expired", error: "Authorization session expired. Please try again." } as any);
        return;
      }

      try {
        const result = await ApiHelper.getAnonymous(`/oauth/relay/sessions/${sessionCode}`, "MembershipApi");

        if (generation !== pollGenerationRef.current) return;

        if (result?.status === "completed" && result?.authCode) {
          // Got the auth code from the relay — exchange for tokens
          setFlowState({ status: "exchanging" });
          await exchangeCodeForTokens(result.authCode);
          return;
        }

        // Still pending — poll again
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
        setFlowState({ status: "error", error: "Failed to exchange authorization code for tokens." });
        return;
      }

      // Success — store auth and navigate
      await ProviderAuthHelper.setAuth(props.providerId, authData);
      setFlowState({ status: "success" });

      if (!CachedData.connectedProviders.includes(props.providerId)) {
        CachedData.connectedProviders.push(props.providerId);
      }
      CachedData.activeProvider = props.providerId;

      setTimeout(() => {
        props.navigateTo("contentBrowser", { providerId: props.providerId, folderStack: [] });
      }, 1000);
    } catch (error) {
      console.error("Token exchange error:", error);
      setFlowState({ status: "error", error: "Token exchange failed. Please try again." });
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

  // Loading state
  if (flowState.status === "loading" || flowState.status === "exchanging") {
    const message = flowState.status === "exchanging" ? "Connecting..." : "Initializing authentication...";
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

  // Error or expired state
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
              Try Again
            </Text>
          </TouchableHighlight>
        </LinearGradient>
      </View>
    );
  }

  // Success state
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
            Connected!
          </Text>
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: DimensionHelper.wp("1.6%"),
              marginTop: DimensionHelper.hp("2%")
            }}>
            Loading your content...
          </Text>
        </LinearGradient>
      </View>
    );
  }

  // Main awaiting_user state — show QR code
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
          {/* Provider name */}
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: DimensionHelper.wp("2.5%"),
              fontWeight: "600",
              marginBottom: DimensionHelper.hp("2%")
            }}>
            Connect to {providerConfig?.name || "Provider"}
          </Text>

          {/* Instructions */}
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: DimensionHelper.wp("1.4%"),
              letterSpacing: 0.5,
              marginBottom: DimensionHelper.hp("3%"),
              textAlign: "center",
              paddingHorizontal: DimensionHelper.wp("10%")
            }}>
            Scan the QR code with your phone to authorize access.{"\n"}
            Your TV will connect automatically once you approve.
          </Text>

          {/* QR Code */}
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

          {/* Waiting indicator with pulse animation */}
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
                fontSize: DimensionHelper.wp("1.4%"),
                letterSpacing: 0.5
              }}>
              Waiting for authorization
            </Text>
          </Animated.View>

          {/* Expiration notice */}
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.3)",
              fontSize: DimensionHelper.wp("1%"),
              marginTop: DimensionHelper.hp("2%")
            }}>
            Session expires in {Math.floor(flowState.expiresIn / 60)} minutes
          </Text>
        </Animated.View>

        {/* Cancel button at bottom */}
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
              Cancel
            </Text>
          </TouchableHighlight>
        </View>
      </LinearGradient>
    </View>
  );
};
