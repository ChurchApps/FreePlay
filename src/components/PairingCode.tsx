import React from "react";
import { View, Text } from "react-native";
import { Colors, Typography } from "../helpers";
import { DimensionHelper } from "../helpers/DimensionHelper";

type Props = {
  code: string;
};

export const PairingCode = ({ code }: Props) => (
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    {code.split("").map((char, index) =>
      char === "-" ? (
        <Text
          key={index}
          style={{
            fontSize: Typography.displayCode,
            color: Colors.textDimmed,
            alignSelf: "center",
            marginHorizontal: DimensionHelper.wp("0.5%")
          }}>
          -
        </Text>
      ) : (
        <View
          key={index}
          style={{
            backgroundColor: Colors.hoverBackground,
            borderRadius: DimensionHelper.wp("1%"),
            paddingVertical: DimensionHelper.hp("2%"),
            paddingHorizontal: DimensionHelper.wp("2.5%"),
            marginHorizontal: DimensionHelper.wp("0.4%"),
            borderWidth: 1,
            borderColor: Colors.borderAccent
          }}>
          <Text
            style={{
              fontSize: Typography.displayCode,
              fontWeight: "800",
              fontFamily: "monospace",
              color: Colors.primary,
              textShadowColor: "rgba(233, 30, 99, 0.5)",
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 20
            }}>
            {char}
          </Text>
        </View>
      ))}
  </View>
);
