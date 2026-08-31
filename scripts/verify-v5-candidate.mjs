import { spawnSync } from "node:child_process";

const commands = [
  ["npm", ["test"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "build:cli"]],
  ["node", [".scopeforge-build/packages/cli/index.js", "--version"]],
  ["npm", ["run", "benchmark:scanner"]],
  ["npm", ["audit", "--audit-level=info"]],
];

for (const [command, args] of commands) {
  console.log(`SCOPEFORGE_V5_GATE_BEGIN ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  console.log(`SCOPEFORGE_V5_GATE_END ${command} ${args.join(" ")} exit=${result.status ?? 1}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
