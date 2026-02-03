import React from "react";
import { View, Text, TouchableHighlight, BackHandler } from "react-native";
import { Styles } from "../helpers";
import { MenuHeader } from "../components";
import { useEffect } from "react";

type Props = {
  navigateTo(page: string): void;
  sidebarState(state: boolean): void;
  sidebarExpanded?: boolean;
};

export const SelectPairingModeScreen = (props: Props) => {

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

  return (
    <View style={Styles.menuScreen}>
      <MenuHeader headerText="Select Pairing Mode" />
      <View style={{ ...Styles.menuWrapper, flex: 20, alignItems: "center", justifyContent: "center" }}>
        <TouchableHighlight
          style={{ ...Styles.menuClickable, marginBottom: 20, width: "60%" }}
          underlayColor={"#E91E63"}
          onPress={() => props.navigateTo("selectChurch")}
          hasTVPreferredFocus={true}
        >
          <Text style={Styles.whiteText}>Pair to Classroom</Text>
        </TouchableHighlight>

        <TouchableHighlight
          style={{ ...Styles.menuClickable, width: "60%" }}
          underlayColor={"#E91E63"}
          onPress={() => props.navigateTo("planPairing")}
        >
          <Text style={Styles.whiteText}>Pair to Plan</Text>
        </TouchableHighlight>
      </View>
    </View>
  );
};
