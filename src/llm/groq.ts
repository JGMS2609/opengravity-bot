import Groq from "groq-sdk";
import { env } from "../config/env.js";
import type { MemoryMessage } from "../types/messages.js";

const client = new Groq({
  apiKey: env.groqApiKey,
});

export async function generateGroqReply(messages: MemoryMessage[]): Promise<string> {
  const systemPrompt =
    "Eres OpenGravity, un asistente personal privado creado por JuanMa. Responde en espanol, de forma clara, util y breve. Si ya conoces datos del usuario por memoria, usalos correctamente.";

  const completion = await client.chat.completions.create({
    model: env.groqModel,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ],
    temperature: 0.4,
  });

  return completion.choices[0]?.message?.content?.trim() || "No pude generar respuesta con Groq.";
}
