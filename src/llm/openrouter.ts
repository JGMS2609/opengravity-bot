import OpenAI from "openai";
import { env } from "../config/env.js";
import type { MemoryMessage } from "../types/messages.js";

const client = new OpenAI({
  apiKey: env.openRouterApiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function generateReply(messages: MemoryMessage[]): Promise<string> {
  const systemPrompt =
    "Eres OpenGravity, un asistente personal privado que responde por Telegram de forma clara, útil y breve.";

  const completion = await client.chat.completions.create({
    model: env.openRouterModel,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || "No pude generar respuesta.";
}
