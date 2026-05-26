import { google, sheets_v4 } from "googleapis";
import type { AppConfig, LeadSheetRow } from "./types.js";

const header = [
  "fecha",
  "telegram_chat_id",
  "telegram_message_id",
  "datos_recibidos",
  "decision",
  "motivo",
  "sector_detectado",
  "empleados_detectados",
  "ubicacion_detectada",
  "interes_automatizacion_ia",
  "confianza"
];

let cachedSheets: sheets_v4.Sheets | null = null;
let ensuredSheetIds = new Set<string>();

export async function appendLeadToSheet(row: LeadSheetRow, config: AppConfig): Promise<void> {
  if (!config.googleSheetId) {
    throw new Error("GOOGLE_SHEET_ID no configurado");
  }

  const sheets = getSheetsClient(config);
  await ensureLeadsSheet(sheets, config.googleSheetId, config.googleSheetTabName);

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetId,
    range: `${config.googleSheetTabName}!A:K`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [toSheetValues(row)]
    }
  });
}

function getSheetsClient(config: AppConfig): sheets_v4.Sheets {
  if (cachedSheets) {
    return cachedSheets;
  }

  const auth = config.googleServiceAccountEmail
    ? new google.auth.JWT({
        email: config.googleServiceAccountEmail,
        key: config.googlePrivateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
      })
    : new google.auth.GoogleAuth({
        keyFile: config.googleApplicationCredentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
      });

  cachedSheets = google.sheets({ version: "v4", auth });
  return cachedSheets;
}

async function ensureLeadsSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string
): Promise<void> {
  const cacheKey = `${spreadsheetId}:${tabName}`;
  if (ensuredSheetIds.has(cacheKey)) {
    return;
  }

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const hasTab = spreadsheet.data.sheets?.some((sheet) => sheet.properties?.title === tabName);

  if (!hasTab) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }]
      }
    });
  }

  const currentHeader = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:K1`
  });

  const firstRow = currentHeader.data.values?.[0] ?? [];
  const hasExpectedHeader = header.every((column, index) => firstRow[index] === column);

  if (!hasExpectedHeader) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1:K1`,
      valueInputOption: "RAW",
      requestBody: { values: [header] }
    });
  }

  ensuredSheetIds.add(cacheKey);
}

function toSheetValues(row: LeadSheetRow): Array<string | number | boolean> {
  const { qualification } = row;

  return [
    row.timestamp,
    String(row.telegramChatId),
    String(row.telegramMessageId),
    row.rawLeadText,
    qualification.decision,
    qualification.reason,
    qualification.extracted.business_type ?? "",
    qualification.extracted.employee_count ?? "",
    qualification.extracted.location ?? "",
    qualification.extracted.automation_or_ai_interest ?? "",
    qualification.confidence
  ];
}
