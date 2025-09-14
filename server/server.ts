import "dotenv/config"; // โหลด .env อัตโนมัติ
import express from "express";
import cors from "cors";

type Role = "system" | "user" | "assistant";
type ChatMessage = { role: Role; content: string };

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const LMSTUDIO_BASE = process.env.LMSTUDIO_BASE ?? "http://127.0.0.1:1234/v1";
const MODEL = process.env.LM_MODEL ?? "llama3.1-typhoon2-8b-instruct";

app.post("/chat", async (req, res) => {
  try {
    const { messages, temperature = 0.7, max_tokens = 512 } = req.body as {
      messages: ChatMessage[];
      temperature?: number;
      max_tokens?: number;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages is required (array)" });
    }

    const r = await fetch(`${LMSTUDIO_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens,
        stream: false,
      }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res
        .status(500)
        .json({ error: "LM Studio error", status: r.status, detail: text });
    }

    const data = await r.json();
    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.delta?.content ??
      "";

    res.json({ content, raw: data });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message ?? "unknown error" });
  }
});

const PORT = Number(process.env.PORT ?? 8787);
app.listen(PORT, () => {
  console.log(`Finn Chat backend running on http://0.0.0.0:${PORT}`);
  console.log(`Proxying to LM Studio at ${LMSTUDIO_BASE} model=${MODEL}`);
});
