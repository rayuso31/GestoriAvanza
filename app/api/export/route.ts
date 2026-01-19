// API Route: /api/export
// Generates IVS.xlsx format for Contasol (IVA Soportado) using ExcelJS
// Strictly aligned with official Contasol Templates (Plantillas XLSX)

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

        // Headers from Official Template (IVS.xlsx)
        // Verified: Row 1 contains titles.
        worksheet.columns = [
            { header: 'Código', key: 'A', width: 10 },
            { header: 'Libro de IVA', key: 'B', width: 12 },
            { header: 'Fecha', key: 'C', width: 12 },
            { header: 'Cuenta', key: 'D', width: 15 },
            { header: 'Factura', key: 'E', width: 20 },
            { header: 'Nombre', key: 'F', width: 30 },
            { header: 'C.I.F.', key: 'G', width: 15 },
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
            { header: 'Bienes soportados', key: 'Z', width: 15 }
        ];

        // Helper to pad account numbers to 10 digits (Contasol format)
        const padAccount = (code: string | undefined | null) => {
            if (!code) return '4000000000'; // Default fallback

            // CASE 1: Dot expansion (e.g. "520.1" -> "5200000001")
            if (code.includes('.')) {
                const [prefix, suffix] = code.split('.');
                const safePrefix = prefix || '';
                const safeSuffix = suffix || '';
                const totalLength = 10;
                const zeros = Math.max(0, totalLength - safePrefix.length - safeSuffix.length);
                return safePrefix + '0'.repeat(zeros) + safeSuffix;
            }

            const cleanCode = code.replace(/[^0-9]/g, ''); // Remove non-numeric chars

            // CASE 2: Full Account Number (e.g. "2810000000")
            if (cleanCode.length >= 8) return cleanCode;

            // CASE 3: Short Suffix for Provider (e.g. "1" -> "4000000001")
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
            // Calculate metrics (Safe Cast + Round)
            const base = round2(inv.base_imponible);
            const cuotaIva = round2(inv.cuota_iva);
            const total = round2(inv.total);

            let pctIva = 21; // Default
            if (base > 0) {
                // Derived percentage
                pctIva = round2((cuotaIva / base) * 100);
            }

            // Determine deducibility
            let deducible = 0; // 0 = Deducible
            if (settings?.deducibilidad === 'No Deducible') deducible = 1;
            else if (settings?.deducibilidad === '50%') deducible = 2; // Prorrata

            // Pad the account code
            const paddedAccount = padAccount(inv.codigo_proveedor || settings?.codigoProveedor);

            // Parse Date correctly
            let dateObj = new Date();
            if (inv.fecha) {
                const d = new Date(inv.fecha);
                if (!isNaN(d.getTime())) {
                    dateObj = d;
                }
            }

            // Helper: Return null for 0 to leave cell empty (Contasol style for unused columns)
            const nz = (v: number) => (v === 0 ? null : v);

            // Add row with raw numbers/dates
            const row = worksheet.addRow({
                A: null, // Let Contasol auto-assign Código/Asiento ID
                B: 1, // Libro IVA general
                C: dateObj, // Date Object
                D: paddedAccount, // String
                E: inv.numero_factura || '',
                F: inv.proveedor || '',
                G: inv.cif_proveedor || '',
                H: 0, // Tipo operación: Interior
                I: deducible,
                J: base, // Base 1
                K: nz(0),
                L: nz(0),
                M: pctIva, // % IVA 1
                N: nz(0),
                O: nz(0),
                P: nz(0),
                Q: nz(0),
                R: nz(0),
                S: cuotaIva, // Importe IVA 1
                T: nz(0),
                U: nz(0),
                V: nz(0),
                W: nz(0),
                X: nz(0),
                Y: total, // Total
                Z: 0 // Bienes soportados: No
            });

            // Format Date (Col C) - Display as dd/mm/yyyy
            row.getCell('C').numFmt = 'dd/mm/yyyy';

            // Format Money Columns (J..Y) - Standard Excel Number format with 2 decimals
            // Using custom Euro format as seen in template: #,##0.00 "€";[Red]-#,##0.00 "€"
            // This matches strictly what Contasol uses.
            const euroFmt = '#,##0.00 "€";[Red]-#,##0.00 "€"';

            ['J', 'K', 'L', 'S', 'T', 'U', 'V', 'W', 'X', 'Y'].forEach(col => {
                if (row.getCell(col).value !== null) {
                    row.getCell(col).numFmt = euroFmt;
                }
            });

            // Format Percentages
            ['M', 'N', 'O', 'P', 'Q', 'R'].forEach(col => {
                if (row.getCell(col).value !== null) {
                    row.getCell(col).numFmt = '0.00';
                }
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
