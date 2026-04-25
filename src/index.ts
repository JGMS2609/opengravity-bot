import { bot } from "./bot/telegram.js";
import "./db/database.js";

async function main() {
  console.log("Iniciando OpenGravity...");
  await bot.start();
}

main().catch((error) => {
  console.error("Error al iniciar OpenGravity:", error);
  process.exit(1);
});
