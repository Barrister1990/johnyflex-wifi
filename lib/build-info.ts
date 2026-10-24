import { readFileSync } from "fs";
import { join } from "path";

export type BuildInfo = {
  number: number;
  builtAt: string | null;
  label: string;
};

export function getBuildInfo(): BuildInfo {
  const fromEnv = Number(process.env.NEXT_PUBLIC_BUILD_NUMBER || "");
  const builtAtEnv = process.env.NEXT_PUBLIC_BUILD_AT || null;

  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return {
      number: fromEnv,
      builtAt: builtAtEnv,
      label: `build ${fromEnv}`,
    };
  }

  try {
    const raw = readFileSync(join(process.cwd(), "build", "number.json"), "utf8");
    const data = JSON.parse(raw) as { number?: number; builtAt?: string | null };
    const number = Number(data.number) || 0;
    return {
      number,
      builtAt: data.builtAt ?? null,
      label: number > 0 ? `build ${number}` : "build —",
    };
  } catch {
    return { number: 0, builtAt: null, label: "build —" };
  }
}
