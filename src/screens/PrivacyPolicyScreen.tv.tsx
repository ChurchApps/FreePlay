import { View, Text, ScrollView } from "react-native";
import React from "react";
import { useTranslation } from "react-i18next";
import { MenuHeader } from "../components";
import { Styles } from "../helpers";

type Props = { navigateTo(page: string, data?:any): void; };
const PrivacyPolicyScreen = (props : Props) => {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1 }}>
      <MenuHeader headerText={t("privacyPolicy.header")} showBackbutton={true} onpress={()=>props.navigateTo("settings")}/>
      <ScrollView style={{ flex: 1, padding: 20 }}>
        <Text style={[Styles.whiteText, { textAlign: "left", marginBottom: 20 }]}>
          {t("privacyPolicy.viewFullPolicy")}
        </Text>
        <Text style={[Styles.H2, { textAlign: "left" }]}>
          {t("privacyPolicy.url")}
        </Text>
      </ScrollView>
    </View>
  );
};

export default PrivacyPolicyScreen;
