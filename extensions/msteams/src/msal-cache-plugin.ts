import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { ICachePlugin, TokenCacheContext } from "@azure/msal-node";

const CACHE_DIR = ".clawdbot/msteams";
const CACHE_FILENAME = "msal-token-cache.json";

/**
 * Returns the path to the MSAL token cache file.
 * Cache is stored at ~/.clawdbot/msteams/msal-token-cache.json
 */
export function getMSTeamsCachePath(): string {
  return join(homedir(), CACHE_DIR, CACHE_FILENAME);
}

/**
 * Ensure the cache directory exists.
 */
async function ensureCacheDir(): Promise<void> {
  const dir = join(homedir(), CACHE_DIR);
  await mkdir(dir, { recursive: true });
}

/**
 * Read the cache file, returning empty string if it doesn't exist.
 */
async function readCacheFile(): Promise<string> {
  try {
    const data = await readFile(getMSTeamsCachePath(), "utf8");
    return data;
  } catch {
    return "";
  }
}

/**
 * Write data to the cache file.
 */
async function writeCacheFile(data: string): Promise<void> {
  await ensureCacheDir();
  await writeFile(getMSTeamsCachePath(), data, "utf8");
}

/**
 * Creates a file-based cache plugin for MSAL.
 * This plugin persists the entire token cache (including refresh tokens)
 * to disk, enabling token refresh without re-authentication.
 */
export function createMSTeamsCachePlugin(): ICachePlugin {
  return {
    async beforeCacheAccess(context: TokenCacheContext): Promise<void> {
      const data = await readCacheFile();
      if (data) {
        context.tokenCache.deserialize(data);
      }
    },

    async afterCacheAccess(context: TokenCacheContext): Promise<void> {
      if (context.cacheHasChanged) {
        const data = context.tokenCache.serialize();
        await writeCacheFile(data);
      }
    },
  };
}
