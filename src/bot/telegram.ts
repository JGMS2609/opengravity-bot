import { Bot, Context } from "grammy";
import { env } from "../config/env.js";
import { saveMessage, getRecentMessages } from "../memory/messageMemory.js";
import { getCurrentTime } from "../tools/getCurrentTime.js";
import { generateBestReply } from "../llm/router.js";
import { getAllUserFacts, getUserFact, setUserFact } from "../memory/userFacts.js";
import { disableSkill, enableSkill, listSkills } from "../skills/skillManager.js";

export const bot = new Bot(env.telegramBotToken);

function isAllowedUser(ctx: Context): boolean {
  const userId = ctx.from?.id;
  if (!userId) {
    return false;
  }

  // userId es number y telegramAllowedUserIds también, así que lo dejamos tal cual
  return env.telegramAllowedUserIds.includes(userId);
}

function extractPreferredName(text: string): string | null {
  const patterns = [
    /(?:me llamo|mi nombre es|recuerda que me llamo)\s+(.+)/i,
    /(?:puedes llamarme|llamame)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/[.!?]+$/, "");
    }
  }

  return null;
}

function extractPreference(text: string): { key: string; value: string } | null {
  const lower = text.toLowerCase();

  if (lower.includes("prefiero que me hables")) {
    return {
      key: "conversation_style",
      value: text.replace(/.*prefiero que me hables\s*/i, "").trim(),
    };
  }

  if (lower.includes("mi tema favorito es")) {
    return {
      key: "favorite_topic",
      value: text.replace(/.*mi tema favorito es\s*/i, "").trim(),
    };
  }

  return null;
}

bot.command("start", async (ctx) => {
  if (!isAllowedUser(ctx)) {
    await ctx.reply("No estas autorizado para usar este bot.");
    return;
  }

  await ctx.reply("OpenGravity activo. Mandame un mensaje.");
});

bot.command("time", async (ctx) => {
  if (!isAllowedUser(ctx)) {
    await ctx.reply("No estas autorizado para usar este bot.");
    return;
  }

  await ctx.reply(`Hora actual: ${getCurrentTime()}`);
});

bot.command("whoami", async (ctx) => {
  if (!isAllowedUser(ctx)) {
    await ctx.reply("No estas autorizado para usar este bot.");
    return;
  }

  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("No pude identificar tu usuario.");
    return;
  }

  const savedName = getUserFact(userId, "preferred_name");
  const reply = savedName
    ? `Te llamas ${savedName}.`
    : "Aun no me has dicho como quieres que te llame.";

  await ctx.reply(reply);
});

bot.command("memory", async (ctx) => {
  if (!isAllowedUser(ctx)) {
    await ctx.reply("No estas autorizado para usar este bot.");
    return;
  }

  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("No pude identificar tu usuario.");
    return;
  }

  const facts = getAllUserFacts(userId);

  if (!facts.length) {
    await ctx.reply("Aun no tengo recuerdos guardados sobre ti.");
    return;
  }

  const text = facts.map((fact) => `- ${fact.key}: ${fact.value}`).join("\n");
  await ctx.reply(`Esto recuerdo de ti:\n${text}`);
});

bot.command("skills", async (ctx) => {
  if (!isAllowedUser(ctx)) {
    await ctx.reply("No estas autorizado para usar este bot.");
    return;
  }

  const text = listSkills()
    .map((skill) => `- ${skill.id} | ${skill.enabled ? "ON" : "OFF"} | ${skill.description}`)
    .join("\n");

  await ctx.reply(`Skills internas:\n${text}`);
});

bot.command("status", async (ctx) => {
  if (!isAllowedUser(ctx)) {
    await ctx.reply("No estas autorizado para usar este bot.");
    return;
  }

  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("No pude identificar tu usuario.");
    return;
  }

  const facts = getAllUserFacts(userId);
  const skills = listSkills();

  const enabledCount = skills.filter((skill) => skill.enabled).length;
  const disabledCount = skills.length - enabledCount;

  const lines = [
    "Estado de OpenGravity:",
    `- Hora local: ${getCurrentTime()}`,
    `- Recuerdos guardados: ${facts.length}`,
    `- Skills activas: ${enabledCount}`,
    `- Skills inactivas: ${disabledCount}`,
    `- Modelo Groq configurado: ${env.groqModel}`,
    `- Modelo OpenRouter fallback: ${env.openRouterModel}`,
  ];

  await ctx.reply(lines.join("\n"));
});

bot.command("enable", async (ctx) => {
  if (!isAllowedUser(ctx)) {
    await ctx.reply("No estas autorizado para usar este bot.");
    return;
  }

  const parts = ctx.message?.text?.split(" ") || [];
  const skillId = parts[1];

  if (!skillId) {
    await ctx.reply("Uso: /enable nombre_skill");
    return;
  }

  const ok = enableSkill(skillId);
  await ctx.reply(ok ? `Skill activada: ${skillId}` : `No encontre la skill: ${skillId}`);
});

bot.command("disable", async (ctx) => {
  if (!isAllowedUser(ctx)) {
    await ctx.reply("No estas autorizado para usar este bot.");
    return;
  }

  const parts = ctx.message?.text?.split(" ") || [];
  const skillId = parts[1];

  if (!skillId) {
    await ctx.reply("Uso: /disable nombre_skill");
    return;
  }

  const ok = disableSkill(skillId);
  await ctx.reply(ok ? `Skill desactivada: ${skillId}` : `No encontre la skill: ${skillId}`);
});

bot.on("message:text", async (ctx) => {
  try {
    if (!isAllowedUser(ctx)) {
      await ctx.reply("No estas autorizado para usar este bot.");
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("No pude identificar tu usuario.");
      return;
    }

    const text = ctx.message.text.trim();

    saveMessage(userId, "user", text);

    const preferredName = extractPreferredName(text);
    if (preferredName) {
      setUserFact(userId, "preferred_name", preferredName);
      const reply = `Entendido. Recordare que te llamas ${preferedName}.`;
      saveMessage(userId, "assistant", reply);
      await ctx.reply(reply);
      return;
    }

    const preference = extractPreference(text);
    if (preference) {
      setUserFact(userId, preference.key, preference.value);
      const reply = `Entendido. Guardare esto en memoria: ${preference.key} = ${preference.value}`;
      saveMessage(userId, "assistant", reply);
      await ctx.reply(reply);
      return;
    }

    if (/como me llamo|cual es mi nombre/i.test(text)) {
      const savedName = getUserFact(userId, "preferred_name");
      const reply = savedName
        ? `Te llamas ${savedName}.`
        : "Aun no me has dicho como quieres que te llame.";
      saveMessage(userId, "assistant", reply);
      await ctx.reply(reply);
      return;
    }

    const facts = getAllUserFacts(userId);
    const factsSummary = facts.map((fact) => `${fact.key}: ${fact.value}`).join(" | ");
    const history = getRecentMessages(userId, 12);

    const memoryContext = factsSummary
      ? [
          {
            userId,
            role: "system" as const,
            content: `Memoria persistente del usuario: ${factsSummary}.`,
          },
        ]
      : [];

    const timeContext = /hora|fecha/i.test(text)
      ? [
          {
            userId,
            role: "system" as const,
            content: `Hora actual: ${getCurrentTime()}`,
          },
        ]
      : [];

    const reply = await generateBestReply([...memoryContext, ...timeContext, ...history]);

    saveMessage(userId, "assistant", reply);
    await ctx.reply(reply);
  } catch (error) {
    console.error("Error en message:text:", error);
    await ctx.reply("Tuve un error procesando tu mensaje.");
  }
});