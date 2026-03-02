import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../../.env") });

import chatRouter from "./routes/chat.js";
import embedRouter from "./routes/embed.js";
import judgeRouter from "./routes/judge.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Rate limiting (simple in-memory for local dev)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use(limiter);

// Routes
app.use("/api/chat", chatRouter);
app.use("/api/embed", embedRouter);
app.use("/api/judge", judgeRouter);

// Health check
app.get("/api/health", (_req, res) => {
  const hasKey = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-REPLACE_ME";
  res.json({
    status: "ok",
    apiKeyConfigured: hasKey,
    cloudModelSmall: process.env.CLOUD_MODEL_SMALL || "gpt-4o-mini",
    cloudModelLarge: process.env.CLOUD_MODEL_LARGE || "gpt-4o",
    embedModel: process.env.EMBED_MODEL || "text-embedding-3-small",
  });
});

app.listen(PORT, () => {
  console.log(`\n  🚀 Edge AI Benchmark Server`);
  console.log(`  ──────────────────────────`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/api/health`);
  console.log(`  API Key: ${process.env.OPENAI_API_KEY ? "✅ configured" : "❌ missing — set OPENAI_API_KEY in .env"}`);
  console.log();
});
