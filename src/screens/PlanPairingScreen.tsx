import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableHighlight, BackHandler, ActivityIndicator, Animated, Easing } from "react-native";
import { useTranslation } from "react-i18next";
import { ApiHelper, CachedData, DeviceHelper, ScheduleSync, Styles, Colors, Typography } from "../helpers";
import { SoundHelper } from "../helpers/SoundHelper";
import { DeviceInterface } from "../interfaces";
import { getProvider } from "../providers";
import { DimensionHelper } from "../helpers/DimensionHelper";
import LinearGradient from "react-native-linear-gradient";
import QRCode from "react-native-qrcode-svg";
import { PairingCode } from "../components";

const CODE_LIFETIME_SECONDS = 15 * 60;

type Props = {
  navigateTo(page: string): void;
  sidebarState(state: boolean): void;
  sidebarExpanded?: boolean;
  scheduled?: boolean;
};

export const PlanPairingScreen = (props: Props) => {
  const { t } = useTranslation();
  const [pairingCode, setPairingCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(CODE_LIFETIME_SECONDS);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deviceIdRef = useRef<string>("");
  const pollGenerationRef = useRef<number>(0);

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
      if (result.secret) await DeviceHelper.setSecret(result.secret);
      setPairingCode(result.pairingCode || "");
      setSecondsLeft(CODE_LIFETIME_SECONDS);
      setLoading(false);
      fadeIn();
      startPulseAnimation();
      startPairingPoll(currentGeneration);
    } catch (err) {
      console.error("Failed to initialize pairing:", err);
      setError(t("planPairing.generateFailed"));
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

        if (status.paired && status.contentType === "freeplayScreen") {
          await ScheduleSync.setPaired(status.contentId || "");
          ScheduleSync.sync();
          pollGenerationRef.current += 1;
          setSuccess(true);
          SoundHelper.playChime();
          setTimeout(() => props.navigateTo("scheduledPlayer"), 2000);
        } else if (status.paired && status.contentType) {
          // The Api echoes the pairing claim as contentType (providerId) + contentId (plan type)
          if (ScheduleSync.isScheduled()) await ScheduleSync.unpair();
          CachedData.providerId = status.contentType;
          CachedData.pairingData = status.contentId ? { planTypeId: status.contentId } : null;
          await CachedData.setAsyncStorage("providerId", CachedData.providerId);
          await CachedData.setAsyncStorage("pairingData", CachedData.pairingData);
          const provider = getProvider(CachedData.providerId);
          provider?.setPairingData?.(CachedData.pairingData);
          pollGenerationRef.current += 1;
          setSuccess(true);
          SoundHelper.playChime();
          setTimeout(() => props.navigateTo("planDownload"), 2000);
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

  const handleCancel = () => {
    pollGenerationRef.current += 1;
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    props.navigateTo("settings");
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

  useEffect(() => {
    if (!props.scheduled || loading || success || error) return;
    if (secondsLeft <= 0) { initPairing(); return; }
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [props.scheduled, secondsLeft, loading, success, error]);

  const countdown = Math.floor(secondsLeft / 60) + ":" + String(secondsLeft % 60).padStart(2, "0");

  const outlineButton = (label: string, onPress: () => void, preferred: boolean) => (
    <TouchableHighlight
      onPress={onPress}
      underlayColor="rgba(255, 255, 255, 0.1)"
      hasTVPreferredFocus={preferred}
      style={{
        marginHorizontal: DimensionHelper.wp("0.6%"),
        paddingVertical: DimensionHelper.hp("1.2%"),
        paddingHorizontal: DimensionHelper.wp("2.5%"),
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)"
      }}
    >
      <Text style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: Typography.labelMedium, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </TouchableHighlight>
  );

  const waitingIndicator = (
    <Animated.View
      style={{
        marginTop: DimensionHelper.hp(props.scheduled ? "3%" : "5%"),
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
          backgroundColor: Colors.primary,
          marginRight: DimensionHelper.wp("1%")
        }}
      />
      <Text
        style={{
          color: "rgba(255, 255, 255, 0.4)",
          fontSize: Typography.labelMedium,
          letterSpacing: 0.5
        }}
      >
        {t("planPairing.waiting")}
      </Text>
    </Animated.View>
  );

  const scheduledContent = (
    <>
      <Text style={{ color: Colors.textPrimary, fontSize: Typography.titleLarge, fontWeight: "700", marginBottom: DimensionHelper.hp("1.5%") }}>
        {t("schedule.title")}
      </Text>
      <Text
        style={{
          color: "rgba(255, 255, 255, 0.5)",
          fontSize: DimensionHelper.wp("1.6%"),
          letterSpacing: 0.5,
          marginBottom: DimensionHelper.hp("3%"),
          textAlign: "center",
          paddingHorizontal: DimensionHelper.wp("6%")
        }}
      >
        {t("schedule.instructions")} <Text style={{ color: Colors.primary, fontWeight: "700" }}>{t("schedule.url")}</Text> {t("schedule.instructionsEnd")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ backgroundColor: "#ffffff", padding: DimensionHelper.wp("1%"), borderRadius: 12, marginRight: DimensionHelper.wp("3.5%") }}>
          <QRCode value={"https://freeplay.church/pair?code=" + encodeURIComponent(pairingCode)} size={DimensionHelper.wp("12%")} backgroundColor="#ffffff" color="#000000" />
        </View>
        <PairingCode code={pairingCode} />
      </View>
      {waitingIndicator}
      <Text
        style={{
          color: "rgba(255, 255, 255, 0.5)",
          fontSize: Typography.labelMedium,
          marginTop: DimensionHelper.hp("1.5%"),
          letterSpacing: 0.3
        }}
      >
        {t("schedule.secondary", { time: countdown })}
      </Text>
      <View style={{ flexDirection: "row", marginTop: DimensionHelper.hp("3%") }}>
        {outlineButton(t("planPairing.regenerate"), initPairing, true)}
        {outlineButton(t("schedule.cancel"), handleCancel, false)}
      </View>
    </>
  );

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
            {t("planPairing.generating")}
          </Text>
        </LinearGradient>
      </View>
    );
  }

  if (success) {
    return (
      <View style={Styles.menuScreen}>
        <LinearGradient
          colors={["#1a0f17", "#160a14", "#100714"]}
          style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }}
        >
          <Text
            style={{
              color: Colors.success,
              fontSize: Typography.heading3,
              fontWeight: "bold"
            }}
          >
            {t("planPairing.connected")}
          </Text>
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: Typography.bodySmall,
              marginTop: DimensionHelper.hp("2%")
            }}
          >
            {props.scheduled ? t("schedule.loadingSchedule") : t("planPairing.loadingPlan")}
          </Text>
        </LinearGradient>
      </View>
    );
  }

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
              {t("planPairing.tryAgain")}
            </Text>
          </TouchableHighlight>
        </LinearGradient>
      </View>
    );
  }

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
          {props.scheduled ? scheduledContent : (
            <>
              <Text
                style={{
                  color: "rgba(255, 255, 255, 0.5)",
                  fontSize: DimensionHelper.wp("1.6%"),
                  letterSpacing: 0.5,
                  marginBottom: DimensionHelper.hp("2%")
                }}
              >
                {t("planPairing.instructions")}
              </Text>

              <PairingCode code={pairingCode} />

              {waitingIndicator}

              <Text
                style={{
                  color: "rgba(255, 255, 255, 0.5)",
                  fontSize: Typography.labelMedium,
                  marginTop: DimensionHelper.hp("1.5%"),
                  letterSpacing: 0.3
                }}
              >
                {t("planPairing.secondary")}
              </Text>

              <TouchableHighlight
                onPress={initPairing}
                underlayColor="rgba(255, 255, 255, 0.1)"
                hasTVPreferredFocus={false}
                style={{
                  marginTop: DimensionHelper.hp("4%"),
                  paddingVertical: DimensionHelper.hp("1.2%"),
                  paddingHorizontal: DimensionHelper.wp("2.5%"),
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.15)"
                }}
              >
                <Text
                  style={{
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: Typography.labelMedium,
                    letterSpacing: 0.3
                  }}
                >
                  {t("planPairing.regenerate")}
                </Text>
              </TouchableHighlight>
            </>
          )}
        </Animated.View>
      </LinearGradient>
    </View>
  );
};
