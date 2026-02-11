import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableHighlight,
  BackHandler,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { Styles, CachedData, ProviderAuthHelper } from "../helpers";
import { ContentProviderAuthData } from "../interfaces";
import { DimensionHelper } from "../helpers/DimensionHelper";
import LinearGradient from "react-native-linear-gradient";
import { getProvider } from "../providers";

type Props = {
  navigateTo(page: string, data?: any): void;
  sidebarState(state: boolean): void;
  sidebarExpanded?: boolean;
  providerId: string;
};

type FlowState =
  | {status: "idle"}
  | {status: "loading"}
  | {status: "error"; message: string}
  | {status: "success"};

export const ProviderFormLoginScreen = (props: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [flowState, setFlowState] = useState<FlowState>({ status: "idle" });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const passwordRef = useRef<TextInput>(null);

  const provider = getProvider(props.providerId);
  const providerConfig = provider?.config;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();

    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  const handleBack = () => {
    props.sidebarState(true);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setFlowState({ status: "error", message: "Please enter email and password" });
      return;
    }

    setFlowState({ status: "loading" });

    try {
      if (!provider) {
        setFlowState({ status: "error", message: "Provider not found" });
        return;
      }

      const providerAny = provider as any;
      if (typeof providerAny.performLogin !== "function") {
        setFlowState({ status: "error", message: "This provider does not support form login" });
        return;
      }

      const auth: ContentProviderAuthData | null = await providerAny.performLogin(
        email.trim(),
        password
      );

      if (auth) {
        await ProviderAuthHelper.setAuth(props.providerId, auth);
        setFlowState({ status: "success" });

        if (!CachedData.connectedProviders.includes(props.providerId)) {
          CachedData.connectedProviders.push(props.providerId);
        }
        CachedData.activeProvider = props.providerId;

        setTimeout(() => {
          props.navigateTo("contentBrowser", { providerId: props.providerId, folderStack: [] });
        }, 1000);
      } else {
        setFlowState({ status: "error", message: "Login failed. Check your credentials." });
      }
    } catch (error) {
      console.error("Form login error:", error);
      setFlowState({ status: "error", message: "An unexpected error occurred. Please try again." });
    }
  };

  // Loading state
  if (flowState.status === "loading") {
    return (
      <View style={Styles.menuScreen}>
        <LinearGradient
          colors={["#1a0f17", "#160a14", "#100714"]}
          style={{
            flex: 1,
            width: "100%",
            alignItems: "center",
            justifyContent: "center"
          }}>
          <ActivityIndicator size="large" color="#E91E63" />
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: DimensionHelper.wp("1.8%"),
              marginTop: DimensionHelper.hp("3%"),
              letterSpacing: 1
            }}>
            Logging in...
          </Text>
        </LinearGradient>
      </View>
    );
  }

  // Success state
  if (flowState.status === "success") {
    return (
      <View style={Styles.menuScreen}>
        <LinearGradient
          colors={["#1a0f17", "#160a14", "#100714"]}
          style={{
            flex: 1,
            width: "100%",
            alignItems: "center",
            justifyContent: "center"
          }}>
          <Text
            style={{
              color: "#4CAF50",
              fontSize: DimensionHelper.wp("3%"),
              fontWeight: "bold"
            }}>
            Connected!
          </Text>
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: DimensionHelper.wp("1.6%"),
              marginTop: DimensionHelper.hp("2%")
            }}>
            Loading your content...
          </Text>
        </LinearGradient>
      </View>
    );
  }

  // Main login form
  return (
    <View style={Styles.menuScreen}>
      <LinearGradient
        colors={["#1a0f17", "#160a14", "#0d0510"]}
        style={{ flex: 1, width: "100%" }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}>
          <Animated.View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              opacity: fadeAnim,
              paddingHorizontal: DimensionHelper.wp("5%")
            }}>
            {/* Provider name */}
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: DimensionHelper.wp("2.5%"),
                fontWeight: "600",
                marginBottom: DimensionHelper.hp("1%")
              }}>
              Login to {providerConfig?.name || "Provider"}
            </Text>

            {/* Instructions */}
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.5)",
                fontSize: DimensionHelper.wp("1.4%"),
                letterSpacing: 0.5,
                marginBottom: DimensionHelper.hp("4%"),
                textAlign: "center"
              }}>
              Enter your credentials to connect
            </Text>

            {/* Error message */}
            {flowState.status === "error" && (
              <View
                style={{
                  backgroundColor: "rgba(233, 30, 99, 0.1)",
                  borderRadius: 8,
                  padding: DimensionHelper.hp("1.5%"),
                  marginBottom: DimensionHelper.hp("2%"),
                  width: "100%",
                  maxWidth: 400
                }}>
                <Text
                  style={{
                    color: "#ff6b6b",
                    fontSize: DimensionHelper.wp("1.3%"),
                    textAlign: "center"
                  }}>
                  {flowState.message}
                </Text>
              </View>
            )}

            {/* Login Form */}
            <View
              style={{
                width: "100%",
                maxWidth: 400
              }}>
              {/* Email input */}
              <View style={{ marginBottom: DimensionHelper.hp("2%") }}>
                <Text
                  style={{
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: DimensionHelper.wp("1.2%"),
                    marginBottom: DimensionHelper.hp("0.5%")
                  }}>
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(233, 30, 99, 0.2)",
                    borderRadius: 8,
                    padding: DimensionHelper.hp("1.5%"),
                    color: "#fff",
                    fontSize: DimensionHelper.wp("1.4%")
                  }}
                />
              </View>

              {/* Password input */}
              <View style={{ marginBottom: DimensionHelper.hp("3%") }}>
                <Text
                  style={{
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: DimensionHelper.wp("1.2%"),
                    marginBottom: DimensionHelper.hp("0.5%")
                  }}>
                  Password
                </Text>
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  secureTextEntry
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(233, 30, 99, 0.2)",
                    borderRadius: 8,
                    padding: DimensionHelper.hp("1.5%"),
                    color: "#fff",
                    fontSize: DimensionHelper.wp("1.4%")
                  }}
                />
              </View>

              {/* Login button */}
              <TouchableHighlight
                onPress={handleLogin}
                underlayColor="rgba(233, 30, 99, 0.8)"
                hasTVPreferredFocus={true}
                style={{
                  backgroundColor: "#E91E63",
                  paddingVertical: DimensionHelper.hp("2%"),
                  borderRadius: 8,
                  alignItems: "center"
                }}>
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: DimensionHelper.wp("1.6%"),
                    fontWeight: "600",
                    letterSpacing: 0.5
                  }}>
                  Sign In
                </Text>
              </TouchableHighlight>
            </View>
          </Animated.View>

          {/* Cancel button at bottom */}
          <View
            style={{
              position: "absolute",
              bottom: DimensionHelper.hp("4%"),
              left: 0,
              right: 0,
              alignItems: "center"
            }}>
            <TouchableHighlight
              onPress={handleBack}
              underlayColor="rgba(255, 255, 255, 0.1)"
              hasTVPreferredFocus={false}
              style={{
                paddingVertical: DimensionHelper.hp("1%"),
                paddingHorizontal: DimensionHelper.wp("2%"),
                borderRadius: 4
              }}>
              <Text
                style={{
                  color: "rgba(255, 255, 255, 0.35)",
                  fontSize: DimensionHelper.wp("1.2%"),
                  letterSpacing: 0.3
                }}>
                Cancel
              </Text>
            </TouchableHighlight>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
};
