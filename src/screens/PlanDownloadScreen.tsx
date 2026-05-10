import React, { useEffect } from "react";
import { View, Text, TouchableHighlight, ActivityIndicator, BackHandler, ImageBackground } from "react-native";
import { useTranslation } from "react-i18next";
import Icon from "react-native-vector-icons/MaterialIcons";
import { CachedData, Styles, DownloadIndex, ProviderAuthHelper, StorageManager, Typography } from "../helpers";
import { Colors } from "../helpers/Styles";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { CurrentPlan } from "@churchapps/content-providers";
import { getProvider } from "../providers";
import LinearGradient from "react-native-linear-gradient";

type Props = {
  navigateTo(page: string): void;
  sidebarState: (state: boolean) => void;
  sidebarExpanded?: boolean;
};

export const PlanDownloadScreen = (props: Props) => {
  const { t } = useTranslation();
  const [plan, setPlan] = React.useState<CurrentPlan | null>(null);
  const [totalItems, setTotalItems] = React.useState(0);
  const [cachedItems, setCachedItems] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState("");
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [offlineCheck, setOfflineCheck] = React.useState(false);

  const updateCounts = (cached: number, total: number): void => {
    setCachedItems(cached);
    setTotalItems(total);
  };

  const downloadKey = React.useMemo(
    () => DownloadIndex.generateKey("plan", { planId: plan?.id || "", contentPath: plan?.id || "" }),
    [plan?.id]
  );

  const handleStart = () => {
    StorageManager.touchEntry(downloadKey);
    props.navigateTo("player");
  };

  const getVersion = () => {
    const pkg = require("../../package.json");
    return (
      <Text style={{ ...Styles.smallWhiteText, textAlign: "left", fontSize: Typography.labelSmall, paddingBottom: 15, color: "#999999", paddingTop: 15 }}>
        {t("common.version", { version: pkg.version })}
      </Text>
    );
  };

  const getContent = () => {
    if (!plan) return <ActivityIndicator size="small" color="gray" animating={true} />;
    if (ready && cachedItems === totalItems) {
      return (
        <>
          <Text style={Styles.H2}>{plan.title || t("planDownload.fallbackName")}</Text>
          {plan.serviceDate && (
            <Text style={Styles.H3}>{new Date(plan.serviceDate).toLocaleDateString()}</Text>
          )}
          <TouchableHighlight
            style={{
              ...Styles.smallMenuClickable,
              backgroundColor: "#C2185B",
              width: DimensionHelper.wp("18%"),
              marginTop: DimensionHelper.hp("1%"),
              borderRadius: 5
            }}
            underlayColor={"#E91E63"}
            onPress={() => handleStart()}
            hasTVPreferredFocus={true}
          >
            <Text style={{ ...Styles.smallWhiteText, width: "100%" }} numberOfLines={1}>
              {t("planDownload.startPlan")}
            </Text>
          </TouchableHighlight>
          {getVersion()}
        </>
      );
    }
    return (
      <>
        <Text style={Styles.H2}>{plan.title || t("planDownload.fallbackName")}</Text>
        {plan.serviceDate && (
          <Text style={Styles.H3}>{new Date(plan.serviceDate).toLocaleDateString()}</Text>
        )}
        <TouchableHighlight
          style={{
            ...Styles.smallMenuClickable,
            backgroundColor: "#999999",
            width: DimensionHelper.wp("35%"),
            marginTop: DimensionHelper.hp("1%"),
            borderRadius: 5
          }}
          underlayColor={"#999999"}
        >
          <Text style={{ ...Styles.smallWhiteText, width: "100%" }} numberOfLines={1}>
            {t("planDownload.downloadingItem", { current: cachedItems, total: totalItems })}
          </Text>
        </TouchableHighlight>
        {getVersion()}
      </>
    );
  };

  const loadData = async () => {
    setLoading(true);

    const cachedPlan = await CachedData.getAsyncStorage("currentPlan");
    if (cachedPlan) setPlan(cachedPlan);

    try {
      const providerId = CachedData.providerId;
      if (!providerId) { setLoadFailed(true); setLoading(false); return; }

      const provider = getProvider(providerId);
      if (!provider?.getCurrentPlan) { setLoadFailed(true); setLoading(false); return; }

      const auth = await ProviderAuthHelper.refreshIfNeeded(providerId);
      const currentPlan = await provider.getCurrentPlan(auth);
      if (!currentPlan) { setLoadFailed(true); setLoading(false); return; }

      setPlan(currentPlan);
      CachedData.currentPlan = currentPlan;
      await CachedData.setAsyncStorage("currentPlan", currentPlan);
    } catch (ex) {
      console.error("Error loading plan:", ex);
      if (ex.toString().indexOf("Network request failed") > -1) {
        props.navigateTo("offline");
      }
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const startDownload = async () => {
    if (!plan) return;
    const files = plan.files || [];
    if (files.length === 0) {
      CachedData.messageFiles = [];
      setReady(true);
      return;
    }
    CachedData.messageFiles = files;
    await CachedData.setAsyncStorage("messageFiles", files);
    setReady(false);
    await StorageManager.ensureFreeSpace([downloadKey]);
    CachedData.prefetch(files, updateCounts).then(() => {
      setReady(true);
      DownloadIndex.addEntry({
        downloadKey,
        source: "plan",
        title: plan.title || t("planDownload.fallbackName"),
        messageFiles: files,
        downloadedAt: Date.now()
      });
    });
  };

  const handleBack = () => {
    props.sidebarState(true);
  };

  const init = () => {
    const timer = setInterval(() => {
      setRefreshKey(new Date().getTime().toString());
    }, 60 * 60 * 1000);

    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });

    setTimeout(() => setOfflineCheck(true), 5000);

    return () => {
      clearInterval(timer);
      backHandler.remove();
    };
  };

  useEffect(init, []);
  useEffect(() => { loadData(); }, [refreshKey]);
  useEffect(() => { if (plan && plan.files) startDownload(); }, [plan?.id, plan?.files?.length]);
  useEffect(() => {
    if (offlineCheck && loading) props.navigateTo("offline");
  }, [offlineCheck]);

  if (loadFailed) {
    return (
      <View style={{ ...Styles.menuScreen, flex: 1, width: DimensionHelper.wp("100%"), justifyContent: "center", alignItems: "center" }}>
        <Icon name="error-outline" size={DimensionHelper.wp("4%")} color={Colors.error} />
        <Text style={{ ...Styles.bigWhiteText, marginTop: DimensionHelper.hp("2%") }}>
          {t("planDownload.loadFailed")}
        </Text>
        <Text style={{ ...Styles.whiteText, marginTop: DimensionHelper.hp("1%") }}>
          {t("planDownload.loadFailedSub")}
        </Text>
        <TouchableHighlight
          style={{ backgroundColor: Colors.primaryDark, paddingVertical: DimensionHelper.hp("1.5%"), paddingHorizontal: DimensionHelper.wp("3%"), marginTop: DimensionHelper.hp("3%"), borderRadius: 12 }}
          underlayColor={Colors.primary}
          onPress={() => { setLoadFailed(false); setRefreshKey(new Date().getTime().toString()); }}
          hasTVPreferredFocus={true}
        >
          <Text style={Styles.smallWhiteText}>{t("planDownload.tryAgain")}</Text>
        </TouchableHighlight>
      </View>
    );
  }

  const contentOverlay = (
    <LinearGradient
      colors={["rgba(0, 0, 0, 1)", "rgba(0, 0, 0, 0)"]}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 9, justifyContent: "flex-end", flexDirection: "column" }}>
        <View style={{ justifyContent: "flex-start", flexDirection: "row", paddingLeft: DimensionHelper.wp("5%") }}>
          <View style={{ maxWidth: "60%" }}>{getContent()}</View>
        </View>
      </View>
      <View style={{ flex: 1 }}></View>
    </LinearGradient>
  );

  return (
    <View style={{ ...Styles.menuScreen, flex: 1, flexDirection: "row" }}>
      {plan?.thumbnail ? (
        <ImageBackground source={{ uri: plan.thumbnail }} resizeMode="contain" style={{ flex: 1, width: "100%" }}>
          {contentOverlay}
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={["#1a0f17", "#3d1a36", "#0f0a16"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, width: "100%" }}
        >
          {contentOverlay}
        </LinearGradient>
      )}
    </View>
  );
};
