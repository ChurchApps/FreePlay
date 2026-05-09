import React from "react";
import { View, Text, TouchableHighlight, BackHandler } from "react-native";
import { withTranslation, WithTranslation } from "react-i18next";
import { Colors, Typography } from "../helpers";
import { DimensionHelper } from "../helpers/DimensionHelper";
import Icon from "react-native-vector-icons/MaterialIcons";

type Props = WithTranslation & {
  children: React.ReactNode;
  onBack: () => void;
};

type State = { hasError: boolean };

class PlayerErrorBoundaryInner extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("PlayerErrorBoundary caught:", error, info?.componentStack);
  }

  componentDidMount() {
    this.backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (this.state.hasError) {
        this.props.onBack();
        return true;
      }
      return false;
    });
  }

  componentWillUnmount() {
    this.backHandler?.remove();
  }

  private backHandler: ReturnType<typeof BackHandler.addEventListener> | null = null;

  render() {
    if (!this.state.hasError) return this.props.children;

    const { t } = this.props;
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center"
        }}>
        <Icon name="error-outline" size={DimensionHelper.wp("6%")} color={Colors.error} />
        <Text
          style={{
            color: Colors.error,
            fontSize: Typography.heading3,
            fontWeight: "bold",
            marginTop: DimensionHelper.hp("2%")
          }}>
          {t("message.playbackFailed")}
        </Text>
        <Text
          style={{
            color: "rgba(255, 255, 255, 0.6)",
            fontSize: Typography.bodySmall,
            marginTop: DimensionHelper.hp("1.5%")
          }}>
          {t("message.playbackFailedSub")}
        </Text>
        <TouchableHighlight
          onPress={this.props.onBack}
          underlayColor={Colors.pressedBackground}
          hasTVPreferredFocus={true}
          style={{
            marginTop: DimensionHelper.hp("4%"),
            backgroundColor: Colors.primary,
            paddingVertical: DimensionHelper.hp("1.5%"),
            paddingHorizontal: DimensionHelper.wp("4%"),
            borderRadius: 8
          }}>
          <Text
            style={{
              color: Colors.textPrimary,
              fontSize: Typography.bodyMedium,
              fontWeight: "600"
            }}>
            {t("menu.back")}
          </Text>
        </TouchableHighlight>
      </View>
    );
  }
}

export const PlayerErrorBoundary = withTranslation()(PlayerErrorBoundaryInner);
