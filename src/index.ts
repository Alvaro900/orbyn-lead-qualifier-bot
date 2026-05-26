import { loadConfig } from "./config.js";
import { createTelegramBot } from "./telegramBot.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const bot = createTelegramBot(config);

  await bot.launch();
  console.log("BOT_STARTED", { nodeEnv: config.nodeEnv, llmProvider: config.llmProvider });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((error) => {
  console.error("BOOT_ERROR", error instanceof Error ? { name: error.name, message: error.message } : error);
  process.exit(1);
});
