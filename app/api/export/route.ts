// API Route: /api/export
// Generates IVS.xls format for Contasol (IVA Soportado)

export async function POST(request: Request) {
    try {
        const { invoices, settings } = await request.json();

        if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
            return Response.json({ error: 'No invoices provided' }, { status: 400 });
        }

        // IVS.xls Headers for Contasol (IVA Soportado)
        // Columns A-AA as per Contasol guide
        const headers = [
            'Codigo',           // A - N(5) - Índice único
            'Libro_IVA',        // B - N(1)
            'Fecha',            // C - Fecha DD/MM/AAAA
            'Cuenta',           // D - N(10) - Cuenta proveedor
            'Factura',          // E - A(30) - Número factura
            'Nombre',           // F - A(100) - Nombre proveedor
            'CIF',              // G - A(18)
            'Tipo_Operacion',   // H - N(1) - 0=Interior, 1=Import, 2=Intracom, 3=Agric
            'Deducible',        // I - N(1) - 0=Deducible, 1=No deducible, 2=Prorrata
            'Base_1',           // J - ND(15)
            'Base_2',           // K - ND(15)
            'Base_3',           // L - ND(15)
            'Pct_IVA_1',        // M - ND(5)
            'Pct_IVA_2',        // N - ND(5)
            'Pct_IVA_3',        // O - ND(5)
            'Pct_Recargo_1',    // P - ND(5)
            'Pct_Recargo_2',    // Q - ND(5)
            'Pct_Recargo_3',    // R - ND(5)
            'Importe_IVA_1',    // S - ND(15)
            'Importe_IVA_2',    // T - ND(15)
            'Importe_IVA_3',    // U - ND(15)
            'Importe_Recargo_1',// V - ND(15)
            'Importe_Recargo_2',// W - ND(15)
            'Importe_Recargo_3',// X - ND(15)
            'Total',            // Y - ND(15)
            'Bienes_Soportados' // Z - N(1) - 0=No, 1=Sí
        ];

        // Generate rows
        const rows = invoices.map((inv: {
            fecha?: string;
            numero_factura?: string;
            base_imponible?: number;
            cuota_iva?: number;
            total?: number;
            proveedor?: string;
            cif_proveedor?: string;
        }, index: number) => {
            // Calculate IVA percentage from base and cuota
            const base = inv.base_imponible || 0;
            const cuotaIva = inv.cuota_iva || 0;
            const pctIva = base > 0 ? Math.round((cuotaIva / base) * 100 * 100) / 100 : 21;

            // Format numbers with comma as decimal separator (Spanish format)
            const formatNum = (n: number) => n.toFixed(2).replace('.', ',');

            // Determine deducibility from settings
            let deducible = 0; // Default: Deducible
            if (settings?.deducibilidad === 'No Deducible') deducible = 1;
            else if (settings?.deducibilidad === '50%') deducible = 2; // Prorrata

            return [
                index + 1,                                    // A: Código (auto-increment)
                1,                                            // B: Libro IVA (1 = libro general)
                inv.fecha || '',                              // C: Fecha
                settings?.codigoProveedor || '',              // D: Cuenta proveedor
                inv.numero_factura || '',                     // E: Factura
                inv.proveedor || '',                          // F: Nombre
                inv.cif_proveedor || '',                      // G: CIF
                0,                                            // H: Tipo operación (0=Interior)
                deducible,                                    // I: Deducible
                formatNum(base),                              // J: Base 1
                formatNum(0),                                 // K: Base 2
                formatNum(0),                                 // L: Base 3
                formatNum(pctIva),                            // M: % IVA 1
                formatNum(0),                                 // N: % IVA 2
                formatNum(0),                                 // O: % IVA 3
                formatNum(0),                                 // P: % Recargo 1
                formatNum(0),                                 // Q: % Recargo 2
                formatNum(0),                                 // R: % Recargo 3
                formatNum(cuotaIva),                          // S: Importe IVA 1
                formatNum(0),                                 // T: Importe IVA 2
                formatNum(0),                                 // U: Importe IVA 3
                formatNum(0),                                 // V: Importe Recargo 1
                formatNum(0),                                 // W: Importe Recargo 2
                formatNum(0),                                 // X: Importe Recargo 3
                formatNum(inv.total || 0),                    // Y: Total
                0                                             // Z: Bienes soportados (0=No)
            ].map(field => {
                const str = String(field);
                // Escape quotes and wrap in quotes if contains separator
                if (str.includes(';') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(';');
        });

        // Build content
        const content = [headers.join(';'), ...rows].join('\r\n');

        // Add BOM for UTF-8 encoding in Excel
        const bom = '\uFEFF';
        const output = bom + content;

        // Return as downloadable .xls file (actually CSV but Contasol expects .xls extension)
        return new Response(output, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
                'Content-Disposition': `attachment; filename="IVS.xls"`,
            },
        });

    } catch (error) {
        console.error('[API Export] Error:', error);
        return Response.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
