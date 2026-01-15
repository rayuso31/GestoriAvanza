// API Route: /api/extract
// Handles PDF/Image upload, OCR via Mistral, and data structuring via Claude

export const config = {
    api: {
        bodyParser: false, // Required for file uploads
    },
};

interface ExtractedData {
    fecha: string | null;
    numero_factura: string | null;
    base_imponible: number | null;
    cuota_iva: number | null;
    total: number | null;
    proveedor: string | null;
    cif_proveedor: string | null;
    error?: string;
}

async function parseMultipartForm(request: Request): Promise<{ file: File | null }> {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    return { file };
}

async function performOCR(file: File): Promise<string> {
    const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

    if (!MISTRAL_API_KEY) {
        throw new Error('MISTRAL_API_KEY not configured');
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type;

    const isPdf = mimeType === 'application/pdf';

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Transcribe TODO el texto visible de este documento exactamente como aparece. NO interpretes nada, solo extrae el texto crudo completo incluyendo números, fechas y nombres. Si hay tablas, mantén la estructura.'
                        },
                        {
                            type: isPdf ? 'document_url' : 'image_url',
                            [isPdf ? 'document_url' : 'image_url']: `data:${mimeType};base64,${base64}`
                        }
                    ]
                }
            ],
            max_tokens: 4096,
            temperature: 0
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mistral OCR failed: ${errorText}`);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || '';
}

async function structureData(ocrText: string): Promise<ExtractedData> {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: `Eres un experto contable español. Tu ÚNICA tarea es analizar texto extraído de facturas y devolver un JSON estructurado.

REGLAS ESTRICTAS:
1. Devuelve SOLO un objeto JSON válido, sin explicaciones ni texto adicional
2. Fechas en formato DD/MM/YYYY
3. Números con punto decimal (ej: 125.50), nunca comas
4. Si falta base_imponible, calcula: total - cuota_iva
5. Si falta cuota_iva, calcula: total - base_imponible
6. Si no encuentras un campo, pon null
7. El proveedor es quien EMITE la factura, no quien la recibe

ESTRUCTURA JSON OBLIGATORIA:
{
  "fecha": "DD/MM/YYYY",
  "numero_factura": "string",
  "base_imponible": number,
  "cuota_iva": number,
  "total": number,
  "proveedor": "string",
  "cif_proveedor": "string"
}`,
            messages: [
                {
                    role: 'user',
                    content: `Analiza el siguiente texto extraído por OCR de una factura y devuelve el JSON estructurado:\n\n${ocrText}`
                }
            ],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude structuring failed: ${errorText}`);
    }

    const result = await response.json();
    const content = result.content?.[0]?.text || '{}';

    // Clean markdown if present
    let cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = cleanedContent.indexOf('{');
    const lastBrace = cleanedContent.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanedContent = cleanedContent.substring(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(cleanedContent);
    } catch {
        return {
            fecha: null,
            numero_factura: null,
            base_imponible: null,
            cuota_iva: null,
            total: null,
            proveedor: null,
            cif_proveedor: null,
            error: 'Error parsing JSON from Claude'
        };
    }
}

export async function POST(request: Request) {
    try {
        // 1. Parse the uploaded file
        const { file } = await parseMultipartForm(request);

        if (!file) {
            return Response.json({ error: 'No file provided' }, { status: 400 });
        }

        // 2. Perform OCR with Mistral
        console.log('[API] Starting OCR for:', file.name);
        const ocrText = await performOCR(file);
        console.log('[API] OCR complete, text length:', ocrText.length);

        // 3. Structure data with Claude
        console.log('[API] Structuring data with Claude...');
        const structuredData = await structureData(ocrText);
        console.log('[API] Structured data:', structuredData);

        // 4. Return the result
        return Response.json(structuredData);

    } catch (error) {
        console.error('[API] Error:', error);
        return Response.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
