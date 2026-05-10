//import AsyncStorage from "@react-native-community/async-storage";
import React, { useRef, useEffect, useState } from "react";
import { View, Text, Animated, Easing } from "react-native";
import { useTranslation } from "react-i18next";
import { CachedData, Styles, Colors, Typography, PlanSync } from "../helpers";
import { ProviderAuthHelper, ProviderSettingsHelper } from "../helpers";
import { getAvailableProviders, FREEPLAY_PROVIDER_IDS, getProvider } from "../providers";
import SoundPlayer from "react-native-sound-player";
import { FreePlayLogo } from "../components";

type Props = { navigateTo(page: string, data?: any): void; };

export const SplashScreen = (props: Props) => {
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const [showConnecting, setShowConnecting] = useState(false);

  const loadData = async () => {
    CachedData.resolution = await CachedData.getAsyncStorage("resolution") || "720";

    CachedData.providerId = await CachedData.getAsyncStorage("providerId");
    CachedData.pairingData = await CachedData.getAsyncStorage("pairingData");
    CachedData.currentPlan = await CachedData.getAsyncStorage("currentPlan");
    await ProviderSettingsHelper.loadAll();
    if (CachedData.providerId && CachedData.pairingData) {
      const provider = getProvider(CachedData.providerId);
      provider?.setPairingData?.(CachedData.pairingData);
    }

    const connectedProviders: string[] = [];
    for (const providerInfo of getAvailableProviders(FREEPLAY_PROVIDER_IDS)) {
      if (providerInfo.implemented) {
        const isConnected = await ProviderAuthHelper.isConnected(providerInfo.id);
        if (isConnected) {
          connectedProviders.push(providerInfo.id);
        }
      }
    }
    CachedData.connectedProviders = connectedProviders;
    return connectedProviders;
  };

  const navigate = (connectedProviders: string[]) => {
    if (connectedProviders.length > 0) {
      const firstProviderId = connectedProviders[0];
      CachedData.activeProvider = firstProviderId;
      props.navigateTo("contentBrowser", { providerId: firstProviderId, folderStack: [] });
    } else {
      props.navigateTo("providers");
    }
  };

  useEffect(() => {
    SoundPlayer.playSoundFile("launch", "mp3");

    // Fade in + scale up the logo
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();

    // Show pulsing loading dot after 1 second
    const dotTimer = setTimeout(() => {
      Animated.timing(dotOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(dotOpacity, {
              toValue: 0.3,
              duration: 800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true
            }),
            Animated.timing(dotOpacity, {
              toValue: 1,
              duration: 800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true
            })
          ])
        ).start();
      });
    }, 1000);

    // Surface "Connecting..." text after 1.5s for users who haven't navigated yet
    const connectingTimer = setTimeout(() => setShowConnecting(true), 1500);

    // Navigate as soon as data loads, but ensure minimum 1.2s display for branding
    const minDisplayTime = new Promise<void>(resolve => setTimeout(resolve, 1200));
    Promise.all([minDisplayTime, loadData()]).then(([, connectedProviders]) => {
      navigate(connectedProviders);
      PlanSync.syncCurrentPlan();
    });

    return () => { clearTimeout(dotTimer); clearTimeout(connectingTimer); };
  }, []);

  return (
    <View style={Styles.splashMaincontainer} testID="splash-root">
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
        alignItems: "center"
      }}>
        <FreePlayLogo size="large" showText={true} />
        <Animated.View style={{
          opacity: dotOpacity,
          marginTop: 24,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: Colors.primary
        }} />
        {showConnecting && (
          <Text
            style={{
              color: Colors.textSubtle,
              fontSize: Typography.bodyMedium,
              marginTop: 16,
              letterSpacing: 0.5
            }}>
            {t("splash.connecting")}
          </Text>
        )}
      </Animated.View>
    </View>
  );

};
