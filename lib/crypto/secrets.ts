import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { runtimeEnv } from "@/lib/env/runtime";

const PREFIX = "wh1:";

function deriveKey(): Buffer | null {
  const secret =
    runtimeEnv("ROUTER_PASSWORD_SECRET") ||
    runtimeEnv("AUTH_SECRET") ||
    runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || secret.length < 16) return null;
  return createHash("sha256").update(secret).digest();
}

/** Encrypt router passwords at rest. Falls back to plaintext if no secret. */
export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  if (plain.startsWith(PREFIX)) return plain;
  const key = deriveKey();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

/** Decrypt stored value; returns as-is if not encrypted or key missing. */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored;
  const key = deriveKey();
  if (!key) return stored;
  try {
    const body = stored.slice(PREFIX.length);
    const [ivB64, tagB64, dataB64] = body.split(".");
    if (!ivB64 || !tagB64 || !dataB64) return stored;
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const data = Buffer.from(dataB64, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return stored;
  }
}
