import { google, sheets_v4 } from "googleapis";
import type { AppConfig, LeadSheetRow } from "./types.js";

const header = [
  "Fecha",
  "Chat ID",
  "Mensaje ID",
  "Lead recibido",
  "Decisión",
  "Motivo",
  "Sector detectado",
  "Empleados",
  "Ubicación",
  "Interés IA/automatización",
  "Confianza"
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

export async function formatLeadSheet(config: AppConfig): Promise<void> {
  if (!config.googleSheetId) {
    throw new Error("GOOGLE_SHEET_ID no configurado");
  }

  const sheets = getSheetsClient(config);
  const sheetId = await getOrCreateLeadsSheetId(
    sheets,
    config.googleSheetId,
    config.googleSheetTabName
  );

  await ensureSheetHeader(sheets, config.googleSheetId, config.googleSheetTabName);
  await applySheetFormatting(sheets, config.googleSheetId, sheetId);
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

  const sheetId = await getOrCreateLeadsSheetId(sheets, spreadsheetId, tabName);
  await ensureSheetHeader(sheets, spreadsheetId, tabName);
  await applySheetFormatting(sheets, spreadsheetId, sheetId);

  ensuredSheetIds.add(cacheKey);
}

async function getOrCreateLeadsSheetId(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string
): Promise<number> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheet = spreadsheet.data.sheets?.find((sheet) => sheet.properties?.title === tabName);
  const existingSheetId = existingSheet?.properties?.sheetId;

  if (typeof existingSheetId === "number") {
    return existingSheetId;
  }

  const created = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }]
    }
  });

  const createdSheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (typeof createdSheetId !== "number") {
    throw new Error("No se pudo crear la pestaña Leads");
  }

  return createdSheetId;
}

async function ensureSheetHeader(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string
): Promise<void> {
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
}

async function applySheetFormatting(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number
): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: { frozenRowCount: 1 }
            },
            fields: "gridProperties.frozenRowCount"
          }
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: header.length
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.08, green: 0.18, blue: 0.31 },
                horizontalAlignment: "CENTER",
                verticalAlignment: "MIDDLE",
                wrapStrategy: "WRAP",
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  bold: true
                }
              }
            },
            fields:
              "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)"
          }
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: header.length
            },
            cell: {
              userEnteredFormat: {
                verticalAlignment: "TOP",
                wrapStrategy: "WRAP"
              }
            },
            fields: "userEnteredFormat(verticalAlignment,wrapStrategy)"
          }
        },
        {
          setBasicFilter: {
            filter: {
              range: {
                sheetId,
                startRowIndex: 0,
                startColumnIndex: 0,
                endColumnIndex: header.length
              }
            }
          }
        },
        ...columnWidths(sheetId)
      ]
    }
  });
}

function columnWidths(sheetId: number): sheets_v4.Schema$Request[] {
  const widths = [175, 120, 120, 380, 130, 430, 210, 105, 180, 190, 105];

  return widths.map((pixelSize, index) => ({
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: "COLUMNS",
        startIndex: index,
        endIndex: index + 1
      },
      properties: { pixelSize },
      fields: "pixelSize"
    }
  }));
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
