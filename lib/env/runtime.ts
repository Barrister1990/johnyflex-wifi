import { existsSync, readFileSync } from "fs";
import { join } from "path";

let cached: Record<string, string> | null = null;
let cachedMeta: { cwd: string; filesLoaded: string[] } | null = null;

function parseEnvFile(path: string, into: Record<string, string>): boolean {
  if (!existsSync(path)) return false;
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      into[key] = value;
    }
    return true;
  } catch {
    return false;
  }
}

function candidateEnvPaths(cwd: string): string[] {
  const explicit =
    process.env.JOHNNYFLEX_ENV_FILE?.trim() ||
    process.env.WIFIHUB_ENV_FILE?.trim();
  const root =
    process.env.JOHNNYFLEX_ROOT?.trim() || process.env.WIFIHUB_ROOT?.trim();
  // Later files win — keep `.env.local` after `.env`.
  // Do NOT load sibling WiFiHub paths; that overwrites JohnnyFlex APP_URL etc.
  const paths = [
    explicit,
    root ? join(root, ".env") : null,
    root ? join(root, ".env.local") : null,
    join(cwd, ".env"),
    join(cwd, ".env.local"),
    "/var/www/johnyflex-wifi/.env",
    "/var/www/johnyflex-wifi/.env.local",
    "/var/www/johnnyflex/.env",
    "/var/www/johnnyflex/.env.local",
  ].filter((p): p is string => Boolean(p));

  return [...new Set(paths)];
}

/**
 * Read env at request time (not Next build-time inlining).
 * Order: process.env → candidate `.env` / `.env.local` files (later wins).
 */
function loadRuntimeEnv(): Record<string, string> {
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev && cached) return cached;

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value != null) out[key] = value;
  }

  const cwd = process.cwd();
  const filesLoaded: string[] = [];
  for (const path of candidateEnvPaths(cwd)) {
    if (parseEnvFile(path, out)) filesLoaded.push(path);
  }

  cachedMeta = { cwd, filesLoaded };
  if (!isDev) cached = out;
  return out;
}

export function runtimeEnv(name: string): string | undefined {
  const value = loadRuntimeEnv()[name]?.trim();
  return value || undefined;
}

/** Safe diagnostics for operators (no secret values). */
export function runtimeEnvMeta() {
  loadRuntimeEnv();
  return {
    cwd: cachedMeta?.cwd ?? process.cwd(),
    filesLoaded: cachedMeta?.filesLoaded ?? [],
  };
}

/** Drop cache after editing `.env.local` on the VPS (also happens on process restart). */
export function clearRuntimeEnvCache() {
  cached = null;
  cachedMeta = null;
}
