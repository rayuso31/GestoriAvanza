# Instrucciones de Puesta en Marcha (Final)

## 1. Workflow de n8n (YA CREADO)

He creado el workflow exitosamente en tu n8n con el nombre: **Procesamiento de Facturas a Contasol (Final)**.

Pasos que te faltan:
1.  Abre el workflow en n8n.
2.  Abre el nodo **Mistral AI** y configura tu **API Key**.
3.  Abre el nodo **Webhook** y copia la **Production URL**.
4.  **ACTIVA** el workflow (interruptor "Active" arriba a la derecha).

## 2. API Key de MCP

Recuerda que para que el agente pueda usar n8n en el futuro sin usar comandos manuales, debes actualizar la clave en tu archivo de configuración (`claude_desktop_config.json`) y reiniciar.

## 3. Conexión Frontend

1.  Crea/Edita `.env.local` en `portal avanza`:
    ```
    VITE_N8N_WEBHOOK_URL=TU_WEBHOOK_URL_COPIADA
    ```
    (Ejemplo: `https://primary-xdh7-production.up.railway.app/webhook/test`)

2.  Sube una factura y verifica la descarga del Excel.
