import React, { useState, useEffect } from "react";
import { View, Text, TouchableHighlight, BackHandler } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import LinearGradient from "react-native-linear-gradient";
import { Styles, Colors } from "../helpers";
import { DimensionHelper } from "../helpers/DimensionHelper";
import { MenuHeader } from "../components";

type Props = {
  navigateTo(page: string): void;
  sidebarState(state: boolean): void;
  sidebarExpanded?: boolean;
};

export const SelectPairingModeScreen = (props: Props) => {
  const [focusedCard, setFocusedCard] = useState<string | null>(null);

  const handleBack = () => {
    props.sidebarState(true);
  };

  const init = () => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  };

  useEffect(init, []);

  const getCard = (id: string, icon: string, title: string, description: string, onPress: () => void, autoFocus: boolean) => {
    const isFocused = focusedCard === id;
    return (
      <TouchableHighlight
        style={{
          flex: 1,
          marginHorizontal: DimensionHelper.wp("2%"),
          borderRadius: 12
        }}
        underlayColor={Colors.pressedBackground}
        onPress={onPress}
        onFocus={() => setFocusedCard(id)}
        onBlur={() => setFocusedCard(prev => prev === id ? null : prev)}
        hasTVPreferredFocus={autoFocus && !props.sidebarExpanded}
      >
        <LinearGradient
          colors={["#2d1f2d", "#1a1118"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            borderRadius: 12,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: DimensionHelper.hp("4%"),
            paddingHorizontal: DimensionHelper.wp("3%"),
            borderWidth: isFocused ? 2 : 1,
            borderColor: isFocused ? Colors.primary : "rgba(233,30,99,0.15)",
            ...(isFocused ? { transform: [{ scale: 1.03 }] } : {})
          }}
        >
          <View style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: 40,
            padding: DimensionHelper.wp("2%"),
            marginBottom: DimensionHelper.hp("2%")
          }}>
            <Icon name={icon} size={DimensionHelper.wp("5%")} color={Colors.textSubtle} />
          </View>
          <Text style={{
            color: Colors.textPrimary,
            fontSize: DimensionHelper.wp("2%"),
            fontWeight: "600",
            marginBottom: DimensionHelper.hp("1%"),
            textAlign: "center"
          }}>
            {title}
          </Text>
          <Text style={{
            color: Colors.textDimmed,
            fontSize: DimensionHelper.wp("1.3%"),
            textAlign: "center",
            lineHeight: DimensionHelper.wp("2%")
          }}>
            {description}
          </Text>
        </LinearGradient>
      </TouchableHighlight>
    );
  };

  return (
    <View style={Styles.menuScreen}>
      <MenuHeader headerText="Select Pairing Mode" />
      <View style={{
        ...Styles.menuWrapper,
        flex: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: DimensionHelper.wp("10%")
      }}>
        {getCard(
          "classroom",
          "tv",
          "Pair to Classroom",
          "Connect to a specific classroom TV and display scheduled lessons automatically",
          () => props.navigateTo("selectChurch"),
          true
        )}
        {getCard(
          "plan",
          "event-note",
          "Pair to Plan",
          "Follow your church's weekly plan and browse content on demand",
          () => props.navigateTo("planPairing"),
          false
        )}
      </View>
    </View>
  );
};
