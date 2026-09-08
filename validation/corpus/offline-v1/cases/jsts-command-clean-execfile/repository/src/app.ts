import express from "express";
import { execFile } from "node:child_process";
const app = express();
app.get("/run", (req, res) => execFile("tool", [String(req.query.cmd)]));
