import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { cleanText } from '@/lib/carriers-2026/normalize';

export type ParsedSheet = {
  sheetIndex: number;
  name: string;
  headers: string[];
  totalRows: number;
  totalColumns: number;
  rows: Array<Record<string, string>>;
  sampleRows: Array<Record<string, string>>;
};

export type ParsedWorkbookResult = {
  fileHash: string;
  fingerprint: string;
  fileName: string;
  fileSizeBytes: number;
  sheets: ParsedSheet[];
};

function formatCellValue(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    if ('result' in value && value.result !== null && value.result !== undefined) {
      return cleanText(String(value.result));
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return cleanText(value.richText.map((p) => p.text).join(''));
    }
    if ('text' in value && typeof value.text === 'string') {
      return cleanText(value.text);
    }
    if ('hyperlink' in value && typeof value.hyperlink === 'string') {
      return cleanText(value.text || value.hyperlink);
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
  }

  return cleanText(String(value));
}

function calculateFingerprint(sheets: Array<{ name: string; headers: string[] }>): string {
  const normalized = sheets.map((s) => ({
    name: s.name.trim().toLowerCase(),
    headers: s.headers.map((h) => h.trim().toLowerCase()).sort(),
  }));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export async function parseUploadedWorkbook(
  buffer: Buffer,
  fileName: string
): Promise<ParsedWorkbookResult> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Nahraný soubor je prázdný.');
  }

  const maxSizeBytes = 30 * 1024 * 1024; // 30 MB
  if (buffer.length > maxSizeBytes) {
    throw new Error('Soubor přesahuje maximální povolenou velikost 30 MB.');
  }

  const fileHash = createHash('sha256').update(buffer).digest('hex');
  const workbook = new ExcelJS.Workbook();

  const isCsv = fileName.toLowerCase().endsWith('.csv') || fileName.toLowerCase().endsWith('.tsv');

  try {
    if (isCsv) {
      // Parse CSV / TSV
      const text = buffer.toString('utf-8').replace(/^\uFEFF/, '');
      const delimiter = text.includes('\t') && !text.includes(';') ? '\t' : text.includes(';') ? ';' : ',';
      
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        throw new Error('CSV soubor neobsahuje žádná data.');
      }

      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result.map((c) => c.replace(/^"|"$/g, '').trim());
      };

      const rawHeaders = parseLine(lines[0]);
      const headers = rawHeaders.map((h, idx) => (h ? h : `Sloupec_${idx + 1}`));
      const rows: Array<Record<string, string>> = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        if (values.every((v) => !v)) continue;
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || '';
        });
        rows.push(rowObj);
      }

      const parsedSheet: ParsedSheet = {
        sheetIndex: 0,
        name: fileName.replace(/\.[^/.]+$/, ''),
        headers,
        totalRows: rows.length,
        totalColumns: headers.length,
        rows,
        sampleRows: rows.slice(0, 5),
      };

      const fingerprint = calculateFingerprint([{ name: parsedSheet.name, headers }]);

      return {
        fileHash,
        fingerprint,
        fileName,
        fileSizeBytes: buffer.length,
        sheets: [parsedSheet],
      };
    } else {
      // Parse XLSX / XLS
      // ExcelJS load buffer:
      await workbook.xlsx.load(buffer as any);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('prázdný')) throw err;
    console.error('Workbook parse error:', err);
    throw new Error('Soubor se nepodařilo přečíst. Ujistěte se, že jde o platný a nepoškozený XLSX nebo CSV soubor.');
  }

  const sheets: ParsedSheet[] = [];

  workbook.eachSheet((worksheet, sheetId) => {
    // Determine header row: find first row with at least 2 non-empty cells
    let headerRowNumber = 1;
    let headers: string[] = [];

    const rowCount = worksheet.rowCount;
    for (let r = 1; r <= Math.min(rowCount, 10); r++) {
      const row = worksheet.getRow(r);
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = formatCellValue(cell);
      });

      const nonEmptyCount = cells.filter(Boolean).length;
      if (nonEmptyCount >= 2) {
        headerRowNumber = r;
        headers = cells.map((h, idx) => (h ? h : `Sloupec_${idx + 1}`));
        // Trim trailing empty headers
        while (headers.length > 0 && !headers[headers.length - 1]) {
          headers.pop();
        }
        break;
      }
    }

    if (headers.length === 0) {
      // Empty sheet
      return;
    }

    const rows: Array<Record<string, string>> = [];
    for (let r = headerRowNumber + 1; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      const rowObj: Record<string, string> = {};
      let hasValue = false;

      headers.forEach((header, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        const val = formatCellValue(cell);
        if (val) hasValue = true;
        rowObj[header] = val;
      });

      if (hasValue) {
        rows.push(rowObj);
      }
    }

    sheets.push({
      sheetIndex: sheetId - 1,
      name: worksheet.name,
      headers,
      totalRows: rows.length,
      totalColumns: headers.length,
      rows,
      sampleRows: rows.slice(0, 5),
    });
  });

  if (sheets.length === 0) {
    throw new Error('Soubor neobsahuje žádné listy s platnými datovými řádky.');
  }

  const fingerprint = calculateFingerprint(sheets);

  return {
    fileHash,
    fingerprint,
    fileName,
    fileSizeBytes: buffer.length,
    sheets,
  };
}
