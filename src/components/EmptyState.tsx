import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { Colors } from "../helpers/Styles";
import { DimensionHelper } from "../helpers/DimensionHelper";

type Props = {
  icon?: string;
  message: string;
  subMessage?: string;
};

export const EmptyState = ({ icon = "inbox", message, subMessage }: Props) => (
  <View style={styles.container}>
    <View style={styles.backplate}>
      <Icon name={icon} size={DimensionHelper.wp("5%")} color={Colors.textDimmed} />
    </View>
    <Text style={styles.message}>{message}</Text>
    {subMessage && <Text style={styles.subMessage}>{subMessage}</Text>}
  </View>
);

const BACKPLATE_SIZE = DimensionHelper.wp("10%");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: DimensionHelper.wp("5%")
  },
  backplate: {
    width: BACKPLATE_SIZE,
    height: BACKPLATE_SIZE,
    borderRadius: BACKPLATE_SIZE / 2,
    backgroundColor: Colors.hoverBackground,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    alignItems: "center",
    justifyContent: "center"
  },
  message: {
    color: Colors.textSubtle,
    fontSize: DimensionHelper.wp("2%"),
    textAlign: "center",
    marginTop: DimensionHelper.hp("2%")
  },
  subMessage: {
    color: Colors.textDimmed,
    fontSize: DimensionHelper.wp("1.4%"),
    textAlign: "center",
    marginTop: DimensionHelper.hp("1%")
  }
});
