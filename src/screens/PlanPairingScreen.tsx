import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableHighlight, BackHandler, ActivityIndicator, Animated, Easing } from "react-native";
import { ApiHelper, CachedData, DeviceHelper, Styles } from "../helpers";
import { DeviceInterface } from "../interfaces";
import { DimensionHelper } from "../helpers/DimensionHelper";
import LinearGradient from "react-native-linear-gradient";

type Props = {
  navigateTo(page: string): void;
  sidebarState(state: boolean): void;
  sidebarExpanded?: boolean;
};

export const PlanPairingScreen = (props: Props) => {
  const [pairingCode, setPairingCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deviceIdRef = useRef<string>("");
  const pollGenerationRef = useRef<number>(0);

  // Animated values for the pulsing glow effect
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  const initPairing = async () => {
    // Clear any existing poll and increment generation to invalidate stale polls
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    pollGenerationRef.current += 1;
    const currentGeneration = pollGenerationRef.current;

    try {
      setLoading(true);
      setError("");
      const deviceId = await DeviceHelper.getDeviceId();
      deviceIdRef.current = deviceId;
      console.log("Using deviceId:", deviceId);

      const result: DeviceInterface = await ApiHelper.post(
        "/devices/enrollAnon",
        { deviceId, appName: "FreePlay" },
        "MessagingApi"
      );

      console.log("Enrolled with pairingCode:", result.pairingCode, "deviceId from response:", result.deviceId);
      setPairingCode(result.pairingCode || "");
      setLoading(false);
      fadeIn();
      startPulseAnimation();
      startPairingPoll(currentGeneration);
    } catch (err) {
      console.error("Failed to initialize pairing:", err);
      setError("Failed to generate pairing code. Please try again.");
      setLoading(false);
    }
  };

  const startPairingPoll = (generation: number) => {
    const poll = async () => {
      // Stop if this poll is from an old generation
      if (generation !== pollGenerationRef.current) {
        console.log("Stopping stale poll, generation:", generation, "current:", pollGenerationRef.current);
        return;
      }

      const currentDeviceId = deviceIdRef.current;
      if (!currentDeviceId) return;

      try {
        const status: DeviceInterface & { paired: boolean } = await ApiHelper.getAnonymous(
          `/devices/status/${currentDeviceId}`,
          "MessagingApi"
        );

        console.log("Polling deviceId:", currentDeviceId, "status:", JSON.stringify(status));

        if (status.paired && status.contentType === "planType") {
          CachedData.planTypeId = status.contentId;
          CachedData.pairedChurchId = status.churchId;
          await CachedData.setAsyncStorage("planTypeId", status.contentId);
          await CachedData.setAsyncStorage("pairedChurchId", status.churchId);
          props.navigateTo("planDownload");
        } else {
          pollTimeoutRef.current = setTimeout(poll, 3000);
        }
      } catch (err) {
        console.error("Polling error:", err);
        pollTimeoutRef.current = setTimeout(poll, 3000);
      }
    };
    poll();
  };

  const handleBack = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }
    props.sidebarState(true);
  };

  const handleSearchByName = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }
    props.navigateTo("selectChurch");
  };

  const init = () => {
    initPairing();
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
  };

  useEffect(init, []);

  // Render individual code character with styling
  const renderCodeCharacter = (char: string, index: number) => (
    <View
      key={index}
      style={{
        backgroundColor: "rgba(233, 30, 99, 0.08)",
        borderRadius: DimensionHelper.wp("1%"),
        paddingVertical: DimensionHelper.hp("2.5%"),
        paddingHorizontal: DimensionHelper.wp("3%"),
        marginHorizontal: DimensionHelper.wp("0.5%"),
        borderWidth: 1,
        borderColor: "rgba(233, 30, 99, 0.2)"
      }}
    >
      <Text
        style={{
          fontSize: DimensionHelper.wp("7%"),
          fontWeight: "800",
          fontFamily: "monospace",
          color: "#E91E63",
          textShadowColor: "rgba(233, 30, 99, 0.5)",
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 20
        }}
      >
        {char}
      </Text>
    </View>
  );

  // Loading state
  if (loading) {
    return (
      <View style={Styles.menuScreen}>
        <LinearGradient
          colors={["#1a0f17", "#160a14", "#100714"]}
          style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#E91E63" />
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: DimensionHelper.wp("1.8%"),
              marginTop: DimensionHelper.hp("3%"),
              letterSpacing: 1
            }}
          >
            Generating pairing code...
          </Text>
        </LinearGradient>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={Styles.menuScreen}>
        <LinearGradient
          colors={["#1a0f17", "#160a14", "#100714"]}
          style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }}
        >
          <Text
            style={{
              color: "#ff6b6b",
              fontSize: DimensionHelper.wp("2%"),
              marginBottom: DimensionHelper.hp("4%"),
              textAlign: "center",
              paddingHorizontal: DimensionHelper.wp("10%")
            }}
          >
            {error}
          </Text>
          <TouchableHighlight
            onPress={initPairing}
            underlayColor="rgba(233, 30, 99, 0.8)"
            hasTVPreferredFocus={true}
            style={{
              backgroundColor: "#E91E63",
              paddingVertical: DimensionHelper.hp("2%"),
              paddingHorizontal: DimensionHelper.wp("5%"),
              borderRadius: 8
            }}
          >
            <Text
              style={{
                color: "#ffffff",
                fontSize: DimensionHelper.wp("2%"),
                fontWeight: "600"
              }}
            >
              Try Again
            </Text>
          </TouchableHighlight>
        </LinearGradient>
      </View>
    );
  }

  // Main pairing screen
  return (
    <View style={Styles.menuScreen}>
      <LinearGradient
        colors={["#1a0f17", "#160a14", "#0d0510"]}
        style={{ flex: 1, width: "100%" }}
      >
        <Animated.View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            opacity: fadeAnim,
            paddingBottom: DimensionHelper.hp("8%")
          }}
        >
          {/* Instructional text - subtle and secondary */}
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: DimensionHelper.wp("1.6%"),
              letterSpacing: 0.5,
              marginBottom: DimensionHelper.hp("2%")
            }}
          >
            Enter this code in the Plan Type section of B1Admin
          </Text>

          {/* Hero pairing code */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {pairingCode.split("").map((char, index) => renderCodeCharacter(char, index))}
          </View>

          {/* Waiting indicator with pulsing animation */}
          <Animated.View
            style={{
              marginTop: DimensionHelper.hp("5%"),
              flexDirection: "row",
              alignItems: "center",
              opacity: pulseAnim
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#E91E63",
                marginRight: DimensionHelper.wp("1%")
              }}
            />
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.4)",
                fontSize: DimensionHelper.wp("1.4%"),
                letterSpacing: 0.5
              }}
            >
              Waiting for connection
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Secondary action - very subtle at bottom */}
        <View
          style={{
            position: "absolute",
            bottom: DimensionHelper.hp("4%"),
            left: 0,
            right: 0,
            alignItems: "center"
          }}
        >
          <TouchableHighlight
            onPress={handleSearchByName}
            underlayColor="rgba(255, 255, 255, 0.1)"
            hasTVPreferredFocus={false}
            style={{
              paddingVertical: DimensionHelper.hp("1%"),
              paddingHorizontal: DimensionHelper.wp("2%"),
              borderRadius: 4
            }}
          >
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.35)",
                fontSize: DimensionHelper.wp("1.2%"),
                letterSpacing: 0.3
              }}
            >
              or search by church name
            </Text>
          </TouchableHighlight>
        </View>
      </LinearGradient>
    </View>
  );
};
