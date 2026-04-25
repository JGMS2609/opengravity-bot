import type { MemoryMessage } from "../types/messages.js";
import { generateGroqReply } from "./groq.js";
import { generateReply as generateOpenRouterReply } from "./openrouter.js";

export async function generateBestReply(messages: MemoryMessage[]): Promise<string> {
  try {
    return await generateGroqReply(messages);
  } catch (error) {
    console.error("Groq fallo, usando OpenRouter fallback:", error);
    return await generateOpenRouterReply(messages);
  }
}
