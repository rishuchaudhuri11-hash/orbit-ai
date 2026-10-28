import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(process.env.GROQ_API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: "Groq API is not configured yet. Add GROQ_API_KEY to your deployment environment variables."
      });
    }

    const incoming = req.body?.messages;
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return res.status(400).json({ error: "Please send at least one message." });
    }

    // Keep only the most recent messages and validate their shape/size.
    const messages = incoming.slice(-20).map((m) => {
      if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") {
        throw new Error("Invalid message format.");
      }
      return { role: m.role, content: m.content.slice(0, 12000) };
    });

    const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are a helpful, friendly AI assistant. Be clear, accurate, and honest about uncertainty. Match the user's language when practical. Do not claim to have performed actions you have not performed."
          },
          ...messages
        ],
        temperature: 0.7,
        max_completion_tokens: 1200
      })
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail = data?.error?.message || `Groq returned HTTP ${upstream.status}.`;
      return res.status(upstream.status === 429 ? 429 : 502).json({
        error: detail,
        hint: upstream.status === 401 ? "Check that GROQ_API_KEY is correct." :
              upstream.status === 404 ? "Check whether GROQ_MODEL is available to your account." :
              upstream.status === 429 ? "Rate limit or quota reached; check your Groq console." : undefined
      });
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return res.status(502).json({ error: "Groq returned an empty response. Please try again." });
    }
    res.json({ reply: answer, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    res.status(400).json({ error: message });
  }
});

// Serve built frontend in production.
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`Groq Chatbot running on http://localhost:${PORT}`);
});
