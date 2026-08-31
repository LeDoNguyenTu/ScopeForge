import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync("public", { recursive: true });
const lock = readFileSync("package-lock.json");
copyFileSync("package-lock.json", "public/generated-package-lock.json");
writeFileSync("public/generated-package-lock.b64", lock.toString("base64"));
writeFileSync("public/generated-package-lock.sha256", `${createHash("sha256").update(lock).digest("hex")}\n`);
console.log("SCOPEFORGE_GENERATED_LOCK_EXPORTED");
