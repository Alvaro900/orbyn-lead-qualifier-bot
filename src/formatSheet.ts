import { loadConfig } from "./config.js";
import { formatLeadSheet } from "./googleSheets.js";

const config = loadConfig();

await formatLeadSheet(config);
console.log("SHEET_FORMATTED");
