import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const current = JSON.parse(readFileSync("package-lock.json", "utf8"));
const committed = JSON.parse(execFileSync("git", ["show", "HEAD:package-lock.json"], { encoding: "utf8" }));
const changed = {};

for (const [path, value] of Object.entries(current.packages ?? {})) {
  if (JSON.stringify(value) !== JSON.stringify(committed.packages?.[path])) {
    changed[path] = value;
  }
}

for (const path of Object.keys(committed.packages ?? {})) {
  if (!(path in (current.packages ?? {}))) changed[path] = null;
}

console.log("SCOPEFORGE_LOCK_DELTA_BEGIN");
console.log(JSON.stringify({ root: current.packages?.[""], changed }));
console.log("SCOPEFORGE_LOCK_DELTA_END");
