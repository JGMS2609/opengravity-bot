import dotenv from "dotenv";

dotenv.config();

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  return value.trim();
}

function getAllowedUserIds(): number[] {
  return getEnv("TELEGRAM_ALLOWED_USER_IDS")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v));
}

export const env = {
  telegramBotToken: getEnv("TELEGRAM_BOT_TOKEN"),
  telegramAllowedUserIds: getAllowedUserIds(),
  openRouterApiKey: getEnv("OPENROUTER_API_KEY"),
  openRouterModel: getEnv("OPENROUTER_MODEL"),
  groqApiKey: getEnv("GROQ_API_KEY"),
  groqModel: getEnv("GROQ_MODEL"),
  dbPath: getEnv("DB_PATH"),
};
