import React, { useEffect, useRef } from "react";
import { View, Text, TouchableHighlight, BackHandler, ImageBackground, Animated } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { CachedData, Styles, Colors } from "../helpers";
import LinearGradient from "react-native-linear-gradient";
import { ContentFolder } from "../interfaces";
import { getProvider } from "../providers";
import { SvgUri } from "react-native-svg";

type Props = {
  navigateTo(page: string, data?: any): void;
  providerId: string;
  coverImage?: string;
  title?: string;
  description?: string;
  startIndex: number;
  folderStack?: ContentFolder[];
};

export const ProviderDownloadScreen = (props: Props) => {
  const [totalItems, setTotalItems] = React.useState(CachedData.totalCachableItems);
  const [cachedItems, setCachedItems] = React.useState(CachedData.cachedItems);
  const [currentFileProgress, setCurrentFileProgress] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const buttonFadeAnim = useRef(new Animated.Value(0)).current;

  const updateCounts = (cached: number, total: number): void => {
    setCachedItems(cached);
    setTotalItems(total);
  };

  const updateFileProgress = (progress: number): void => {
    setCurrentFileProgress(progress);
  };

  const handleStart = () => {
    props.navigateTo("player", {
      providerId: props.providerId,
      providerStartIndex: props.startIndex
    });
  };

  const getContent = () => {
    if (ready && cachedItems === totalItems) {
      return (<>
        <Text style={Styles.H2}>{props.title || "Content"}</Text>
        {props.description && (
          <Text style={{ ...Styles.smallerWhiteText, color: Colors.textLight }}>{props.description}</Text>
        )}
        <Animated.View style={{ opacity: buttonFadeAnim }}>
          <TouchableHighlight style={{ backgroundColor: Colors.primaryDark, width: DimensionHelper.wp("18%"), height: DimensionHelper.hp("7%"), marginTop: DimensionHelper.hp("1%"), borderRadius: 12, justifyContent: "center", alignItems: "center", flexDirection: "row" }} underlayColor={Colors.primary} onPress={() => { handleStart(); }} hasTVPreferredFocus={true}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Icon name="play-arrow" size={DimensionHelper.wp("2.5%")} color="#fff" />
              <Text style={{ ...Styles.smallWhiteText, marginLeft: 4 }} numberOfLines={1}>Start</Text>
            </View>
          </TouchableHighlight>
        </Animated.View>
      </>);
    } else {
      let progress = 0;
      if (totalItems > 0) {
        progress = ((cachedItems + currentFileProgress) / totalItems) * 100;
      }
      const buttonHeight = DimensionHelper.hp("6%");
      return (
        <>
          <Text style={Styles.H2}>{props.title || "Content"}</Text>
          {props.description && (
            <Text style={{ ...Styles.smallerWhiteText, color: Colors.textLight }}>{props.description}</Text>
          )}
          <View style={{ width: DimensionHelper.wp("35%"), height: buttonHeight, marginTop: DimensionHelper.hp("1%"), borderRadius: 5, overflow: "hidden", backgroundColor: Colors.progressBackground, position: "relative" }}>
            <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${progress}%`, backgroundColor: Colors.primaryDark, borderRadius: 5 }} />
            <TouchableHighlight style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }} underlayColor={"rgba(255,255,255,0.1)"}>
              <Text style={{ ...Styles.smallWhiteText }} numberOfLines={1}>Downloading item {cachedItems + 1} of {totalItems}</Text>
            </TouchableHighlight>
          </View>
        </>
      );
    }
  };

  const startDownload = () => {
    const files = CachedData.messageFiles;
    if (files && files.length > 0) {
      setReady(false);
      CachedData.prefetch(files, updateCounts, updateFileProgress).then(() => {
        setReady(true);
      });
    } else {
      setReady(true);
    }
  };

  const handleBack = () => {
    props.navigateTo("contentBrowser", {
      providerId: props.providerId,
      folderStack: props.folderStack
    });
  };

  const init = () => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => { handleBack(); return true; });
    startDownload();
    return () => {
      backHandler.remove();
    };
  };

  useEffect(init, []);
  useEffect(() => {
    if (ready && cachedItems === totalItems) {
      Animated.timing(buttonFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  }, [ready, cachedItems, totalItems]);

  // Use cover image, fall back to parent folder image, then provider logo
  const getBackgroundImage = () => {
    if (props.coverImage) return { uri: props.coverImage, isSvg: false };
    // Check parent folders for an image (most recent first)
    if (props.folderStack) {
      for (let i = props.folderStack.length - 1; i >= 0; i--) {
        const folder = props.folderStack[i];
        if (folder.thumbnail) return { uri: folder.thumbnail, isSvg: false };
      }
    }
    const provider = getProvider(props.providerId);
    const logo = provider?.logos?.dark || provider?.logos?.light;
    if (logo) {
      const isSvg = logo.toLowerCase().endsWith(".svg");
      return { uri: logo, isSvg };
    }
    return undefined;
  };
  const background = getBackgroundImage();

  const content = (
    <LinearGradient colors={["rgba(0, 0, 0, 1)", "rgba(0, 0, 0, 0)"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }}>
      <View style={{ flex: 9, justifyContent: "flex-end", flexDirection: "column" }}>
        <View style={{ justifyContent: "flex-start", flexDirection: "row", paddingLeft: DimensionHelper.wp("5%") }}>
          <View style={{ maxWidth: "60%" }}>
            {getContent()}
          </View>
        </View>
      </View>
      <View style={{ flex: 1 }}></View>
    </LinearGradient>
  );

  return (
    <View style={{ ...Styles.menuScreen, flex: 1, flexDirection: "row" }}>
      {background && !background.isSvg ? (
        <ImageBackground source={{ uri: background.uri }} resizeMode="contain" style={{ flex: 1, width: "100%" }}>
          {content}
        </ImageBackground>
      ) : background?.isSvg ? (
        <View style={{ flex: 1, width: "100%" }}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", opacity: 0.3 }}>
            <SvgUri uri={background.uri} width="50%" height="50%" />
          </View>
          {content}
        </View>
      ) : (
        <View style={{ flex: 1, width: "100%" }}>
          {content}
        </View>
      )}
    </View>
  );
};
