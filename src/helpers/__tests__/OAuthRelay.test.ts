import { ApiHelper } from "../ApiHelper";
import { createRelaySession, exchangeRelaySession, interpretExchangeBody, oauthRelayErrorKey, readOAuthRelayError, refreshRelayToken, toStoredAuth, usesServerTokenExchange } from "../OAuthRelay";

jest.mock("../ApiHelper", () => ({ ApiHelper: { post: jest.fn(), get: jest.fn(), getAnonymous: jest.fn() } }));

const post = ApiHelper.post as jest.Mock;

beforeEach(() => { jest.clearAllMocks(); });

describe("usesServerTokenExchange", () => {
  it("is only OneDrive and Google Drive", () => {
    expect(usesServerTokenExchange("onedrive")).toBe(true);
    expect(usesServerTokenExchange("googledrive")).toBe(true);
    expect(usesServerTokenExchange("gocurriculum")).toBe(false);
    expect(usesServerTokenExchange("dropbox")).toBe(false);
  });
});

describe("toStoredAuth", () => {
  it("stores token fields and drops exchange status", () => {
    const auth = toStoredAuth({
      status: "completed",
      access_token: "a",
      refresh_token: "r",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "Files.Read.All",
      created_at: 1710000000
    });
    expect(auth).toEqual({
      access_token: "a",
      refresh_token: "r",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "Files.Read.All",
      created_at: 1710000000
    });
  });

  it("keeps the previous refresh token when the provider does not rotate it", () => {
    expect(toStoredAuth({ access_token: "a", created_at: 5, expires_in: 10 }, "previous")?.refresh_token).toBe("previous");
  });

  it("returns null without an access token", () => {
    expect(toStoredAuth({ status: "pending", expiresIn: 10 })).toBeNull();
  });
});

describe("interpretExchangeBody", () => {
  it("treats a pending poll as not ready", () => {
    expect(interpretExchangeBody({ status: "pending", expiresIn: 842 })).toEqual({ kind: "pending", expiresIn: 842 });
  });

  it("returns tokens once the exchange completes", () => {
    const outcome = interpretExchangeBody({ status: "completed", access_token: "a", refresh_token: "r", created_at: 5, expires_in: 3600 });
    expect(outcome.kind).toBe("tokens");
    if (outcome.kind === "tokens") expect(outcome.auth.access_token).toBe("a");
  });
});

describe("oauth errors", () => {
  function apiError(status: number, error: string, error_description: string) {
    const err = new Error("Request failed");
    (err as any).originalError = { response: { status, data: { error, error_description } } };
    return err;
  }

  it("reads the relay error body off the ApiHelper wrapper", () => {
    expect(readOAuthRelayError(apiError(400, "invalid_grant", "verifier does not match"))).toEqual({
      status: 400,
      error: "invalid_grant",
      error_description: "verifier does not match"
    });
  });

  it("maps documented error codes to connect-screen messages", () => {
    expect(oauthRelayErrorKey(apiError(400, "invalid_request", "x"))).toBe("providerOAuth.invalidRequest");
    expect(oauthRelayErrorKey(apiError(400, "invalid_grant", "x"))).toBe("providerOAuth.invalidGrant");
    expect(oauthRelayErrorKey(apiError(400, "unsupported_provider", "x"))).toBe("providerOAuth.unsupportedProvider");
    expect(oauthRelayErrorKey(apiError(404, "not_found", "x"))).toBe("providerOAuth.sessionExpired");
    expect(oauthRelayErrorKey(apiError(500, "server_error", "x"))).toBe("providerOAuth.serverError");
    expect(oauthRelayErrorKey(new Error("network"))).toBeNull();
  });
});

describe("relay requests", () => {
  it("sends the PKCE challenge when the provider exchanges on the server", async () => {
    post.mockResolvedValue({ sessionCode: "ABCD2345" });
    await createRelaySession("onedrive", "challenge");
    expect(post).toHaveBeenCalledWith("/oauth/relay/sessions", { provider: "onedrive", codeChallenge: "challenge" }, "RelayApi");
  });

  it("omits the challenge for on-device providers", async () => {
    post.mockResolvedValue({});
    await createRelaySession("dropbox");
    expect(post).toHaveBeenCalledWith("/oauth/relay/sessions", { provider: "dropbox" }, "RelayApi");
  });

  it("posts only the verifier to the exchange endpoint", async () => {
    post.mockResolvedValue({ status: "pending", expiresIn: 100 });
    await exchangeRelaySession("ABCD2345", "verifier-value");
    expect(post).toHaveBeenCalledWith("/oauth/relay/sessions/ABCD2345/exchange", { codeVerifier: "verifier-value" }, "RelayApi");
    expect(post.mock.calls[0][1]).not.toHaveProperty("code");
    expect(ApiHelper.getAnonymous).not.toHaveBeenCalled();
    expect(ApiHelper.get).not.toHaveBeenCalled();
  });

  it("refreshes with the provider and refresh token and stores the rotated token", async () => {
    post.mockResolvedValue({
      access_token: "new",
      refresh_token: "rotated",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "Files.Read.All",
      created_at: 1710000000
    });
    const auth = await refreshRelayToken("googledrive", "old");
    expect(post).toHaveBeenCalledWith("/oauth/relay/refresh", { provider: "googledrive", refreshToken: "old" }, "RelayApi");
    expect(auth).toMatchObject({ access_token: "new", refresh_token: "rotated", created_at: 1710000000 });
  });
});
