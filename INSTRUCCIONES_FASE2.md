# Instrucciones Fase 2: Procesamiento por Lotes

¡Ya tenemos el sistema multivista funcionando! 🎉

## 1. Actualización en n8n
He desplegado dos nuevos workflows en tu sistema para separar la lógica. Debes activarlos:

1.  **Extracción Facturas (JSON)**:
    *   Este recibe el PDF y devuelve los datos para que los veas en la tabla.
    *   **Acción:** Abre el nodo **Mistral AI** y pon tu API KEY. Activa el workflow.

2.  **Generar Excel Final (Completo)**:
    *   He generado el archivo `n8n_export_workflow_full.json` para que lo importes manualmente.
    *   **Importar**: En n8n, ve a "Workflows" -> "Import from File" y selecciona el archivo json que he creado en tu carpeta `portal avanza`.
    *   **Configurar Google Sheets**: Abre el nodo "Google Sheets" y conecta tu cuenta de Google (Adminlex).
    *   **Activar**: Activa el workflow.
    *   **Endpoint**: Asegúrate de que la URL del webhook de este workflow termine en `/export-excel`.

## 2. Frontend
La web ya detecta automáticamente las URLs si mantienes la base en `.env.local`:
*   Extracción: `.../extract`
*   Exportación: `.../export-excel`

## 3. Uso
1.  Arrastra 5-10 facturas.
2.  Revisa con el **Ojo (Multivista)** si tienes dudas.
3.  Corrige importes en la tabla.
4.  Dale a **Exportar Excel**.
