// Render ContentBrowserScreen as a plain function call with hooks stubbed, then check the FlatList it mounts.
// React reuses the skeleton's native list for the real one, so both must pin removeClippedSubviews to false:
// leaving it undefined (Android's default) and flipping it later drops every tile on Android TV.
let mockState: any[] = [];
jest.mock("react", () => {
  const actual = jest.requireActual("react");
  let call = 0;
  return {
    ...actual,
    useState: (init: any) => {
      const value = call < mockState.length ? mockState[call] : init;
      call++;
      return [value, () => {}];
    },
    useRef: (init: any) => ({ current: init }),
    useEffect: () => {},
    __resetCalls: () => { call = 0; }
  };
});
jest.mock("react-native", () => ({
  Dimensions: { get: () => ({ width: 1920, height: 1080 }), addEventListener: () => ({ remove: () => {} }) },
  Platform: { OS: "android", isTV: true, select: (o: any) => o.android ?? o.default },
  StyleSheet: { create: (s: any) => s, flatten: (s: any) => s },
  ActivityIndicator: "ActivityIndicator",
  Image: "Image",
  View: "View",
  FlatList: "FlatList",
  Text: "Text",
  TouchableHighlight: "TouchableHighlight",
  BackHandler: { addEventListener: () => ({ remove: () => {} }) }
}));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("react-native-vector-icons/MaterialIcons", () => "Icon");
jest.mock("react-native-svg", () => ({ SvgUri: "SvgUri" }));
jest.mock("../../helpers", () => {
  const styles = jest.requireActual("../../helpers/Styles");
  return {
    Styles: styles.Styles,
    Colors: styles.Colors,
    Typography: styles.Typography,
    CachedData: { lastFocusedIndex: {}, savedFocusIndex: () => undefined },
    ProviderAuthHelper: {},
    ProviderSettingsHelper: {},
    AnnouncementsHelper: {}
  };
});
jest.mock("../../components", () => ({ MenuHeader: "MenuHeader", SkeletonCard: "SkeletonCard", EmptyState: "EmptyState" }));
jest.mock("../../providers", () => ({ getProvider: () => ({ name: "Test Provider", logos: { dark: "" } }) }));

import React from "react";
import { ContentBrowserScreen } from "../ContentBrowserScreen";

function findType(node: any, type: string): any {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const f = findType(n, type); if (f) return f; } return null; }
  if (node.type === type) return node;
  return findType(node.props?.children, type);
}

function render(state: any[]) {
  mockState = state;
  (React as any).__resetCalls();
  return ContentBrowserScreen({ navigateTo: () => {}, sidebarState: () => {}, providerId: "test" }) as any;
}

describe("ContentBrowserScreen list on Android TV", () => {
  it("mounts the skeleton list with subview clipping off", () => {
    const list = findType(render([]), "FlatList");
    expect(list.props.data[0].id).toBe("skeleton-0");
    expect(list.props.removeClippedSubviews).toBe(false);
  });

  it("keeps subview clipping off once the items load", () => {
    const items = [{ type: "folder", id: "f1", title: "Folder 1", path: "/f1" }];
    const list = findType(render([items, false]), "FlatList");
    expect(list.props.data).toBe(items);
    expect(list.props.removeClippedSubviews).toBe(false);
  });
});
