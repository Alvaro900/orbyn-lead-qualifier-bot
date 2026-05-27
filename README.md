# Orbyn Lead Qualifier Bot

Bot de Telegram que recibe leads en texto libre, los cualifica contra el ICP de Orbyn y registra cada mensaje en una Google Sheet.

## Qué hace

El bot analiza mensajes como:

```text
Empresa de consultoría, 15 empleados, Madrid, quieren automatizar su proceso de ventas.
```

Después responde en el mismo chat con una decisión corta:

```text
Cualificado
Cumple sector compatible, tamaño mínimo, ubicación e interés en automatización o IA.
Cumple sector, tamaño, ubicación e interés en automatización/IA.
```

También guarda una fila por lead en la pestaña `Leads` de Google Sheets.

## Arquitectura

- `src/index.ts`: arranque del proceso, carga de configuración y cierre limpio.
- `src/telegramBot.ts`: handlers de Telegram, respuesta al usuario y logging del lead.
- `src/qualifier.ts`: llamada al LLM, validación con `zod` y recálculo de la decisión final.
- `src/fallbackQualifier.ts`: heurísticas básicas si falla el LLM o no hay API key.
- `src/googleSheets.ts`: creación/validación de pestaña `Leads` y append de filas.
- `src/types.ts`: tipos compartidos.
- `src/runTestCases.ts`: comprobación local de los 6 casos obligatorios con fallback.

## Stack

- Node.js + TypeScript.
- `telegraf` para Telegram.
- SDK oficial de OpenAI para el LLM.
- Google Sheets API con cuenta de servicio.
- `zod` para validar la salida estructurada.
- `dotenv` para variables de entorno.


