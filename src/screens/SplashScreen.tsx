//import AsyncStorage from "@react-native-community/async-storage";
import React from "react"
import { View } from "react-native"
import { CachedData, Styles, ProviderAuthHelper } from "../helpers";
import { getAvailableProviders } from "../providers";
import SoundPlayer from "react-native-sound-player";
import { FreePlayLogo } from "../components";

type Props = { navigateTo(page: string): void; };

export const SplashScreen = (props: Props) => {
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
    for (const providerInfo of getAvailableProviders()) {
      if (providerInfo.implemented) {
        const isConnected = await ProviderAuthHelper.isConnected(providerInfo.id);
        if (isConnected) {
          connectedProviders.push(providerInfo.id);
        }
      }
    }
    CachedData.connectedProviders = connectedProviders;

    // Navigate to providers screen by default
    props.navigateTo("providers");
  }

  React.useEffect(() => {
    SoundPlayer.playSoundFile('launch', 'mp3')
    setTimeout(() => {
      checkStorage();
    }, 2500);


  }, [])

  return (
    <View style={Styles.splashMaincontainer}>
      <FreePlayLogo size="large" showText={true} />
    </View>
  )

}
