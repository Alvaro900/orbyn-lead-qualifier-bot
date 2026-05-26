# Mejoras de producción

1. En producción añadiría colas, reintentos con backoff e idempotencia por `message_id` para que ningún lead se pierda si falla Google Sheets, Telegram o el proveedor LLM.
2. Endurecería la defensa contra prompt injection tratando siempre el texto del lead como datos, validando la salida con un schema estricto y separando reglas de negocio del contenido enviado por el usuario.
3. Controlaría costes y latencia con límites de longitud, caché o heurísticas previas para casos simples, elección dinámica de modelo, monitorización de tokens y alertas de errores.

## Email de entrega

```text
Asunto: Entrega prueba técnica - Bot cualificador de leads Telegram

Hola,

Os envío la entrega de la prueba técnica.

Username del bot de Telegram:
@[USERNAME_DEL_BOT]

Repositorio GitHub:
[URL_DEL_REPO]

Vídeo de explicación de 1 minuto:
[URL_DEL_VIDEO]

Google Sheet de logging, si queréis revisarla:
[URL_DE_LA_SHEET]

Mejoras para producción:
1. En producción añadiría colas, reintentos con backoff e idempotencia por message_id para que ningún lead se pierda si falla Google Sheets, Telegram o el proveedor LLM.
2. Endurecería la defensa contra prompt injection tratando siempre el texto del lead como datos, validando la salida con un schema estricto y separando reglas de negocio del contenido enviado por el usuario.
3. Controlaría costes y latencia con límites de longitud, caché o heurísticas previas para casos simples, elección dinámica de modelo, monitorización de tokens y alertas de errores.

Un saludo,
Álvaro
```
