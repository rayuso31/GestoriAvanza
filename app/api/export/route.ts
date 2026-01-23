// API Route: /api/export
// Generates a CLEAN Excel for UiPath RPA automation
// Simple, readable format with only essential columns

import ExcelJS from 'exceljs';

export async function POST(request: Request) {
    try {
        const { invoices, settings } = await request.json();

        if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
            return Response.json({ error: 'No invoices provided' }, { status: 400 });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Facturas');

        // Clean, simple headers for UiPath
        worksheet.columns = [
            { header: 'Fecha', key: 'fecha', width: 12 },
            { header: 'Proveedor', key: 'proveedor', width: 35 },
            { header: 'NIF', key: 'nif', width: 15 },
            { header: 'Nº Factura', key: 'numFactura', width: 20 },
            { header: 'Base', key: 'base', width: 12 },
            { header: 'IVA %', key: 'ivaPct', width: 8 },
            { header: 'Cuota IVA', key: 'cuotaIva', width: 12 },
            { header: 'Total', key: 'total', width: 12 },
            { header: 'Cuenta Proveedor', key: 'cuenta', width: 18 },
            { header: 'Debe/Haber', key: 'debeHaber', width: 12 }
        ];

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8E8E8' }
        };

        // Helper to pad account numbers to 10 digits (same logic as before)
        const padAccount = (code: string | undefined | null) => {
            if (!code) return settings?.codigoProveedor || '';

            // Dot expansion (e.g. "520.1" -> "5200000001")
            if (code.includes('.')) {
                const [prefix, suffix] = code.split('.');
                const safePrefix = prefix || '';
                const safeSuffix = suffix || '';
                const totalLength = 10;
                const zeros = Math.max(0, totalLength - safePrefix.length - safeSuffix.length);
                return safePrefix + '0'.repeat(zeros) + safeSuffix;
            }

            const cleanCode = code.replace(/[^0-9]/g, '');

            // Full Account Number (8+ digits)
            if (cleanCode.length >= 8) return cleanCode;

            // Short Suffix for Provider (e.g. "1" -> "4000000001")
            const prefix = '400';
            const totalLength = 10;
            const zeros = Math.max(0, totalLength - prefix.length - cleanCode.length);
            return prefix + '0'.repeat(zeros) + cleanCode;
        };

        // Helper: Safe round to 2 decimals
        const round2 = (n: any) => {
            const num = Number(n);
            if (isNaN(num)) return 0;
            return Math.round((num + Number.EPSILON) * 100) / 100;
        };

        // Add data rows
        invoices.forEach((inv: {
            fecha?: string;
            numero_factura?: string;
            base_imponible?: number;
            cuota_iva?: number;
            total?: number;
            proveedor?: string;
            cif_proveedor?: string;
            codigo_proveedor?: string;
        }) => {
            const base = round2(inv.base_imponible);
            const cuotaIva = round2(inv.cuota_iva);
            const total = round2(inv.total);

            // Calculate IVA percentage
            let pctIva = 21;
            if (base > 0) {
                pctIva = round2((cuotaIva / base) * 100);
            }

            const paddedAccount = padAccount(inv.codigo_proveedor);

            // Debe/Haber: SI = Debe, NO = Haber
            const debeHaber = settings?.isDebe ? 'SI' : 'NO';

            const row = worksheet.addRow({
                fecha: inv.fecha || '',
                proveedor: inv.proveedor || '',
                nif: inv.cif_proveedor || '',
                numFactura: inv.numero_factura || '',
                base: base,
                ivaPct: pctIva,
                cuotaIva: cuotaIva,
                total: total,
                cuenta: paddedAccount,
                debeHaber: debeHaber
            });

            // Format number columns
            row.getCell('base').numFmt = '#,##0.00';
            row.getCell('ivaPct').numFmt = '0';
            row.getCell('cuotaIva').numFmt = '#,##0.00';
            row.getCell('total').numFmt = '#,##0.00';
        });

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="Facturas_UiPath_${new Date().toISOString().split('T')[0]}.xlsx"`,
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
