//import AsyncStorage from "@react-native-community/async-storage";
import React, { useRef, useEffect } from "react";
import { View, Animated, Easing } from "react-native";
import { CachedData, Styles, Colors } from "../helpers";
import { ProviderAuthHelper } from "../helpers";
import { getAvailableProviders } from "../providers";
import SoundPlayer from "react-native-sound-player";
import { FreePlayLogo } from "../components";

type Props = { navigateTo(page: string, data?: any): void; };

export const SplashScreen = (props: Props) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  const checkStorage = async () => {
    // Utilities.trackEvent("Splash Screen");
    CachedData.church = await CachedData.getAsyncStorage("church");
    CachedData.room = await CachedData.getAsyncStorage("room");
    CachedData.resolution = await CachedData.getAsyncStorage("resolution") || "720";

    // Check for plan pairing
    CachedData.planTypeId = await CachedData.getAsyncStorage("planTypeId");
    CachedData.pairedChurchId = await CachedData.getAsyncStorage("pairedChurchId");

    // Check all registered providers for saved auth
    const connectedProviders: string[] = [];
    for (const providerInfo of getAvailableProviders(["signpresenter", "lessonschurch", "b1church", "bibleproject"])) {
      if (providerInfo.implemented) {
        const isConnected = await ProviderAuthHelper.isConnected(providerInfo.id);
        if (isConnected) {
          connectedProviders.push(providerInfo.id);
        }
      }
    }
    CachedData.connectedProviders = connectedProviders;

    // If there are connected providers, navigate to the first one (same order as sidebar)
    if (connectedProviders.length > 0) {
      const firstProviderId = connectedProviders[0];
      CachedData.activeProvider = firstProviderId;
      props.navigateTo("contentBrowser", { providerId: firstProviderId, folderStack: [] });
    } else {
      // No connected providers, go to providers screen
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

    const storageTimer = setTimeout(() => {
      checkStorage();
    }, 2500);

    return () => { clearTimeout(dotTimer); clearTimeout(storageTimer); };
  }, []);

  return (
    <View style={Styles.splashMaincontainer}>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
        alignItems: "center"
      }}>
        <FreePlayLogo size="large" showText={true} />
        <Animated.View style={{
          opacity: dotOpacity,
          marginTop: 24,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: Colors.primary
        }} />
      </Animated.View>
    </View>
  );

};
