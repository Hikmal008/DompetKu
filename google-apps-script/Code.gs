/* =====================================================
   DompetKu — Google Apps Script Backend (Code.gs)

   ADA DUA CARA PAKAI:
   ─────────────────────────────────────────────────
   A) Container-bound (CARA ANDA — lewat Ekstensi → Apps Script)
      → Tidak perlu isi SPREADSHEET_ID, otomatis terhubung
        ke spreadsheet tempat script ini dibuka.

   B) Standalone (lewat script.google.com langsung)
      → Isi SPREADSHEET_ID di bawah dengan ID spreadsheet Anda.

   CARA DEPLOY (sama untuk keduanya):
   1. Paste seluruh kode ini ke editor Apps Script
   2. Deploy → New Deployment → Web App
      - Execute as : Me
      - Who has access : Anyone
   3. Copy URL → paste ke konstanta SHEETS_URL di app.js
   ===================================================== */

// ── KONFIGURASI ────────────────────────────────────────
// Jika script dibuka dari dalam Google Sheets (Ekstensi → Apps Script),
// KOSONGKAN saja — script otomatis tahu spreadsheet mana yang dipakai.
const SPREADSHEET_ID = '';

// Nama tab/sheet tempat data disimpan
const SHEET_NAME = 'Pengeluaran';

// ── HANDLE POST ────────────────────────────────────────
function doPost(e) {
  try {
    console.log('doPost received:', JSON.stringify(e));

    const raw = e.postData && e.postData.contents;
    if (!raw) {
      console.error('postData kosong. e =', JSON.stringify(e));
      return jsonResponse({ status: 'error', message: 'Body request kosong' });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (parseErr) {
      console.error('Gagal parse JSON:', raw);
      return jsonResponse({ status: 'error', message: 'Body bukan JSON valid: ' + raw });
    }

    // Validasi field wajib
    const required = ['date', 'name', 'category', 'amount'];
    for (const field of required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        return jsonResponse({ status: 'error', message: 'Field "' + field + '" wajib diisi' });
      }
    }

    const sheet = getOrCreateSheet();

    const timestamp = Utilities.formatDate(new Date(), 'Asia/Makassar', 'dd/MM/yyyy HH:mm:ss');
    sheet.appendRow([
      data.date,
      data.name,
      data.category,
      Number(data.amount),
      data.notes || '',
      timestamp
    ]);

    console.log('Row appended OK:', data.name, data.amount);
    return jsonResponse({ status: 'ok', message: 'Data berhasil disimpan', timestamp: timestamp });

  } catch (err) {
    console.error('doPost error:', err.message);
    return jsonResponse({ status: 'error', message: err.message });
  }
}

// ── HANDLE GET ─────────────────────────────────────────
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;

    if (action === 'ping') {
      return jsonResponse({ status: 'ok', message: 'DompetKu API aktif' });
    }

    if (action === 'getData') {
      const sheet = getOrCreateSheet();
      const rows  = sheet.getDataRange().getValues();
      if (rows.length <= 1) return jsonResponse({ status: 'ok', data: [] });
      const headers = rows[0];
      const data    = rows.slice(1).map(row =>
        Object.fromEntries(headers.map((h, i) => [h, row[i]]))
      );
      return jsonResponse({ status: 'ok', data: data });
    }

    return jsonResponse({ status: 'ok', message: 'DompetKu API aktif. Gunakan POST untuk kirim data.' });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

// ── HELPER: Ambil spreadsheet & sheet yang tepat ───────
function getOrCreateSheet() {
  let spreadsheet;

  // Prioritas 1: Container-bound
  // Script dibuka dari dalam Google Sheets (Ekstensi → Apps Script)
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      spreadsheet = active;
      console.log('Mode: Container-bound ->', spreadsheet.getName());
    }
  } catch (_) {}

  // Prioritas 2: Standalone dengan SPREADSHEET_ID diisi manual
  if (!spreadsheet && SPREADSHEET_ID && SPREADSHEET_ID.trim() !== '') {
    spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    console.log('Mode: Standalone (openById) ->', spreadsheet.getName());
  }

  // Prioritas 3: Standalone tanpa ID — buat spreadsheet baru otomatis
  if (!spreadsheet) {
    const props   = PropertiesService.getScriptProperties();
    const savedId = props.getProperty('DOMPETKU_SHEET_ID');
    if (savedId) {
      try { spreadsheet = SpreadsheetApp.openById(savedId); } catch (_) {}
    }
    if (!spreadsheet) {
      spreadsheet = SpreadsheetApp.create('DompetKu — Pengeluaran');
      props.setProperty('DOMPETKU_SHEET_ID', spreadsheet.getId());
      console.log('Spreadsheet baru dibuat:', spreadsheet.getUrl());
    }
  }

  // Cari / buat tab dengan nama SHEET_NAME
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    setupSheetHeader(sheet);
  } else if (sheet.getLastRow() === 0) {
    setupSheetHeader(sheet);
  }

  return sheet;
}

// ── HELPER: Setup header & formatting ─────────────────
function setupSheetHeader(sheet) {
  const headers = ['Tanggal', 'Nama Pengeluaran', 'Kategori', 'Jumlah (Rp)', 'Catatan', 'Waktu Sync'];
  sheet.appendRow(headers);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setBackground('#1c2128')
    .setFontColor('#f5c842')
    .setFontWeight('bold')
    .setFontSize(11);

  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 170);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 200);
  sheet.setColumnWidth(6, 160);
  sheet.setFrozenRows(1);
}

// ── HELPER: JSON response ──────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── FUNGSI TES MANUAL (jalankan ini dari editor, bukan doPost) ──
function testDoPost() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        date:     '2025-03-15',
        name:     'Tes Makan Siang',
        category: '🍽️ Makanan & Minuman',
        amount:   25000,
        notes:    'Tes dari editor Apps Script'
      }),
      type: 'text/plain'
    }
  };

  const result = doPost(fakeEvent);
  console.log('Hasil:', result.getContent());
}