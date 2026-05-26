Hola, este es el bot de Telegram que cualifica leads para Orbyn.

Primero envío un lead en texto libre: "Empresa de consultoría, 15 empleados, Madrid, quieren automatizar su proceso de ventas".
El bot analiza el mensaje con un LLM, extrae sector, tamaño, ubicación e interés en automatización o IA, y aplica los cuatro criterios del ICP.

Como cumple todos los criterios, responde en el mismo chat que el lead está cualificado y explica brevemente el motivo.

Ahora envío un segundo ejemplo con solo 2 empleados. El bot lo marca como no cualificado porque no alcanza el mínimo de 5 empleados, aunque tenga interés en IA.

Por último, enseño la Google Sheet. Cada mensaje queda registrado con fecha, texto recibido, decisión, motivo y datos extraídos.

La solución está preparada con validación de salida, variables de entorno y una estructura sencilla para poder llevarla a producción con más control de errores, seguridad y costes.
