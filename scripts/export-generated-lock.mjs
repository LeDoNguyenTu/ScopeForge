import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });
copyFileSync("package-lock.json", "public/generated-package-lock.json");
console.log("SCOPEFORGE_GENERATED_LOCK_EXPORTED");
