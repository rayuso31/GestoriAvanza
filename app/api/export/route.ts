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

        // Create worksheet without headers (Contasol expects raw data starting at row 1)
        // We define columns for key mapping but leave 'header' undefined so ExcelJS doesn't write a header row.
        worksheet.columns = [
            { key: 'A', width: 10 }, // Código
            { key: 'B', width: 12 }, // Libro IVA
            { key: 'C', width: 12 }, // Fecha
            { key: 'D', width: 12 }, // Cuenta proveedor (Must be numeric or clean string)
            { key: 'E', width: 20 }, // Factura
            { key: 'F', width: 30 }, // Nombre
            { key: 'G', width: 15 }, // CIF
            { key: 'H', width: 15 }, // Tipo operación
            { key: 'I', width: 10 }, // Deducible
            { key: 'J', width: 12 }, // Base 1
            { key: 'K', width: 12 }, // Base 2
            { key: 'L', width: 12 }, // Base 3
            { key: 'M', width: 10 }, // % IVA 1
            { key: 'N', width: 10 }, // % IVA 2
            { key: 'O', width: 10 }, // % IVA 3
            { key: 'P', width: 12 }, // Exp Recargo 1
            { key: 'Q', width: 12 },
            { key: 'R', width: 12 },
            { key: 'S', width: 15 }, // Importe IVA 1
            { key: 'T', width: 15 },
            { key: 'U', width: 15 },
            { key: 'V', width: 18 }, // Importe Recargo 1
            { key: 'W', width: 18 },
            { key: 'X', width: 18 },
            { key: 'Y', width: 15 }, // Total
            { key: 'Z', width: 15 } // Bienes soportados
        ];

        // Helper to pad account numbers to 10 digits (Contasol format)
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
            // If user explicitly provides a long number (8+ digits), respect it completely.
            if (cleanCode.length >= 8) return cleanCode;

            // CASE 3: Short Suffix for Provider (e.g. "1" -> "4000000001")
            // If just a short number, assume it's a suffix for the main provider group (400)
            const prefix = '400';
            const totalLength = 10;
            const zeros = Math.max(0, totalLength - prefix.length - cleanCode.length);
            return prefix + '0'.repeat(zeros) + cleanCode;
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

            // Pad the account code
            const paddedAccount = padAccount(inv.codigo_proveedor || settings?.codigoProveedor);

            worksheet.addRow({
                A: index + 1,
                B: 1, // Libro IVA general
                C: inv.fecha || '',
                D: paddedAccount, // Automatic padding to 10 digits
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
