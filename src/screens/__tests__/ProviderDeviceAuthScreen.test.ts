import React from "react";

// Render the code screen (status "code") as a plain function call and walk the element tree.
// Hooks are stubbed so no renderer is needed; host components are plain strings.
const CODE_STATE = {
  status: "code",
  deviceAuth: { device_code: "d", user_code: "ABCD-EFGH", verification_uri: "https://b1.church/device", expires_in: 900, interval: 5 }
};
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useState: (init: any) => [init && init.status === "loading" ? CODE_STATE : init, () => {}],
  useRef: (init: any) => ({ current: init }),
  useEffect: () => {}
}));
jest.mock("react-native", () => ({
  Dimensions: { get: () => ({ width: 1920, height: 1080 }), addEventListener: () => ({ remove: () => {} }) },
  Platform: { OS: "android", isTV: true, select: (o: any) => o.android ?? o.default },
  StyleSheet: { create: (s: any) => s, flatten: (s: any) => s },
  View: "View",
  Text: "Text",
  TouchableHighlight: "TouchableHighlight",
  ActivityIndicator: "ActivityIndicator",
  BackHandler: { addEventListener: () => ({ remove: () => {} }) },
  Animated: { View: "Animated.View", Value: function () {}, loop: () => ({ start: () => {} }), sequence: () => ({}), timing: () => ({ start: () => {} }) },
  Easing: { inOut: () => {}, out: () => {}, sin: () => {}, cubic: () => {} }
}));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("react-native-linear-gradient", () => "LinearGradient");
jest.mock("react-native-qrcode-svg", () => "QRCode");
jest.mock("../../helpers", () => {
  const styles = jest.requireActual("../../helpers/Styles");
  return { Styles: styles.Styles, Colors: styles.Colors, Typography: styles.Typography, CachedData: {}, ProviderAuthHelper: {} };
});
jest.mock("../../helpers/SoundHelper", () => ({ SoundHelper: {} }));
jest.mock("../../interfaces", () => ({ DeviceFlowHelper: function () {} }));
jest.mock("../../providers", () => ({ getProvider: () => ({ config: { name: "B1.Church" } }) }));
jest.mock("../../components", () => jest.requireActual("../../components/PairingCode"));

import { ProviderDeviceAuthScreen } from "../ProviderDeviceAuthScreen";

const SCREEN_HEIGHT = 1080;

type Node = { type: any; props: any };

function renderCodeState(): Node {
  return ProviderDeviceAuthScreen({ navigateTo: () => {}, sidebarState: () => {}, providerId: "b1church" }) as any;
}

function expand(node: any): any {
  if (node == null || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map(expand);
  if (typeof node.type === "function") return expand(node.type(node.props));
  if (node.type === React.Fragment) return expand(node.props.children);
  return { type: node.type, props: { ...node.props, children: expand(node.props.children) } };
}

const kids = (n: Node): any[] => [n.props.children].flat(Infinity).filter((c) => c != null);
const style = (n: Node) => Object.assign({}, ...[n.props.style].flat().filter(Boolean));
const text = (n: any): string => (typeof n === "string" || typeof n === "number" ? String(n) : n && n.props ? kids(n).map(text).join("") : "");

function find(n: any, pred: (n: Node) => boolean, path: Node[] = []): Node[] | null {
  if (!n || typeof n !== "object" || !n.props) return null;
  if (pred(n)) return [...path, n];
  for (const c of kids(n)) {
    const r = find(c, pred, [...path, n]);
    if (r) return r;
  }
  return null;
}

// Rough column layout: text lines at 1.2x font size, padding/margin/border, row = tallest child.
function height(n: any): number {
  if (!n || typeof n !== "object" || !n.props) return 0;
  const s = style(n);
  const vPad = (s.paddingTop ?? s.paddingVertical ?? s.padding ?? 0) + (s.paddingBottom ?? s.paddingVertical ?? s.padding ?? 0);
  const vMargin = (s.marginTop ?? s.marginVertical ?? 0) + (s.marginBottom ?? s.marginVertical ?? 0);
  const border = (s.borderWidth ?? 0) * 2;
  let content: number;
  if (n.type === "Text") content = (s.fontSize ?? 14) * 1.2 * (text(n).split("\n").length);
  else if (n.type === "QRCode") content = n.props.size;
  else if (s.height != null) content = s.height;
  else {
    const hs = kids(n).map(height);
    content = s.flexDirection === "row" ? Math.max(0, ...hs) : hs.reduce((a, b) => a + b, 0);
  }
  return content + vPad + vMargin + border;
}

describe("ProviderDeviceAuthScreen code layout (issue #1305)", () => {
  it("puts Cancel in the same row as Generate New Code, not pinned over the column", () => {
    const tree = expand(renderCodeState());
    const cancelPath = find(tree, (n) => n.props.testID === "provider-device-auth-cancel");
    const regenPath = find(tree, (n) => n.type === "TouchableHighlight" && text(n) === "providerDeviceAuth.regenerate");
    expect(cancelPath).not.toBeNull();
    expect(regenPath).not.toBeNull();
    expect(cancelPath!.some((n) => style(n).position === "absolute")).toBe(false);
    const cancelParent = cancelPath![cancelPath!.length - 2];
    expect(regenPath![regenPath!.length - 2]).toBe(cancelParent);
    expect(style(cancelParent).flexDirection).toBe("row");
  });

  it("fits the centered column on a 1080p screen", () => {
    const tree = expand(renderCodeState());
    const column = find(tree, (n) => n.type === "Animated.View" && style(n).justifyContent === "center")!.pop()!;
    expect(height(column)).toBeLessThanOrEqual(SCREEN_HEIGHT * 0.95);
  });
});
