/* =====================================================
   DompetKu — Google Apps Script Backend (Code.gs)
   Endpoint: POST JSON → append row ke Google Sheets

   CARA DEPLOY:
   1. Buka https://script.google.com → New Project
   2. Paste seluruh isi file ini, ganti SPREADSHEET_ID di bawah
   3. Deploy → New Deployment → Web App
      - Execute as : Me
      - Who has access : Anyone
   4. Copy URL → paste ke konstanta SHEETS_URL di app.js
   ===================================================== */

// ── KONFIGURASI ────────────────────────────────────────
// Isi SPREADSHEET_ID dengan ID spreadsheet Google Sheets Anda.
// ID ada di URL: https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
// Kosongkan ('') untuk membuat spreadsheet baru otomatis.
const SPREADSHEET_ID = '';

// Nama sheet (tab) tempat data disimpan
const SHEET_NAME = 'Pengeluaran';

// ── HANDLE POST ────────────────────────────────────────
function doPost(e) {
  try {
    // Parse body JSON
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ status: 'error', message: 'Invalid JSON payload' }, 400);
    }

    // Validasi field wajib
    const required = ['date', 'name', 'category', 'amount'];
    for (const field of required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        return jsonResponse({ status: 'error', message: `Field "${field}" wajib diisi` }, 400);
      }
    }

    // Ambil / buat sheet
    const sheet = getOrCreateSheet();

    // Tambahkan baris data
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Makassar', 'dd/MM/yyyy HH:mm:ss');
    sheet.appendRow([
      data.date,
      data.name,
      data.category,
      Number(data.amount),
      data.notes || '',
      timestamp
    ]);

    return jsonResponse({ status: 'ok', message: 'Data berhasil disimpan', timestamp });

  } catch (err) {
    console.error('doPost error:', err);
    return jsonResponse({ status: 'error', message: err.message }, 500);
  }
}

// ── HANDLE GET (opsional: ambil semua data) ────────────
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;

    // Health check
    if (action === 'ping') {
      return jsonResponse({ status: 'ok', message: 'DompetKu API aktif 🟢' });
    }

    // Ambil semua data (untuk keperluan audit / backup)
    if (action === 'getData') {
      const sheet = getOrCreateSheet();
      const rows  = sheet.getDataRange().getValues();
      if (rows.length <= 1) {
        return jsonResponse({ status: 'ok', data: [] });
      }
      const headers = rows[0];
      const data    = rows.slice(1).map(row =>
        Object.fromEntries(headers.map((h, i) => [h, row[i]]))
      );
      return jsonResponse({ status: 'ok', data });
    }

    // Default: info API
    return jsonResponse({
      status:  'ok',
      message: 'DompetKu API — gunakan POST untuk mengirim data, ?action=ping untuk health check'
    });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message }, 500);
  }
}

// ── HELPER: Ambil / Buat Spreadsheet & Sheet ──────────
function getOrCreateSheet() {
  let spreadsheet;

  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== '') {
    // Gunakan spreadsheet yang sudah ada
    spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  } else {
    // Cek apakah sudah pernah dibuat (simpan ID di PropertiesService)
    const props     = PropertiesService.getScriptProperties();
    const savedId   = props.getProperty('DOMPETKU_SHEET_ID');

    if (savedId) {
      try {
        spreadsheet = SpreadsheetApp.openById(savedId);
      } catch (_) {
        // File dihapus, buat baru
        spreadsheet = null;
      }
    }

    if (!spreadsheet) {
      spreadsheet = SpreadsheetApp.create('DompetKu — Pengeluaran');
      props.setProperty('DOMPETKU_SHEET_ID', spreadsheet.getId());
      console.log('Spreadsheet baru dibuat: ' + spreadsheet.getUrl());
    }
  }

  // Cari / buat sheet tab dengan nama SHEET_NAME
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    setupSheetHeader(sheet);
  } else if (sheet.getLastRow() === 0) {
    // Sheet ada tapi kosong, pasang header
    setupSheetHeader(sheet);
  }

  return sheet;
}

// ── HELPER: Buat header baris pertama ─────────────────
function setupSheetHeader(sheet) {
  const headers = ['Tanggal', 'Nama Pengeluaran', 'Kategori', 'Jumlah (Rp)', 'Catatan', 'Waktu Sync'];
  sheet.appendRow(headers);

  // Styling header
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setBackground('#1c2128')
    .setFontColor('#f5c842')
    .setFontWeight('bold')
    .setFontSize(11);

  // Lebar kolom
  sheet.setColumnWidth(1, 110); // Tanggal
  sheet.setColumnWidth(2, 200); // Nama
  sheet.setColumnWidth(3, 170); // Kategori
  sheet.setColumnWidth(4, 120); // Jumlah
  sheet.setColumnWidth(5, 200); // Catatan
  sheet.setColumnWidth(6, 160); // Waktu Sync

  // Freeze header row
  sheet.setFrozenRows(1);
}

// ── HELPER: Format JSON response ──────────────────────
function jsonResponse(obj, statusCode) {
  const output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);

  // Catatan: ContentService tidak mendukung custom status code secara native.
  // Status code di sini hanya untuk dokumentasi internal — respons tetap 200.
  return output;
}