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
  "Confianza del análisis",
  "Cumple sector",
  "Cumple tamaño",
  "Cumple ubicación",
  "Cumple interés IA"
];

const dashboardTabName = "Dashboard";

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
    range: `${config.googleSheetTabName}!A:${columnLetter(header.length)}`,
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
  const dashboardSheetId = await getOrCreateSheetId(sheets, config.googleSheetId, dashboardTabName);

  await ensureSheetHeader(sheets, config.googleSheetId, config.googleSheetTabName);
  await normalizeExistingSheetValues(sheets, config.googleSheetId, config.googleSheetTabName);
  await applySheetFormatting(sheets, config.googleSheetId, sheetId);
  await rebuildDashboard(sheets, config.googleSheetId, dashboardSheetId, config.googleSheetTabName);
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

async function getOrCreateSheetId(
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
    throw new Error(`No se pudo crear la pestaña ${tabName}`);
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
    range: `${tabName}!A1:${columnLetter(header.length)}1`
  });

  const firstRow = currentHeader.data.values?.[0] ?? [];
  const hasExpectedHeader = header.every((column, index) => firstRow[index] === column);

  if (!hasExpectedHeader) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1:${columnLetter(header.length)}1`,
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
  const widths = [150, 120, 120, 380, 130, 430, 210, 105, 180, 190, 165, 125, 125, 135, 145];

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

async function rebuildDashboard(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  dashboardSheetId: number,
  leadsTabName: string
): Promise<void> {
  const quotedLeadsTab = `'${leadsTabName.replace(/'/g, "''")}'`;

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${dashboardTabName}!A:Z`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${dashboardTabName}!A1:H18`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: dashboardValues(quotedLeadsTab)
    }
  });

  const existingChartIds = await getSheetChartIds(sheets, spreadsheetId, dashboardSheetId);
  const deleteChartRequests = existingChartIds.map((objectId) => ({
    deleteEmbeddedObject: { objectId }
  })) as unknown as sheets_v4.Schema$Request[];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        ...deleteChartRequests,
        ...dashboardFormattingRequests(dashboardSheetId),
        ...dashboardChartRequests(dashboardSheetId)
      ]
    }
  });
}

function dashboardValues(leadsTab: string): Array<Array<string>> {
  return [
    ["Dashboard de leads Orbyn"],
    [""],
    ["Métrica", "Valor", "", "Decisión", "Cantidad", "", "Criterio incumplido", "Fallos"],
    ["Total leads", `=COUNTA(${leadsTab}!A2:A)`, "", "Cualificado", `=COUNTIF(${leadsTab}!E2:E,"Cualificado")`, "", "Sector", `=COUNTIF(${leadsTab}!L2:L,"No")`],
    ["Cualificados", `=COUNTIF(${leadsTab}!E2:E,"Cualificado")`, "", "No cualificado", `=COUNTIF(${leadsTab}!E2:E,"No cualificado")`, "", "Tamaño", `=COUNTIF(${leadsTab}!M2:M,"No")`],
    ["No cualificados", `=COUNTIF(${leadsTab}!E2:E,"No cualificado")`, "", "", "", "", "Ubicación", `=COUNTIF(${leadsTab}!N2:N,"No")`],
    ["Tasa de cualificación", "=IFERROR(B5/B4,0)", "", "", "", "", "Interés IA", `=COUNTIF(${leadsTab}!O2:O,"No")`],
    ["Leads hoy", `=COUNTIF(${leadsTab}!A2:A,TEXT(TODAY(),"yyyy-mm-dd")&"*")`],
    ["Últimos 7 días", `=COUNTIFS(${leadsTab}!A2:A,">="&TEXT(TODAY()-6,"yyyy-mm-dd"))`],
    [""],
    ["Leads por día", "Cantidad", "", "Leads cualificados de alta confianza"],
    [`=SORT(UNIQUE(FILTER(LEFT(${leadsTab}!A2:A,10),${leadsTab}!A2:A<>"")))`, `=ARRAYFORMULA(IF(A12:A="",,COUNTIF(${leadsTab}!A2:A,A12:A&"*")))`, "", `=IFERROR(FILTER({${leadsTab}!A2:A,${leadsTab}!D2:D,${leadsTab}!F2:F},${leadsTab}!E2:E="Cualificado",${leadsTab}!K2:K="Alta"),"Sin leads cualificados de alta confianza todavía")`]
  ];
}

async function getSheetChartIds(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number
): Promise<number[]> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find((item) => item.properties?.sheetId === sheetId);

  return (
    sheet?.charts
      ?.map((chart) => chart.chartId)
      .filter((chartId): chartId is number => typeof chartId === "number") ?? []
  );
}

function dashboardFormattingRequests(sheetId: number): sheets_v4.Schema$Request[] {
  return [
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
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
        mergeType: "MERGE_ALL"
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.05, green: 0.13, blue: 0.24 },
            horizontalAlignment: "CENTER",
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              fontSize: 18,
              bold: true
            }
          }
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)"
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 8 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.08, green: 0.18, blue: 0.31 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true
            }
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)"
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 3, endRowIndex: 9, startColumnIndex: 0, endColumnIndex: 8 },
        cell: {
          userEnteredFormat: {
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP"
          }
        },
        fields: "userEnteredFormat(verticalAlignment,wrapStrategy)"
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 1, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: "PERCENT", pattern: "0.0%" }
          }
        },
        fields: "userEnteredFormat.numberFormat"
      }
    },
    ...dashboardColumnWidths(sheetId)
  ] as unknown as sheets_v4.Schema$Request[];
}

function dashboardColumnWidths(sheetId: number): sheets_v4.Schema$Request[] {
  const widths = [190, 120, 28, 190, 120, 28, 190, 110, 28, 420, 28, 420];

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

function dashboardChartRequests(sheetId: number): sheets_v4.Schema$Request[] {
  return [
    {
      addChart: {
        chart: {
          spec: {
            title: "Cualificados vs no cualificados",
            pieChart: {
              legendPosition: "RIGHT_LEGEND",
              domain: {
                sourceRange: {
                  sources: [{ sheetId, startRowIndex: 3, endRowIndex: 5, startColumnIndex: 3, endColumnIndex: 4 }]
                }
              },
              series: {
                sourceRange: {
                  sources: [{ sheetId, startRowIndex: 3, endRowIndex: 5, startColumnIndex: 4, endColumnIndex: 5 }]
                }
              }
            }
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: 1, columnIndex: 9 },
              widthPixels: 420,
              heightPixels: 280
            }
          }
        }
      }
    },
    {
      addChart: {
        chart: {
          spec: {
            title: "Motivos de descarte",
            basicChart: {
              chartType: "BAR",
              legendPosition: "NO_LEGEND",
              axis: [
                { position: "BOTTOM_AXIS", title: "Fallos" },
                { position: "LEFT_AXIS", title: "Criterio" }
              ],
              domains: [
                {
                  domain: {
                    sourceRange: {
                      sources: [{ sheetId, startRowIndex: 3, endRowIndex: 7, startColumnIndex: 6, endColumnIndex: 7 }]
                    }
                  }
                }
              ],
              series: [
                {
                  series: {
                    sourceRange: {
                      sources: [{ sheetId, startRowIndex: 3, endRowIndex: 7, startColumnIndex: 7, endColumnIndex: 8 }]
                    }
                  }
                }
              ]
            }
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: 16, columnIndex: 9 },
              widthPixels: 420,
              heightPixels: 280
            }
          }
        }
      }
    },
    {
      addChart: {
        chart: {
          spec: {
            title: "Leads por día",
            basicChart: {
              chartType: "COLUMN",
              legendPosition: "NO_LEGEND",
              axis: [
                { position: "BOTTOM_AXIS", title: "Fecha" },
                { position: "LEFT_AXIS", title: "Leads" }
              ],
              domains: [
                {
                  domain: {
                    sourceRange: {
                      sources: [{ sheetId, startRowIndex: 11, endRowIndex: 50, startColumnIndex: 0, endColumnIndex: 1 }]
                    }
                  }
                }
              ],
              series: [
                {
                  series: {
                    sourceRange: {
                      sources: [{ sheetId, startRowIndex: 11, endRowIndex: 50, startColumnIndex: 1, endColumnIndex: 2 }]
                    }
                  }
                }
              ]
            }
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: 16, columnIndex: 3 },
              widthPixels: 420,
              heightPixels: 280
            }
          }
        }
      }
    }
  ] as unknown as sheets_v4.Schema$Request[];
}

async function normalizeExistingSheetValues(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string
): Promise<void> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A2:${columnLetter(header.length)}`
  });

  const rows = response.data.values ?? [];
  if (rows.length === 0) {
    return;
  }

  let changed = false;
  const normalizedRows = rows.map((row) => {
    const normalized = [...row];

    while (normalized.length < header.length) {
      normalized.push("");
    }

    const formattedTimestamp = formatTimestampForSheet(String(normalized[0] ?? ""));
    const formattedAutomationInterest = formatAutomationInterestForSheet(normalized[9]);
    const formattedConfidence = formatConfidenceForSheet(String(normalized[10] ?? ""));
    const formattedSectorCriterion = formatCriterionForSheet(normalized[11], deriveSectorCriterion(normalized));
    const formattedSizeCriterion = formatCriterionForSheet(normalized[12], deriveSizeCriterion(normalized));
    const formattedLocationCriterion = formatCriterionForSheet(
      normalized[13],
      deriveLocationCriterion(normalized)
    );
    const formattedInterestCriterion = formatCriterionForSheet(
      normalized[14],
      formattedAutomationInterest === "Sí"
    );

    if (
      normalized[0] !== formattedTimestamp ||
      normalized[9] !== formattedAutomationInterest ||
      normalized[10] !== formattedConfidence ||
      normalized[11] !== formattedSectorCriterion ||
      normalized[12] !== formattedSizeCriterion ||
      normalized[13] !== formattedLocationCriterion ||
      normalized[14] !== formattedInterestCriterion
    ) {
      changed = true;
    }

    normalized[0] = formattedTimestamp;
    normalized[9] = formattedAutomationInterest;
    normalized[10] = formattedConfidence;
    normalized[11] = formattedSectorCriterion;
    normalized[12] = formattedSizeCriterion;
    normalized[13] = formattedLocationCriterion;
    normalized[14] = formattedInterestCriterion;

    return normalized.slice(0, header.length);
  });

  if (!changed) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A2:${columnLetter(header.length)}${rows.length + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: normalizedRows }
  });
}

function toSheetValues(row: LeadSheetRow): Array<string | number | boolean> {
  const { qualification } = row;

  return [
    formatTimestampForSheet(row.timestamp),
    String(row.telegramChatId),
    String(row.telegramMessageId),
    row.rawLeadText,
    qualification.decision,
    qualification.reason,
    qualification.extracted.business_type ?? "",
    qualification.extracted.employee_count ?? "",
    qualification.extracted.location ?? "",
    formatAutomationInterestForSheet(qualification.extracted.automation_or_ai_interest),
    formatConfidenceForSheet(qualification.confidence),
    formatBooleanForSheet(qualification.criteria.services_or_consulting),
    formatBooleanForSheet(qualification.criteria.min_5_employees),
    formatBooleanForSheet(qualification.criteria.spain_or_latam),
    formatBooleanForSheet(qualification.criteria.automation_or_ai_interest)
  ];
}

function formatTimestampForSheet(value: string): string {
  const trimmed = value.trim();

  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]} ${isoMatch[2]}:${isoMatch[3]}`;
  }

  const compactMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/);
  if (compactMatch) {
    return `${compactMatch[1]} ${compactMatch[2]}:${compactMatch[3]}`;
  }

  const parsedDate = new Date(trimmed);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().slice(0, 16).replace("T", " ");
  }

  return trimmed;
}

function formatConfidenceForSheet(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized === "high" || normalized === "alta") {
    return "Alta";
  }

  if (normalized === "medium" || normalized === "media") {
    return "Media";
  }

  if (normalized === "low" || normalized === "baja") {
    return "Baja";
  }

  return value;
}

function formatAutomationInterestForSheet(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (normalized === "true" || normalized === "si" || normalized === "sí") {
    return "Sí";
  }

  if (normalized === "false" || normalized === "no") {
    return "No";
  }

  return String(value);
}

function formatBooleanForSheet(value: boolean): string {
  return value ? "Sí" : "No";
}

function formatCriterionForSheet(value: unknown, fallback: boolean | null): string {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "sí" || normalized === "si" || normalized === "true") {
    return "Sí";
  }

  if (normalized === "no" || normalized === "false") {
    return "No";
  }

  if (fallback === null) {
    return "";
  }

  return formatBooleanForSheet(fallback);
}

function deriveSectorCriterion(row: unknown[]): boolean | null {
  const decision = String(row[4] ?? "");
  const reason = normalizeText(String(row[5] ?? ""));
  const sector = String(row[6] ?? "").trim();

  if (decision === "Cualificado") {
    return true;
  }

  if (reason.includes("sector") || reason.includes("restaurante") || reason.includes("inversion")) {
    return false;
  }

  return sector ? true : null;
}

function deriveSizeCriterion(row: unknown[]): boolean | null {
  const employees = Number.parseInt(String(row[7] ?? ""), 10);

  if (Number.isNaN(employees)) {
    return null;
  }

  return employees >= 5;
}

function deriveLocationCriterion(row: unknown[]): boolean | null {
  const decision = String(row[4] ?? "");
  const reason = normalizeText(String(row[5] ?? ""));
  const location = normalizeText(String(row[8] ?? ""));

  if (decision === "Cualificado") {
    return true;
  }

  if (reason.includes("ubicacion") || location.includes("alemania")) {
    return false;
  }

  return location ? true : null;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function columnLetter(columnCount: number): string {
  let remaining = columnCount;
  let result = "";

  while (remaining > 0) {
    const remainder = (remaining - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    remaining = Math.floor((remaining - 1) / 26);
  }

  return result;
}
