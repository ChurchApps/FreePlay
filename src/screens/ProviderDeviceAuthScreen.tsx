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
import { DeviceAuthorizationResponse, DeviceFlowState, ContentProviderAuthData, DeviceFlowHelper } from "../interfaces";
import { DimensionHelper } from "../helpers/DimensionHelper";
import LinearGradient from "react-native-linear-gradient";
import { getProvider } from "../providers";
import QRCode from "react-native-qrcode-svg";

const deviceFlowHelper = new DeviceFlowHelper();

type Props = {
  navigateTo(page: string, data?: any): void;
  sidebarState(state: boolean): void;
  sidebarExpanded?: boolean;
  providerId: string;
};

export const ProviderDeviceAuthScreen = (props: Props) => {
  const [flowState, setFlowState] = useState<DeviceFlowState>({ status: "loading" });
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollGenerationRef = useRef<number>(0);
  const slowDownCountRef = useRef<number>(0);

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

  const initDeviceFlow = async () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    pollGenerationRef.current += 1;
    slowDownCountRef.current = 0;
    const currentGeneration = pollGenerationRef.current;

    setFlowState({ status: "loading" });

    try {
      if (!provider) {
        setFlowState({
          status: "error",
          error: "Provider not found."
        });
        return;
      }

      const deviceAuth = await deviceFlowHelper.initiateDeviceFlow(provider.config);

      if (!deviceAuth) {
        setFlowState({
          status: "error",
          error: "Failed to initialize authentication. Please try again."
        });
        return;
      }

      setFlowState({
        status: "awaiting_user",
        deviceAuth
      });

      fadeIn();
      startPulseAnimation();
      startPolling(deviceAuth, currentGeneration);
    } catch (error) {
      console.error("Device flow init error:", error);
      setFlowState({
        status: "error",
        error: "An unexpected error occurred. Please try again."
      });
    }
  };

  const startPolling = (
    deviceAuth: DeviceAuthorizationResponse,
    generation: number
  ) => {
    const expiresAt = Date.now() + deviceAuth.expires_in * 1000;
    const baseInterval = deviceAuth.interval || 5;

    const poll = async () => {
      if (generation !== pollGenerationRef.current) return;

      if (Date.now() >= expiresAt) {
        setFlowState({
          status: "expired",
          error: "Authentication code expired. Please try again."
        });
        return;
      }

      setFlowState(prev => ({ ...prev, status: "polling" }));

      const result = await deviceFlowHelper.pollDeviceFlowToken(provider!.config, deviceAuth.device_code);

      if (generation !== pollGenerationRef.current) return;

      if (result === null) {
        setFlowState({
          status: "error",
          error: "Authentication failed or was denied."
        });
        return;
      }

      if ("error" in result) {
        if (result.shouldSlowDown) {
          slowDownCountRef.current += 1;
        }

        const delay = deviceFlowHelper.calculatePollDelay(
          baseInterval,
          slowDownCountRef.current
        );

        setFlowState(prev => ({
          ...prev,
          status: "awaiting_user",
          pollCount: (prev.pollCount || 0) + 1
        }));

        pollTimeoutRef.current = setTimeout(poll, delay);
        return;
      }

      // Success - store auth
      await ProviderAuthHelper.setAuth(props.providerId, result as ContentProviderAuthData);
      setFlowState({ status: "success" });

      if (!CachedData.connectedProviders.includes(props.providerId)) {
        CachedData.connectedProviders.push(props.providerId);
      }
      CachedData.activeProvider = props.providerId;

      setTimeout(() => {
        props.navigateTo("contentBrowser", { providerId: props.providerId, folderStack: [] });
      }, 1000);
    };

    const initialDelay = deviceFlowHelper.calculatePollDelay(baseInterval, 0);
    pollTimeoutRef.current = setTimeout(poll, initialDelay);
  };

  const handleBack = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }
    props.sidebarState(true);
  };

  useEffect(() => {
    initDeviceFlow();

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

  const renderCodeCharacter = (char: string, index: number) => (
    <View
      key={index}
      style={{
        backgroundColor: Colors.hoverBackground,
        borderRadius: DimensionHelper.wp("0.8%"),
        paddingVertical: DimensionHelper.hp("1.5%"),
        paddingHorizontal: DimensionHelper.wp("2%"),
        marginHorizontal: DimensionHelper.wp("0.3%"),
        borderWidth: 1,
        borderColor: Colors.borderAccent
      }}>
      <Text
        style={{
          fontSize: DimensionHelper.wp("5%"),
          fontWeight: "800",
          fontFamily: "monospace",
          color: Colors.primary,
          textShadowColor: "rgba(233, 30, 99, 0.5)",
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 20
        }}>
        {char}
      </Text>
    </View>
  );

  // Loading state
  if (flowState.status === "loading") {
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
            Initializing authentication...
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
            onPress={initDeviceFlow}
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

  // Main awaiting_user / polling state
  const deviceAuth = flowState.deviceAuth!;
  const verificationUrl =
    deviceAuth.verification_uri_complete || deviceAuth.verification_uri;

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
            Scan the QR code with your phone, or visit{"\n"}
            <Text style={{ color: Colors.primary }}>{deviceAuth.verification_uri}</Text>
            {"\n"}and enter the code below
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
              value={verificationUrl}
              size={DimensionHelper.wp("12%")}
              backgroundColor="#ffffff"
              color="#000000"
            />
          </View>

          {/* User Code */}
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.4)",
                fontSize: DimensionHelper.wp("1.2%"),
                marginBottom: DimensionHelper.hp("1%")
              }}>
              Enter this code:
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {deviceAuth.user_code.split("").map((char, index) =>
                char === "-" ? (
                  <Text
                    key={index}
                    style={{
                      fontSize: DimensionHelper.wp("3.5%"),
                      color: "rgba(255,255,255,0.3)",
                      alignSelf: "center",
                      marginHorizontal: DimensionHelper.wp("0.5%")
                    }}>
                    -
                  </Text>
                ) : (
                  renderCodeCharacter(char, index)
                ))}
            </View>
          </View>

          {/* Waiting indicator with pulse animation */}
          <Animated.View
            style={{
              marginTop: DimensionHelper.hp("5%"),
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
            Code expires in {Math.floor(deviceAuth.expires_in / 60)} minutes
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
