import {
  ConfidentialClientApplication,
  type Configuration,
} from "@azure/msal-node";
import type { MSTeamsCredentials } from "./token.js";
import type { MSTeamsAccessTokenProvider } from "./attachments/types.js";
import { createMSTeamsCachePlugin } from "./msal-cache-plugin.js";

// Singleton MSAL client - reused for the process lifetime
let cachedClient: ConfidentialClientApplication | null = null;
let cachedCreds: MSTeamsCredentials | null = null;

/**
 * Check if credentials match (for cache invalidation).
 */
function credsMatch(a: MSTeamsCredentials | null, b: MSTeamsCredentials): boolean {
  if (!a) return false;
  return a.appId === b.appId && a.tenantId === b.tenantId && a.appPassword === b.appPassword;
}

/**
 * Build MSAL Configuration with cache plugin.
 */
function buildMsalConfig(creds: MSTeamsCredentials): Configuration {
  return {
    auth: {
      clientId: creds.appId,
      clientSecret: creds.appPassword,
      authority: `https://login.microsoftonline.com/${creds.tenantId}`,
    },
    cache: {
      cachePlugin: createMSTeamsCachePlugin(),
    },
  };
}

/**
 * Get or create a ConfidentialClientApplication with persistent cache.
 * The client is cached as a singleton to:
 * 1. Reuse MSAL's internal token cache
 * 2. Enable silent token refresh using cached refresh tokens
 */
export function getOrCreateMsalClient(creds: MSTeamsCredentials): ConfidentialClientApplication {
  if (cachedClient && credsMatch(cachedCreds, creds)) {
    return cachedClient;
  }

  const config = buildMsalConfig(creds);
  cachedClient = new ConfidentialClientApplication(config);
  cachedCreds = creds;
  return cachedClient;
}

/**
 * Acquire an access token for the given scope.
 * Uses cached tokens when available, refreshing automatically if needed.
 */
export async function getCachedAccessToken(
  creds: MSTeamsCredentials,
  scope: string,
): Promise<string> {
  const client = getOrCreateMsalClient(creds);

  // For client credentials flow, use acquireTokenByClientCredential
  const result = await client.acquireTokenByClientCredential({
    scopes: [`${scope}/.default`],
  });

  if (!result?.accessToken) {
    throw new Error(`Failed to acquire access token for scope: ${scope}`);
  }

  return result.accessToken;
}

/**
 * Create a token provider compatible with MSTeamsAccessTokenProvider interface.
 * This wraps the singleton MSAL client to provide tokens on demand.
 */
export function createCachedTokenProvider(creds: MSTeamsCredentials): MSTeamsAccessTokenProvider {
  return {
    async getAccessToken(scope: string): Promise<string> {
      return getCachedAccessToken(creds, scope);
    },
  };
}

/**
 * Extract access token from various token result formats.
 * Handles both string tokens and token objects from the SDK.
 */
export function readAccessToken(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const token =
      (value as { accessToken?: unknown }).accessToken ??
      (value as { token?: unknown }).token;
    if (typeof token === "string") return token;
  }
  throw new Error("Failed to extract access token from result");
}
