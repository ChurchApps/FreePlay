import React, { useEffect, useState } from "react";
import { View, Text, TouchableHighlight, BackHandler, Image } from "react-native";
import { useTranslation } from "react-i18next";
import Icon from "react-native-vector-icons/MaterialIcons";
import { SvgUri } from "react-native-svg";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { Styles, CachedData, Colors, Typography, ProviderAuthHelper, ProviderSettingsHelper } from "../helpers";
import { MenuHeader } from "../components";
import { getProvider, FREEPLAY_PROVIDER_IDS, getAvailableProviders } from "../providers";
import { isLocked } from "../branding";
import { ProviderInfo } from "../interfaces";

type Props = {
  navigateTo(page: string, data?: any): void;
  sidebarState: (state: boolean) => void;
  sidebarExpanded?: boolean;
  providerId: string;
};

type RowKey = "library" | "autoDownload" | "disconnect";

export const ProviderSettingsScreen = (props: Props) => {
  const { t } = useTranslation();
  const provider = getProvider(props.providerId);
  const providerInfo: ProviderInfo | undefined = getAvailableProviders(FREEPLAY_PROVIDER_IDS).find(p => p.id === props.providerId);

  const [libraryEnabled, setLibraryEnabled] = useState<boolean>(true);
  const [autoDownloadEnabled, setAutoDownloadEnabled] = useState<boolean>(false);
  const [focusedRow, setFocusedRow] = useState<RowKey | null>(null);

  const supportsAutoDownload = !!provider?.getCurrentPlan;

  useEffect(() => {
    let active = true;
    (async () => {
      const lib = await ProviderSettingsHelper.getLibraryEnabled(props.providerId);
      if (!active) return;
      setLibraryEnabled(lib);
      setAutoDownloadEnabled(ProviderSettingsHelper.isAutoDownloadEnabled(props.providerId));
    })();
    const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => {
      active = false;
      backHandler.remove();
    };
  }, [props.providerId]);

  const handleBack = () => {
    // Locked forks have no picker — bounce back through splash, which routes appropriately.
    props.navigateTo(isLocked ? "splash" : "providers");
    return true;
  };

  const toggleLibrary = async () => {
    const next = !libraryEnabled;
    setLibraryEnabled(next);
    await ProviderSettingsHelper.setLibraryEnabled(props.providerId, next);
  };

  const toggleAutoDownload = async () => {
    const next = !autoDownloadEnabled;
    setAutoDownloadEnabled(next);
    await ProviderSettingsHelper.setAutoDownloadEnabled(props.providerId, next);
  };

  const handleDisconnect = async () => {
    await ProviderAuthHelper.clearAuth(props.providerId);
    await ProviderAuthHelper.setConnectionState(props.providerId, false);
    await ProviderSettingsHelper.clearSettings(props.providerId);
    if (CachedData.providerId === props.providerId) {
      await ProviderSettingsHelper.setAutoDownloadEnabled(props.providerId, false);
    }
    CachedData.connectedProviders = CachedData.connectedProviders.filter(id => id !== props.providerId);
    CachedData.clearFocusMemory(`contentBrowser_${props.providerId}`);
    if (CachedData.activeProvider === props.providerId) CachedData.activeProvider = null;
    // Locked forks: re-route through splash so it lands on the auth screen for the locked provider.
    props.navigateTo(isLocked ? "splash" : "providers");
  };

  const renderLogo = () => {
    const logo = providerInfo?.logos?.dark;
    if (!logo) return null;
    const isSvg = logo.toLowerCase().endsWith(".svg");
    return (
      <View style={{ width: DimensionHelper.wp("12%"), height: DimensionHelper.hp("8%"), justifyContent: "center", alignItems: "center", marginRight: DimensionHelper.wp("2%") }}>
        {isSvg
          ? <SvgUri uri={logo} width="100%" height="100%" />
          : <Image source={{ uri: logo }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />}
      </View>
    );
  };

  const renderToggleRow = (key: RowKey, label: string, description: string, value: boolean, onPress: () => void, autoFocus = false) => {
    const isFocused = focusedRow === key;
    return (
      <TouchableHighlight
        testID={`provider-settings-${key}`}
        underlayColor={Colors.focusBackground}
        onPress={onPress}
        onFocus={() => setFocusedRow(key)}
        onBlur={() => setFocusedRow(prev => (prev === key ? null : prev))}
        hasTVPreferredFocus={autoFocus}
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: DimensionHelper.wp("1.5%"),
          marginBottom: DimensionHelper.hp("1.5%"),
          borderRadius: 8,
          borderWidth: 2,
          borderColor: isFocused ? Colors.primary : Colors.borderAccent,
          backgroundColor: Colors.surface
        }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <Icon name={value ? "check-box" : "check-box-outline-blank"} size={DimensionHelper.wp("3%")} color={value ? Colors.primary : Colors.textSubtle} />
          <View style={{ flex: 1, marginLeft: DimensionHelper.wp("1.5%") }}>
            <Text style={{ color: Colors.textPrimary, fontSize: Typography.titleLarge }}>{label}</Text>
            <Text style={{ color: Colors.textSubtle, fontSize: Typography.bodySmall, marginTop: 2 }}>{description}</Text>
          </View>
        </View>
      </TouchableHighlight>
    );
  };

  const renderDisconnectRow = () => {
    const isFocused = focusedRow === "disconnect";
    return (
      <TouchableHighlight
        testID="provider-settings-disconnect"
        underlayColor={Colors.pressedBackground}
        onPress={handleDisconnect}
        onFocus={() => setFocusedRow("disconnect")}
        onBlur={() => setFocusedRow(prev => (prev === "disconnect" ? null : prev))}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          padding: DimensionHelper.wp("1.5%"),
          marginTop: DimensionHelper.hp("2%"),
          borderRadius: 8,
          borderWidth: 2,
          borderColor: isFocused ? Colors.primary : Colors.borderAccent,
          backgroundColor: Colors.backgroundCard
        }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Icon name="link-off" size={DimensionHelper.wp("2.5%")} color={Colors.error} />
          <Text style={{ color: Colors.error, fontSize: Typography.titleLarge, marginLeft: DimensionHelper.wp("1%") }}>{t("providerSettings.disconnect")}</Text>
        </View>
      </TouchableHighlight>
    );
  };

  const headerText = providerInfo?.name || t("providerSettings.header");

  return (
    <View style={{ ...Styles.menuScreen }} testID="provider-settings-root">
      <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: Colors.borderAccent, backgroundColor: Colors.surface, paddingHorizontal: DimensionHelper.wp("1%") }}>
        {renderLogo()}
        <View style={{ flex: 1 }}>
          <MenuHeader headerText={headerText} noBorder />
        </View>
      </View>
      <View style={{ ...Styles.menuWrapper, flex: 1, padding: DimensionHelper.wp("2%") }}>
        {renderToggleRow(
          "library",
          t("providerSettings.library.label"),
          t("providerSettings.library.description"),
          libraryEnabled,
          toggleLibrary,
          true
        )}
        {supportsAutoDownload && renderToggleRow(
          "autoDownload",
          t("providerSettings.autoDownload.label"),
          t("providerSettings.autoDownload.description"),
          autoDownloadEnabled,
          toggleAutoDownload
        )}
        {renderDisconnectRow()}
      </View>
    </View>
  );
};
