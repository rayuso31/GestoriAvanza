// API Route: /api/export
// Generates a CSV file from invoice data

export async function POST(request: Request) {
    try {
        const { invoices, settings } = await request.json();

        if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
            return Response.json({ error: 'No invoices provided' }, { status: 400 });
        }

        // CSV Headers matching Contasol format
        const headers = [
            'Codigo_Proveedor',
            'Tipo_Documento',
            'Fecha',
            'Numero_Factura',
            'Base_Imponible',
            'Cuota_IVA',
            'Total',
            'Proveedor',
            'CIF_Proveedor',
            'Deducibilidad'
        ];

        // Generate CSV rows
        const rows = invoices.map((inv: {
            fecha?: string;
            numero_factura?: string;
            base_imponible?: number;
            cuota_iva?: number;
            total?: number;
            proveedor?: string;
            cif_proveedor?: string;
        }) => {
            return [
                settings?.codigoProveedor || '',
                settings?.tipoDocumento || 'Factura Ordinaria',
                inv.fecha || '',
                inv.numero_factura || '',
                inv.base_imponible?.toString() || '0',
                inv.cuota_iva?.toString() || '0',
                inv.total?.toString() || '0',
                inv.proveedor || '',
                inv.cif_proveedor || '',
                settings?.deducibilidad || '100%'
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(';');
        });

        // Build CSV content (semicolon separator for Spanish Excel)
        const csvContent = [headers.join(';'), ...rows].join('\n');

        // Add BOM for proper UTF-8 encoding in Excel
        const bom = '\uFEFF';
        const csvWithBom = bom + csvContent;

        // Return as downloadable file
        return new Response(csvWithBom, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="facturas_${new Date().toISOString().split('T')[0]}.csv"`,
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
