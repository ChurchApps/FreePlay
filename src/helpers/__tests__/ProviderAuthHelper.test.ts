import AsyncStorage from "@react-native-async-storage/async-storage";
import { getProvider, __tokenHelperMock } from "@churchapps/content-providers";
import { ProviderAuthHelper } from "../ProviderAuthHelper";

const tokenHelper = __tokenHelperMock as { isAuthValid: jest.Mock; refreshToken: jest.Mock };
const auth = { accessToken: "tok", expiresAt: 123 } as any;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("auth CRUD", () => {
  it("round-trips auth data per provider", async () => {
    await ProviderAuthHelper.setAuth("p1", auth);
    expect(await ProviderAuthHelper.getAuth("p1")).toEqual(auth);
    expect(await ProviderAuthHelper.getAuth("p2")).toBeNull();
  });

  it("clearAuth removes stored auth", async () => {
    await ProviderAuthHelper.setAuth("p1", auth);
    await ProviderAuthHelper.clearAuth("p1");
    expect(await ProviderAuthHelper.getAuth("p1")).toBeNull();
  });

  it("getAuth returns null on corrupt data", async () => {
    await AsyncStorage.setItem("provider_auth_p1", "{bad");
    expect(await ProviderAuthHelper.getAuth("p1")).toBeNull();
  });
});

describe("connection state", () => {
  it("persists per-provider connection flags", async () => {
    await ProviderAuthHelper.setConnectionState("p1", true);
    await ProviderAuthHelper.setConnectionState("p2", false);
    expect(await ProviderAuthHelper.getConnectionStates()).toEqual({ p1: true, p2: false });
  });
});

describe("isConnected", () => {
  it("false for unknown provider", async () => {
    (getProvider as jest.Mock).mockReturnValue(null);
    expect(await ProviderAuthHelper.isConnected("nope")).toBe(false);
  });

  it("false when explicitly disconnected", async () => {
    (getProvider as jest.Mock).mockReturnValue({ requiresAuth: true });
    await ProviderAuthHelper.setConnectionState("p1", false);
    expect(await ProviderAuthHelper.isConnected("p1")).toBe(false);
  });

  it("no-auth provider follows explicit connection flag", async () => {
    (getProvider as jest.Mock).mockReturnValue({ requiresAuth: false });
    expect(await ProviderAuthHelper.isConnected("p1")).toBe(false);
    await ProviderAuthHelper.setConnectionState("p1", true);
    expect(await ProviderAuthHelper.isConnected("p1")).toBe(true);
  });

  it("auth provider marked connected requires stored auth", async () => {
    (getProvider as jest.Mock).mockReturnValue({ requiresAuth: true });
    await ProviderAuthHelper.setConnectionState("p1", true);
    expect(await ProviderAuthHelper.isConnected("p1")).toBe(false);
    await ProviderAuthHelper.setAuth("p1", auth);
    expect(await ProviderAuthHelper.isConnected("p1")).toBe(true);
  });

  it("with no explicit state, falls back to token validity", async () => {
    (getProvider as jest.Mock).mockReturnValue({ requiresAuth: true });
    await ProviderAuthHelper.setAuth("p1", auth);
    tokenHelper.isAuthValid.mockReturnValue(true);
    expect(await ProviderAuthHelper.isConnected("p1")).toBe(true);
    tokenHelper.isAuthValid.mockReturnValue(false);
    expect(await ProviderAuthHelper.isConnected("p1")).toBe(false);
  });
});

describe("refreshIfNeeded", () => {
  it("returns null when provider or auth is missing", async () => {
    (getProvider as jest.Mock).mockReturnValue(null);
    expect(await ProviderAuthHelper.refreshIfNeeded("p1")).toBeNull();
    (getProvider as jest.Mock).mockReturnValue({ config: {} });
    expect(await ProviderAuthHelper.refreshIfNeeded("p1")).toBeNull();
  });

  it("returns stored auth while still valid", async () => {
    (getProvider as jest.Mock).mockReturnValue({ config: {} });
    await ProviderAuthHelper.setAuth("p1", auth);
    tokenHelper.isAuthValid.mockReturnValue(true);
    expect(await ProviderAuthHelper.refreshIfNeeded("p1")).toEqual(auth);
    expect(tokenHelper.refreshToken).not.toHaveBeenCalled();
  });

  it("refreshes an expired token and persists the new auth", async () => {
    const newAuth = { accessToken: "new" };
    (getProvider as jest.Mock).mockReturnValue({ config: {} });
    await ProviderAuthHelper.setAuth("p1", auth);
    tokenHelper.isAuthValid.mockReturnValue(false);
    tokenHelper.refreshToken.mockResolvedValue(newAuth);
    expect(await ProviderAuthHelper.refreshIfNeeded("p1")).toEqual(newAuth);
    expect(await ProviderAuthHelper.getAuth("p1")).toEqual(newAuth);
  });

  it("returns null when refresh fails", async () => {
    (getProvider as jest.Mock).mockReturnValue({ config: {} });
    await ProviderAuthHelper.setAuth("p1", auth);
    tokenHelper.isAuthValid.mockReturnValue(false);
    tokenHelper.refreshToken.mockResolvedValue(null);
    expect(await ProviderAuthHelper.refreshIfNeeded("p1")).toBeNull();
  });
});
