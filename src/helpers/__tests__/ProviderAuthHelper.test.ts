import AsyncStorage from "@react-native-async-storage/async-storage";
import { getProvider, __tokenHelperMock } from "@churchapps/content-providers";
import { ApiHelper } from "../ApiHelper";
import { ProviderAuthHelper, authIsExpired } from "../ProviderAuthHelper";

jest.mock("../ApiHelper", () => ({ ApiHelper: { post: jest.fn() } }));

const tokenHelper = __tokenHelperMock as { isAuthValid: jest.Mock; refreshToken: jest.Mock };

const nowSec = () => Math.floor(Date.now() / 1000);

function liveAuth(extra: Record<string, unknown> = {}) {
  return {
    access_token: "tok",
    refresh_token: "rt",
    token_type: "Bearer",
    created_at: nowSec(),
    expires_in: 3600,
    scope: "",
    ...extra
  } as any;
}

function expiredAuth(extra: Record<string, unknown> = {}) {
  return liveAuth({ created_at: nowSec() - 100, expires_in: 10, ...extra });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  tokenHelper.refreshToken.mockResolvedValue(null);
});

describe("authIsExpired", () => {
  it("treats a freshly issued 10s token as valid", () => {
    const now = Date.now();
    expect(authIsExpired({ created_at: Math.floor(now / 1000), expires_in: 10 } as any, now)).toBe(false);
  });

  it("treats a 10s token as expired after its lifetime", () => {
    const now = Date.now();
    expect(authIsExpired({ created_at: Math.floor(now / 1000) - 11, expires_in: 10 } as any, now)).toBe(true);
  });
});

describe("auth CRUD", () => {
  it("round-trips auth data per provider", async () => {
    const auth = liveAuth();
    await ProviderAuthHelper.setAuth("p1", auth);
    expect(await ProviderAuthHelper.getAuth("p1")).toEqual(auth);
    expect(await ProviderAuthHelper.getAuth("p2")).toBeNull();
  });

  it("clearAuth removes stored auth", async () => {
    await ProviderAuthHelper.setAuth("p1", liveAuth());
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
    (getProvider as jest.Mock).mockReturnValue({ requiresAuth: true, config: {} });
    await ProviderAuthHelper.setConnectionState("p1", true);
    expect(await ProviderAuthHelper.isConnected("p1")).toBe(false);
    await ProviderAuthHelper.setAuth("p1", liveAuth());
    expect(await ProviderAuthHelper.isConnected("p1")).toBe(true);
  });

  it("refreshes an expired token with no connection flag instead of treating it as disconnected", async () => {
    (getProvider as jest.Mock).mockReturnValue({ requiresAuth: true, config: {} });
    const next = liveAuth({ access_token: "new" });
    await ProviderAuthHelper.setAuth("p1", expiredAuth());
    tokenHelper.refreshToken.mockResolvedValue(next);
    expect(await ProviderAuthHelper.isConnected("p1")).toBe(true);
    expect(tokenHelper.refreshToken).toHaveBeenCalled();
  });

  it("expired token, no connection flag, failed refresh is disconnected", async () => {
    (getProvider as jest.Mock).mockReturnValue({ requiresAuth: true, config: {} });
    await ProviderAuthHelper.setAuth("p1", expiredAuth());
    tokenHelper.refreshToken.mockResolvedValue(null);
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
    const auth = liveAuth();
    await ProviderAuthHelper.setAuth("p1", auth);
    expect(await ProviderAuthHelper.refreshIfNeeded("p1")).toEqual(auth);
    expect(tokenHelper.refreshToken).not.toHaveBeenCalled();
  });

  it("refreshes an expired token and persists the new auth", async () => {
    const newAuth = liveAuth({ access_token: "new" });
    (getProvider as jest.Mock).mockReturnValue({ config: {} });
    await ProviderAuthHelper.setAuth("p1", expiredAuth());
    tokenHelper.refreshToken.mockResolvedValue(newAuth);
    expect(await ProviderAuthHelper.refreshIfNeeded("p1")).toEqual(newAuth);
    expect(await ProviderAuthHelper.getAuth("p1")).toEqual(newAuth);
  });

  it("returns null when refresh fails", async () => {
    (getProvider as jest.Mock).mockReturnValue({ config: {} });
    await ProviderAuthHelper.setAuth("p1", expiredAuth());
    tokenHelper.refreshToken.mockResolvedValue(null);
    expect(await ProviderAuthHelper.refreshIfNeeded("p1")).toBeNull();
  });

  it("only hits the network once when two refreshes race", async () => {
    (getProvider as jest.Mock).mockReturnValue({ config: {} });
    await ProviderAuthHelper.setAuth("p1", expiredAuth());
    let resolveRefresh: (v: any) => void = () => {};
    tokenHelper.refreshToken.mockReturnValue(new Promise((resolve) => { resolveRefresh = resolve; }));
    const a = ProviderAuthHelper.refreshIfNeeded("p1");
    const b = ProviderAuthHelper.refreshIfNeeded("p1");
    const next = liveAuth({ access_token: "new" });
    resolveRefresh(next);
    expect(await a).toEqual(next);
    expect(await b).toEqual(next);
    expect(tokenHelper.refreshToken).toHaveBeenCalledTimes(1);
  });

  it("leaves a live OneDrive token on the device", async () => {
    (getProvider as jest.Mock).mockReturnValue({ config: {} });
    const auth = liveAuth();
    await ProviderAuthHelper.setAuth("onedrive", auth);
    expect(await ProviderAuthHelper.refreshIfNeeded("onedrive")).toEqual(auth);
    expect(ApiHelper.post).not.toHaveBeenCalled();
    expect(tokenHelper.refreshToken).not.toHaveBeenCalled();
  });

  it("refreshes OneDrive and Google Drive through the relay and stores the rotated refresh token", async () => {
    (getProvider as jest.Mock).mockReturnValue({ config: { clientId: "cid", clientSecret: "secret" } });
    (ApiHelper.post as jest.Mock).mockResolvedValue({
      access_token: "new",
      refresh_token: "rotated",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "Files.Read.All offline_access",
      created_at: 1710000000
    });
    for (const providerId of ["onedrive", "googledrive"]) {
      await ProviderAuthHelper.setAuth(providerId, expiredAuth());
      const stored = await ProviderAuthHelper.refreshIfNeeded(providerId);
      expect(stored).toMatchObject({ access_token: "new", refresh_token: "rotated", created_at: 1710000000 });
      expect(await ProviderAuthHelper.getAuth(providerId)).toEqual(stored);
    }
    expect(ApiHelper.post).toHaveBeenCalledWith("/oauth/relay/refresh", { provider: "onedrive", refreshToken: "rt" }, "RelayApi");
    expect(ApiHelper.post).toHaveBeenCalledWith("/oauth/relay/refresh", { provider: "googledrive", refreshToken: "rt" }, "RelayApi");
    expect(tokenHelper.refreshToken).not.toHaveBeenCalled();
  });

  it("refreshes Dropbox and Go Curriculum on the device", async () => {
    (getProvider as jest.Mock).mockReturnValue({ config: {} });
    const newAuth = liveAuth({ access_token: "device" });
    tokenHelper.refreshToken.mockResolvedValue(newAuth);
    for (const providerId of ["dropbox", "gocurriculum"]) {
      await ProviderAuthHelper.setAuth(providerId, expiredAuth());
      expect(await ProviderAuthHelper.refreshIfNeeded(providerId)).toEqual(newAuth);
    }
    expect(ApiHelper.post).not.toHaveBeenCalled();
    expect(tokenHelper.refreshToken).toHaveBeenCalledTimes(2);
  });

  it("keeps the stored token when the relay rejects the refresh", async () => {
    (getProvider as jest.Mock).mockReturnValue({ config: {} });
    const auth = expiredAuth();
    await ProviderAuthHelper.setAuth("onedrive", auth);
    const error = new Error("Request failed with status code 400");
    (error as any).originalError = { response: { status: 400, data: { error: "invalid_grant", error_description: "provider rejected the refresh" } } };
    (ApiHelper.post as jest.Mock).mockRejectedValue(error);
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(await ProviderAuthHelper.refreshIfNeeded("onedrive")).toBeNull();
    expect(await ProviderAuthHelper.getAuth("onedrive")).toEqual(auth);
    expect(spy).toHaveBeenCalledWith("Token refresh failed for onedrive:", "invalid_grant", "provider rejected the refresh");
    spy.mockRestore();
  });
});
