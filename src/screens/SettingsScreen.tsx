import React, { useEffect, useState } from "react";
import { View, Text, TouchableHighlight, BackHandler } from "react-native";
import { useTranslation } from "react-i18next";
import Icon from "react-native-vector-icons/MaterialIcons";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { Styles, Colors, Typography } from "../helpers";
import { MenuHeader } from "../components";
import { isLocked } from "../branding";

type Props = {
  navigateTo(page: string, data?: any): void;
  sidebarState: (state: boolean) => void;
  sidebarExpanded?: boolean;
};

export const SettingsScreen = (props: Props) => {
  const { t } = useTranslation();
  const [focusedRow, setFocusedRow] = useState<string | null>(null);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => { props.sidebarState(true); return true; });
    return () => backHandler.remove();
  }, []);

  const rows = [
    { key: "downloads", icon: "file-download" },
    // Locked forks have a single fixed provider, so there is no picker to open
    ...(isLocked ? [] : [{ key: "providers", icon: "extension" }])
  ];

  return (
    <View style={{ ...Styles.menuScreen }} testID="settings-root">
      <MenuHeader headerText={t("nav.settings")} />
      <View style={{ ...Styles.menuWrapper, flex: 90, padding: DimensionHelper.wp("2%") }}>
        {rows.map((row, index) => (
          <TouchableHighlight
            key={row.key}
            testID={`settings-${row.key}`}
            underlayColor={Colors.focusBackground}
            onPress={() => props.navigateTo(row.key)}
            onFocus={() => setFocusedRow(row.key)}
            onBlur={() => setFocusedRow(prev => (prev === row.key ? null : prev))}
            hasTVPreferredFocus={!props.sidebarExpanded && index === 0}
            style={{
              padding: DimensionHelper.wp("1.5%"),
              marginBottom: DimensionHelper.hp("1.5%"),
              borderRadius: 8,
              borderWidth: 2,
              borderColor: focusedRow === row.key ? Colors.primary : Colors.borderAccent,
              backgroundColor: Colors.surface
            }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Icon name={row.icon} size={DimensionHelper.wp("3%")} color={Colors.textSubtle} />
              <View style={{ flex: 1, marginLeft: DimensionHelper.wp("1.5%") }}>
                <Text style={{ color: Colors.textPrimary, fontSize: Typography.titleLarge }}>{t(`settings.${row.key}.label`)}</Text>
                <Text style={{ color: Colors.textSubtle, fontSize: Typography.bodySmall, marginTop: 2 }}>{t(`settings.${row.key}.description`)}</Text>
              </View>
            </View>
          </TouchableHighlight>
        ))}
      </View>
    </View>
  );
};
