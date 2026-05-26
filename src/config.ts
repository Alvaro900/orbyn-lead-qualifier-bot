import "dotenv/config";
import { z } from "zod";
import type { AppConfig } from "./types.js";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN es obligatorio"),
  LLM_PROVIDER: z.enum(["openai"]).default("openai"),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  GOOGLE_SHEET_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  NODE_ENV: z.string().default("development")
});

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`CONFIG_ERROR ${details}`);
  }

  return {
    telegramBotToken: parsed.data.TELEGRAM_BOT_TOKEN,
    llmProvider: parsed.data.LLM_PROVIDER,
    llmApiKey: parsed.data.LLM_API_KEY,
    llmModel: parsed.data.LLM_MODEL,
    googleSheetId: parsed.data.GOOGLE_SHEET_ID,
    googleServiceAccountEmail: parsed.data.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    googlePrivateKey: parsed.data.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    googleApplicationCredentials: parsed.data.GOOGLE_APPLICATION_CREDENTIALS,
    googleSheetTabName: "Leads",
    nodeEnv: parsed.data.NODE_ENV
  };
}
