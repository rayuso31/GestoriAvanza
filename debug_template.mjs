
import ExcelJS from 'exceljs';
import path from 'path';

const filePath = '/Users/ruben/Desktop/PROYECTO/GESTORIA AVANZA/portal avanza/Plantillas XLSX - CONTASOL (Contabilidad general)/I.V.A. soportado/IVS.xlsx';

async function readTemplate() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1); // First sheet

    console.log('--- Row 1 (Headers?) ---');
    const row1 = worksheet.getRow(1);
    row1.eachCell((cell, colNumber) => {
        console.log(`Col ${colNumber}: ${cell.value} (Type: ${typeof cell.value})`);
    });

    console.log('\n--- Row 2 (Data Example?) ---');
    const row2 = worksheet.getRow(2);
    row2.eachCell((cell, colNumber) => {
        console.log(`Col ${colNumber}: ${cell.value} (Type: ${typeof cell.value}) Formatted: ${cell.text}`);
        if (cell.numFmt) console.log(`   Format: ${cell.numFmt}`);
    });
}

readTemplate().catch(console.error);
