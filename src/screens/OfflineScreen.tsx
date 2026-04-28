//import AsyncStorage from "@react-native-community/async-storage";
import React, { useEffect } from "react";
import { View, Text, TouchableHighlight, BackHandler } from "react-native";
import { useTranslation } from "react-i18next";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { CachedData, Styles } from "../helpers";
import LinearGradient from "react-native-linear-gradient";

type Props = { navigateTo(page: string): void; };

export const OfflineScreen = (props: Props) => {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = React.useState(0);

  console.log(refreshKey);

  const init = () => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => { handleBack(); return true; });
    CachedData.getAsyncStorage("messageFiles").then((cached: any) => {
      CachedData.messageFiles = cached;
      setRefreshKey(prev => prev + 1);
      console.log("messagefiles", cached);
    }).catch((err) => console.error("Failed to load cached messageFiles:", err));
    return () => backHandler.remove();
  };

  const handleBack = () => {
    props.navigateTo("selectRoom");
  };

  useEffect(init, []);

  const handleStart = () => {
    props.navigateTo("player");
  };

  const getContent = () => {
    if (CachedData.messageFiles?.length > 0) {
      return (<>
        <Text style={{ ...Styles.smallerWhiteText, color: "#CCCCCC" }}>{t("offline.canPlayDownloaded")}</Text>
        <TouchableHighlight style={{ ...Styles.smallMenuClickable, backgroundColor: "#C2185B", width: DimensionHelper.wp("14%"), marginTop: DimensionHelper.hp("1%"), borderRadius: 5 }} underlayColor={"#E91E63"} onPress={() => { handleStart(); }} hasTVPreferredFocus={true}>
          <Text style={{ ...Styles.smallWhiteText, width: "100%" }}>{t("offline.startLesson")}</Text>
        </TouchableHighlight>
      </>);
    } else {
      return (<>
        <Text style={{ ...Styles.smallerWhiteText, color: "#CCCCCC" }}>{t("offline.notDownloaded")}</Text>
      </>);
    }
  };

  return (<LinearGradient colors={["rgba(0, 0, 0, 1)", "rgba(0, 0, 0, 0)"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }}>
    <View style={{ flex: 9, justifyContent: "flex-end", flexDirection: "column" }}>
      <View style={{ justifyContent: "flex-start", flexDirection: "row", paddingLeft: DimensionHelper.wp("5%") }}>
        <View style={{ maxWidth: "60%" }}>
          <Text style={Styles.H2}>{t("offline.title")}</Text>
          <Text style={Styles.H3}>{t("offline.subtitle")}</Text>
          {getContent()}
        </View>
      </View>
    </View>

    <View style={{ flex: 1 }}></View>
  </LinearGradient>);



};
