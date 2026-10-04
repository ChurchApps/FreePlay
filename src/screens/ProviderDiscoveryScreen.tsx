import React, { useEffect } from "react";
import {
  View,
  FlatList,
  TouchableHighlight,
  BackHandler,
  Text,
  ActivityIndicator,
  Alert
} from "react-native";
import { useTranslation } from "react-i18next";
import Icon from "react-native-vector-icons/MaterialIcons";
import LinearGradient from "react-native-linear-gradient";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { Styles, CachedData, ProviderAuthHelper, ProviderSettingsHelper, Colors, Typography, PlanSync } from "../helpers";
import { MenuHeader } from "../components";
import { getProvider, networkInstanceToAuth } from "../providers";
import { NetworkInstance } from "../interfaces";

type Props = {
  navigateTo(page: string, data?: any): void;
  sidebarState: (state: boolean) => void;
  sidebarExpanded?: boolean;
  providerId: string;
};

export const ProviderDiscoveryScreen = (props: Props) => {
  const { t } = useTranslation();
  const [instances, setInstances] = React.useState<NetworkInstance[]>([]);
  const [scanning, setScanning] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const initialFocusSet = React.useRef(false);

  const provider = getProvider(props.providerId);

  const scan = async () => {
    if (!provider?.discoverInstances) {
      setError(t("providerDiscovery.notSupported"));
      setScanning(false);
      return;
    }
    setScanning(true);
    setError(null);
    setInstances([]);
    try {
      const found = await provider.discoverInstances();
      setInstances(found);
      if (found.length === 0) setError(t("providerDiscovery.noneFound"));
    } catch (err) {
      console.error("FreeShow discovery failed", err);
      setError(t("providerDiscovery.scanFailed"));
    } finally {
      setScanning(false);
    }
  };

  const connectAndNavigate = async (instance: NetworkInstance) => {
    const auth = networkInstanceToAuth(instance);
    await ProviderAuthHelper.setAuth(props.providerId, auth);
    await ProviderAuthHelper.setConnectionState(props.providerId, true);
    await ProviderSettingsHelper.setLibraryEnabled(props.providerId, true);
    if (!CachedData.connectedProviders.includes(props.providerId)) {
      CachedData.connectedProviders.push(props.providerId);
    }
    CachedData.activeProvider = props.providerId;
    if (!CachedData.providerId && provider?.getCurrentPlan) {
      CachedData.providerId = props.providerId;
      await CachedData.setAsyncStorage("providerId", props.providerId);
      PlanSync.syncCurrentPlan();
    }
    props.navigateTo("contentBrowser", { providerId: props.providerId, folderStack: [] });
  };

  const handleSelect = async (instance: NetworkInstance) => {
    try {
      await connectAndNavigate(instance);
    } catch (err) {
      console.error("Failed to connect FreeShow instance", err);
      Alert.alert(t("providers.errorAlert.title"), t("providerDiscovery.connectFailed"));
    }
  };

  const handleBack = () => {
    props.navigateTo("providers");
    return true;
  };

  useEffect(() => {
    scan();
    const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => backHandler.remove();
  }, []);

  const renderInstance = (data: { item: NetworkInstance; index: number }) => {
    const instance = data.item;
    const isFocused = focusedId === instance.id;
    const shouldFocus = !props.sidebarExpanded && !initialFocusSet.current && data.index === 0;

    return (
      <TouchableHighlight
        testID={`providerDiscovery-instance-${instance.id}${isFocused ? "-focused" : ""}`}
        style={{ flex: 1, maxWidth: "50%", padding: 10, borderRadius: 12 }}
        underlayColor={Colors.pressedBackground}
        onPress={() => handleSelect(instance)}
        onFocus={() => { initialFocusSet.current = true; setFocusedId(instance.id); }}
        onBlur={() => { setFocusedId(prev => prev === instance.id ? null : prev); }}
        hasTVPreferredFocus={shouldFocus}>
        <LinearGradient
          colors={["#2d1f2d", "#1a1118"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            minHeight: DimensionHelper.hp("18%"),
            borderRadius: 8,
            padding: DimensionHelper.wp("2%"),
            justifyContent: "center",
            borderWidth: 2,
            borderColor: isFocused ? Colors.primary : Colors.borderAccent
          }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Icon name="tv" size={DimensionHelper.wp("2.4%")} color={Colors.primaryLight} />
            <Text
              style={{
                color: Colors.textPrimary,
                fontSize: DimensionHelper.wp("1.8%"),
                marginLeft: 12,
                flex: 1
              }}
              numberOfLines={1}>
              {instance.name}
            </Text>
          </View>
          <Text style={{ color: Colors.textSecondary, fontSize: Typography.labelSmall }}>
            {instance.ip}:{instance.port}
          </Text>
        </LinearGradient>
      </TouchableHighlight>
    );
  };

  const body = () => {
    if (scanning) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.textPrimary, fontSize: Typography.body, marginTop: 16 }}>
            {t("providerDiscovery.scanning")}
          </Text>
          <Text style={{ color: Colors.textSecondary, fontSize: Typography.labelSmall, marginTop: 8 }}>
            {t("providerDiscovery.scanningHint")}
          </Text>
        </View>
      );
    }

    if (instances.length === 0) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: DimensionHelper.wp("8%") }}>
          <Icon name="wifi-off" size={48} color={Colors.textDimmed} />
          <Text style={{ color: Colors.textPrimary, fontSize: Typography.body, marginTop: 16, textAlign: "center" }}>
            {error || t("providerDiscovery.noneFound")}
          </Text>
          <TouchableHighlight
            testID="providerDiscovery-rescan"
            style={{
              marginTop: 24,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
              backgroundColor: Colors.primaryDark,
              borderWidth: 2,
              borderColor: Colors.primary
            }}
            underlayColor={Colors.primary}
            onPress={scan}
            hasTVPreferredFocus={true}>
            <Text style={{ color: Colors.textPrimary, fontSize: Typography.body }}>{t("providerDiscovery.rescan")}</Text>
          </TouchableHighlight>
        </View>
      );
    }

    return (
      <FlatList
        data={instances}
        numColumns={2}
        keyExtractor={item => item.id}
        renderItem={renderInstance}
        extraData={focusedId}
        contentContainerStyle={{ padding: DimensionHelper.wp("1%") }}
      />
    );
  };

  return (
    <View style={{ ...Styles.menuScreen }} testID="providerDiscovery-root">
      <MenuHeader headerText={t("providerDiscovery.header", { name: provider?.name || "FreeShow" })} />
      <View style={{ ...Styles.menuWrapper, flex: 90 }}>{body()}</View>
    </View>
  );
};
