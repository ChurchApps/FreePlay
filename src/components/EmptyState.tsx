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
    <Icon name={icon} size={DimensionHelper.wp("5%")} color={Colors.textDimmed} />
    <Text style={styles.message}>{message}</Text>
    {subMessage && <Text style={styles.subMessage}>{subMessage}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: DimensionHelper.wp("5%")
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
