// API Route: /api/export
// Generates IVS.xlsx format for Contasol (IVA Soportado) using ExcelJS

import { Buffer } from 'buffer';
import ExcelJS from 'exceljs';

export async function POST(request: Request) {
    try {
        const { invoices, settings } = await request.json();

        if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
            return Response.json({ error: 'No invoices provided' }, { status: 400 });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('IVS');

        // Headers - Row 1
        // Contasol expects specific headers, but more importantly, specific column order.
        // We will use the standard column headers for clarity.
        worksheet.columns = [
            { header: 'Código', key: 'A', width: 10 },
            { header: 'Libro de IVA', key: 'B', width: 12 },
            { header: 'Fecha', key: 'C', width: 12 }, // Fecha
            { header: 'Cuenta', key: 'D', width: 12 }, // Cuenta proveedor
            { header: 'Factura', key: 'E', width: 20 }, // Numero factura
            { header: 'Nombre', key: 'F', width: 30 }, // Nombre proveedor
            { header: 'C.I.F.', key: 'G', width: 15 }, // CIF
            { header: 'Tipo de operación', key: 'H', width: 15 },
            { header: 'Deducible', key: 'I', width: 10 },
            { header: 'Base 1', key: 'J', width: 12 },
            { header: 'Base 2', key: 'K', width: 12 },
            { header: 'Base 3', key: 'L', width: 12 },
            { header: '% de IVA 1', key: 'M', width: 10 },
            { header: '% de IVA 2', key: 'N', width: 10 },
            { header: '% de IVA 3', key: 'O', width: 10 },
            { header: '% de recargo 1', key: 'P', width: 12 },
            { header: '% de recargo 2', key: 'Q', width: 12 },
            { header: '% de recargo 3', key: 'R', width: 12 },
            { header: 'Importe de IVA 1', key: 'S', width: 15 },
            { header: 'Importe de IVA 2', key: 'T', width: 15 },
            { header: 'Importe de IVA 3', key: 'U', width: 15 },
            { header: 'Importe de recargo 1', key: 'V', width: 18 },
            { header: 'Importe de recargo 2', key: 'W', width: 18 },
            { header: 'Importe de recargo 3', key: 'X', width: 18 },
            { header: 'Total', key: 'Y', width: 15 },
            { header: 'Bienes soportados', key: 'Z', width: 15 } // 0=No, 1=Sí
        ];

        // Add rows
        invoices.forEach((inv: {
            fecha?: string;
            numero_factura?: string;
            base_imponible?: number;
            cuota_iva?: number;
            total?: number;
            proveedor?: string;
            cif_proveedor?: string;
            codigo_proveedor?: string;
        }, index: number) => {
            // Calculate IVA percentage from base and cuota
            const base = inv.base_imponible || 0;
            const cuotaIva = inv.cuota_iva || 0;
            let pctIva = 21; // Default
            if (base > 0) {
                pctIva = Math.round((cuotaIva / base) * 100 * 100) / 100;
            }

            // Determine deducibility
            let deducible = 0; // 0 = Deducible
            if (settings?.deducibilidad === 'No Deducible') deducible = 1;
            else if (settings?.deducibilidad === '50%') deducible = 2; // Prorrata

            worksheet.addRow({
                A: index + 1,
                B: 1, // Libro IVA general
                C: inv.fecha || '',
                D: inv.codigo_proveedor || settings?.codigoProveedor || '40000000', // Default generic provider if missing
                E: inv.numero_factura || '',
                F: inv.proveedor || '',
                G: inv.cif_proveedor || '',
                H: 0, // Tipo operación: Interior
                I: deducible,
                J: base, // Base 1
                K: 0, // Base 2
                L: 0, // Base 3
                M: pctIva, // % IVA 1
                N: 0,
                O: 0,
                P: 0, // % Recargo 1
                Q: 0,
                R: 0,
                S: cuotaIva, // Importe IVA 1
                T: 0,
                U: 0,
                V: 0, // Importe Recargo 1
                W: 0,
                X: 0,
                Y: inv.total || 0,
                Z: 0 // Bienes soportados: No
            });
        });

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="IVS_${new Date().toISOString().split('T')[0]}.xlsx"`,
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
