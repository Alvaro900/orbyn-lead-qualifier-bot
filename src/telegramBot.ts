import { Telegraf } from "telegraf";
import type { AppConfig, QualificationResult } from "./types.js";
import { appendLeadToSheet } from "./googleSheets.js";
import { MAX_LEAD_LENGTH, qualifyLead } from "./qualifier.js";

export function createTelegramBot(config: AppConfig): Telegraf {
  const bot = new Telegraf(config.telegramBotToken);

  bot.start(async (ctx) => {
    await ctx.reply("Envíame los datos de un lead en texto libre para cualificarlo.");
  });

  bot.on("text", async (ctx) => {
    const rawText = ctx.message.text?.trim() ?? "";

    if (!rawText || rawText.startsWith("/")) {
      await ctx.reply("Envíame los datos de un lead en texto libre para cualificarlo.");
      return;
    }

    const leadText = rawText.slice(0, MAX_LEAD_LENGTH);

    try {
      const qualification = await qualifyLead(leadText, config);

      try {
        await appendLeadToSheet(
          {
            timestamp: new Date().toISOString(),
            telegramChatId: ctx.chat.id,
            telegramMessageId: ctx.message.message_id,
            rawLeadText: leadText,
            qualification
          },
          config
        );
      } catch (error) {
        console.error("SHEETS_APPEND_ERROR", toSafeError(error));
      }

      await ctx.reply(formatTelegramResponse(qualification));
    } catch (error) {
      console.error("TELEGRAM_HANDLER_ERROR", toSafeError(error));

      try {
        await ctx.reply("No he podido cualificar el lead ahora mismo. Inténtalo de nuevo en unos minutos.");
      } catch (replyError) {
        console.error("TELEGRAM_REPLY_ERROR", toSafeError(replyError));
      }
    }
  });

  bot.on("message", async (ctx) => {
    await ctx.reply("Envíame los datos de un lead en texto libre para cualificarlo.");
  });

  bot.catch((error) => {
    console.error("TELEGRAM_ERROR", toSafeError(error));
  });

  return bot;
}

export function formatTelegramResponse(result: QualificationResult): string {
  const icon = result.decision === "Cualificado" ? "✅" : "❌";
  const statusLine = `${icon} ${result.decision}`;
  const reasonLine = truncateLine(result.reason);

  if (result.decision === "Cualificado") {
    return [
      statusLine,
      reasonLine,
      "Cumple sector, tamaño, ubicación e interés en automatización/IA."
    ].join("\n");
  }

  const failed = failedCriteria(result.criteria);
  const failedLine =
    failed.length > 0
      ? `Criterios no cumplidos: ${failed.join(", ")}.`
      : "Faltan datos críticos para confirmar encaje con el ICP.";

  return [statusLine, reasonLine, truncateLine(failedLine)].join("\n");
}

function failedCriteria(criteria: QualificationResult["criteria"]): string[] {
  const failed: string[] = [];

  if (!criteria.services_or_consulting) {
    failed.push("sector");
  }

  if (!criteria.min_5_employees) {
    failed.push("tamaño");
  }

  if (!criteria.spain_or_latam) {
    failed.push("ubicación");
  }

  if (!criteria.automation_or_ai_interest) {
    failed.push("interés en automatización/IA");
  }

  return failed;
}

function truncateLine(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function toSafeError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { message: String(error) };
}
