// Render SettingsScreen as a plain function call with hooks stubbed, then press the calendar row on a paired TV.
const mockScheduled = true;
const mockAlert = jest.fn();
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useState: (init: any) => [init, () => {}],
  useEffect: () => {}
}));
jest.mock("react-native", () => ({
  Dimensions: { get: () => ({ width: 1920, height: 1080 }), addEventListener: () => ({ remove: () => {} }) },
  Platform: { OS: "android", isTV: true, select: (o: any) => o.android ?? o.default },
  StyleSheet: { create: (s: any) => s, flatten: (s: any) => s },
  View: "View",
  Text: "Text",
  TouchableHighlight: "TouchableHighlight",
  BackHandler: { addEventListener: () => ({ remove: () => {} }) },
  Alert: { alert: (...args: any[]) => mockAlert(...args) }
}));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("react-native-vector-icons/MaterialIcons", () => "Icon");
jest.mock("../../helpers", () => {
  const styles = jest.requireActual("../../helpers/Styles");
  return {
    Styles: styles.Styles,
    Colors: styles.Colors,
    Typography: styles.Typography,
    ScheduleSync: { isScheduled: () => mockScheduled, manifest: { screenGroupName: "Room 4" }, unpair: jest.fn() }
  };
});
jest.mock("../../components", () => ({ MenuHeader: "MenuHeader" }));
jest.mock("../../branding", () => ({ ...jest.requireActual("../../branding"), isLocked: false }));

import { SettingsScreen } from "../SettingsScreen";

function find(node: any, testID: string): any {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const f = find(n, testID); if (f) return f; } return null; }
  if (node.props?.testID === testID) return node;
  return find(node.props?.children, testID);
}

describe("SettingsScreen calendar row on a paired TV", () => {
  it("offers a way back to the mockScheduled player", () => {
    const navigateTo = jest.fn();
    const tree = SettingsScreen({ navigateTo, sidebarState: () => {} }) as any;
    find(tree, "settings-calendar").props.onPress();
    const buttons = mockAlert.mock.calls[0][2];
    buttons[0].onPress?.();
    expect(buttons[0].text).toBe("settings.calendar.backToSchedule");
    expect(navigateTo).toHaveBeenCalledWith("scheduledPlayer");
  });
});
