/**
 * DompetKu — Google Apps Script
 * File: Code.gs
 *
 * CARA SETUP:
 * 1. Buka https://script.google.com
 * 2. Buat project baru
 * 3. Paste seluruh kode ini
 * 4. Simpan (Ctrl+S)
 * 5. Klik "Deploy" > "New Deployment"
 * 6. Pilih type: "Web App"
 * 7. Execute as: "Me"
 * 8. Who has access: "Anyone"
 * 9. Deploy dan copy URL-nya
 * 10. Paste URL ke input "Google Apps Script URL" di DompetKu
 */

// ─── KONFIGURASI ─────────────────────────────────────
const SHEET_NAME    = 'Pengeluaran';
const HEADERS       = ['Tanggal', 'Nama Pengeluaran', 'Kategori', 'Jumlah', 'Catatan', 'Waktu Sync'];
const SPREADSHEET_ID = ''; // Kosongkan untuk pakai spreadsheet aktif,
                            // atau isi dengan ID spreadsheet tertentu

// ─── HANDLE POST REQUEST ─────────────────────────────
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    // Parse incoming data
    const data = JSON.parse(e.postData.contents);

    const ss    = SPREADSHEET_ID
      ? SpreadsheetApp.openById(SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();

    let sheet = ss.getSheetByName(SHEET_NAME);

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      setupSheetHeaders(sheet);
    }

    // Check if headers exist
    if (sheet.getLastRow() === 0) {
      setupSheetHeaders(sheet);
    }

    // Append the new row
    sheet.appendRow([
      data.date     || '',
      data.name     || '',
      data.category || '',
      Number(data.amount) || 0,
      data.notes    || '',
      new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })
    ]);

    // Auto-format the amount column as currency
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 4).setNumberFormat('"Rp "#,##0');

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, row: lastRow }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ─── HANDLE GET REQUEST (test) ────────────────────────
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'DompetKu Sheets API aktif!',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── SETUP HEADERS & FORMATTING ──────────────────────
function setupSheetHeaders(sheet) {
  // Write headers
  sheet.appendRow(HEADERS);

  // Style the header row
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange
    .setBackground('#0d1117')
    .setFontColor('#f5c842')
    .setFontWeight('bold')
    .setFontSize(11)
    .setHorizontalAlignment('center');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Set column widths
  sheet.setColumnWidth(1, 100); // Tanggal
  sheet.setColumnWidth(2, 200); // Nama Pengeluaran
  sheet.setColumnWidth(3, 160); // Kategori
  sheet.setColumnWidth(4, 130); // Jumlah
  sheet.setColumnWidth(5, 200); // Catatan
  sheet.setColumnWidth(6, 160); // Waktu Sync
}

// ─── BATCH IMPORT (opsional) ─────────────────────────
/**
 * Fungsi ini bisa dipanggil untuk batch import data dari JSON
 * Jalankan manual dari Apps Script editor jika perlu
 */
function batchImport() {
  // Contoh data JSON (ganti dengan data Anda)
  const sampleData = [
    { date: '2024-01-15', name: 'Makan Siang', category: '🍽️ Makanan & Minuman', amount: 25000, notes: 'Nasi goreng' },
    { date: '2024-01-15', name: 'Bensin', category: '🚗 Transportasi', amount: 50000, notes: '' }
  ];

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { sheet = ss.insertSheet(SHEET_NAME); setupSheetHeaders(sheet); }

  sampleData.forEach(data => {
    sheet.appendRow([
      data.date, data.name, data.category,
      data.amount, data.notes,
      new Date().toLocaleString('id-ID')
    ]);
  });

  SpreadsheetApp.getUi().alert(`Berhasil mengimpor ${sampleData.length} data!`);
}
