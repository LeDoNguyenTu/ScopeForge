import express from "express";
import { execSync as runSync } from "child_process";
const app = express();
app.post("/run", (request, response) => {
  const command = request.body.command;
  runSync(`prefix ${command}`);
});
