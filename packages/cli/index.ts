#!/usr/bin/env node

import { runCli } from "./run-cli";

void runCli(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode;
});
