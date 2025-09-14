export type Role = "system" | "user" | "assistant";
export type ChatMessage = { role: Role; content: string };

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export async function callFinnChat(messages: ChatMessage[]) : Promise<string>{
  if (!BACKEND_URL) throw new Error("Missing EXPO_PUBLIC_BACKEND_URL");

  const r = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Backend error ${r.status}: ${text}`);
  }

  const data = await r.json();
  return data.content as string;
}
