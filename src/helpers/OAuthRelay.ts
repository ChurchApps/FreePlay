import { ContentProviderAuthData } from "@churchapps/content-providers";
import { ApiHelper } from "./ApiHelper";

// Web redirect URIs, so Microsoft and Google require the secret the relay holds.
const SERVER_TOKEN_PROVIDERS = ["onedrive", "googledrive"];

const ERROR_KEYS: Record<string, string> = {
  invalid_request: "providerOAuth.invalidRequest",
  invalid_grant: "providerOAuth.invalidGrant",
  unsupported_provider: "providerOAuth.unsupportedProvider",
  not_found: "providerOAuth.sessionExpired",
  server_error: "providerOAuth.serverError"
};

export function usesServerTokenExchange(providerId: string): boolean {
  return SERVER_TOKEN_PROVIDERS.includes(providerId);
}

/** Same fields TokenHelper stores. `status` on a completed exchange is ignored. */
export function toStoredAuth(data: any, fallbackRefreshToken = ""): ContentProviderAuthData | null {
  if (!data?.access_token) return null;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || fallbackRefreshToken,
    token_type: data.token_type || "Bearer",
    created_at: data.created_at || Math.floor(Date.now() / 1000),
    expires_in: data.expires_in,
    scope: data.scope || ""
  };
}

export type ExchangeOutcome =
  | { kind: "pending"; expiresIn?: number }
  | { kind: "tokens"; auth: ContentProviderAuthData }
  | { kind: "invalid" };

export function interpretExchangeBody(data: any): ExchangeOutcome {
  if (data?.status === "pending") return { kind: "pending", expiresIn: typeof data.expiresIn === "number" ? data.expiresIn : undefined };
  const auth = toStoredAuth(data);
  if (auth) return { kind: "tokens", auth };
  return { kind: "invalid" };
}

export type OAuthRelayError = { status?: number; error?: string; error_description?: string };

export function readOAuthRelayError(error: unknown): OAuthRelayError {
  const anyErr = error as { originalError?: { response?: { status?: number; data?: any } }; response?: { status?: number; data?: any } };
  const response = anyErr?.originalError?.response || anyErr?.response;
  const body = response?.data && typeof response.data === "object" ? response.data : undefined;
  return {
    status: response?.status,
    error: typeof body?.error === "string" ? body.error : undefined,
    error_description: typeof body?.error_description === "string" ? body.error_description : undefined
  };
}

export function oauthRelayErrorKey(error: unknown): string | null {
  const code = readOAuthRelayError(error).error;
  return (code && ERROR_KEYS[code]) || null;
}

export function createRelaySession(provider: string, codeChallenge?: string) {
  const body: { provider: string; codeChallenge?: string } = { provider };
  if (codeChallenge) body.codeChallenge = codeChallenge;
  return ApiHelper.post("/oauth/relay/sessions", body, "RelayApi");
}

export function exchangeRelaySession(sessionCode: string, codeVerifier: string) {
  return ApiHelper.post(`/oauth/relay/sessions/${sessionCode}/exchange`, { codeVerifier }, "RelayApi");
}

export async function refreshRelayToken(provider: string, refreshToken: string): Promise<ContentProviderAuthData | null> {
  const data = await ApiHelper.post("/oauth/relay/refresh", { provider, refreshToken }, "RelayApi");
  return toStoredAuth(data, refreshToken);
}
