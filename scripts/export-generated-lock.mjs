import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync("public", { recursive: true });
const lock = readFileSync("package-lock.json");
const encoded = lock.toString("base64");
const digest = createHash("sha256").update(lock).digest("hex");
copyFileSync("package-lock.json", "public/generated-package-lock.json");
writeFileSync("public/generated-package-lock.b64", encoded);
writeFileSync("public/generated-package-lock.sha256", `${digest}\n`);
console.log(`SCOPEFORGE_GENERATED_LOCK_SHA256 ${digest}`);
console.log("SCOPEFORGE_GENERATED_LOCK_B64_BEGIN");
for (let offset = 0; offset < encoded.length; offset += 3000) {
  console.log(encoded.slice(offset, offset + 3000));
}
console.log("SCOPEFORGE_GENERATED_LOCK_B64_END");
