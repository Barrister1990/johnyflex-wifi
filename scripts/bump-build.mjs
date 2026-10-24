import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "build", "number.json");

mkdirSync(join(root, "build"), { recursive: true });

let number = 1;
try {
  const prev = JSON.parse(readFileSync(path, "utf8"));
  number = (Number(prev.number) || 0) + 1;
} catch {
  /* first build */
}

const payload = {
  number,
  builtAt: new Date().toISOString(),
};

writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[wifihub] build number → ${number}`);
