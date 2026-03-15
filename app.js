/* =====================================================
   DompetKu — app.js
   Core App Logic: IndexedDB, Google Sheets, PWA, Notifications
   ===================================================== */

'use strict';

// ─── CONSTANTS ────────────────────────────────────────
const DB_NAME    = 'dompetku-db';
const DB_VERSION = 1;
const STORE_NAME = 'expenses';
const MONTHS_ID  = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];

// ── Google Apps Script URL ─────────────────────────────
// Ganti nilai berikut dengan URL Web App dari Google Apps Script Anda.
// Cara mendapatkannya: Deploy → New Deployment → Web App → Copy URL
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxvOTtR79tiTSZMhjz18V3npcxzYZlahHkLB72SaoxbU6QVCd_Z2TIXjK-ynrFW1_F0rQ/exec';

// ─── STATE ────────────────────────────────────────────
let db;
let expenses         = [];
let filteredExpenses = [];
let deleteTargetId   = null;
let deferredInstall  = null;

// ─── DOM REFS ─────────────────────────────────────────
const form           = document.getElementById('expense-form');
const tbody          = document.getElementById('expense-tbody');
const totalAmount    = document.getElementById('total-amount');
const totalCount     = document.getElementById('total-count');
const todayAmount    = document.getElementById('today-amount');
const todayCount     = document.getElementById('today-count');
const topCategory    = document.getElementById('top-category');
const topCategoryAmt = document.getElementById('top-category-amount');
const searchInput    = document.getElementById('search-input');
const filterCat      = document.getElementById('filter-category');
const filterMonth    = document.getElementById('filter-month');
const toast          = document.getElementById('toast');
const offlineBanner  = document.getElementById('offline-banner');
const syncBanner     = document.getElementById('sync-banner');
const installBtn     = document.getElementById('install-btn');
const notifBtn       = document.getElementById('notif-btn');
const syncBtn        = document.getElementById('sync-btn');
const exportCsvBtn   = document.getElementById('export-csv-btn');
const modalOverlay   = document.getElementById('modal-overlay');
const modalConfirm   = document.getElementById('modal-confirm');
const modalCancel    = document.getElementById('modal-cancel');

// ─── INIT ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setDefaultDate();
  await initDB();
  await loadExpenses();
  registerServiceWorker();
  setupOnlineOffline();
  setupInstallPrompt();
  updateNotifButton();
  renderAll();
});

// ─── DEFAULT DATE ─────────────────────────────────────
function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('date').value = today;
}

// ─── INDEXEDDB ────────────────────────────────────────
function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };

    req.onsuccess = (e) => { db = e.target.result; resolve(); };
    req.onerror   = (e) => { console.error('IndexedDB error:', e); reject(e); };
  });
}

function getAllExpenses() {
  return new Promise((resolve, reject) => {
    const tx   = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req  = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function addExpenseToDB(expense) {
  return new Promise((resolve, reject) => {
    const tx   = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req  = store.add(expense);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function deleteExpenseFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx   = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req  = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function markExpenseSynced(id) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.synced = true;
        store.put(item);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── LOAD & RENDER ────────────────────────────────────
async function loadExpenses() {
  expenses = await getAllExpenses();
  expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderAll() {
  applyFilters();
  renderTable();
  renderSummary();
  populateFilters();
}

function applyFilters() {
  const q   = searchInput.value.toLowerCase().trim();
  const cat = filterCat.value;
  const mon = filterMonth.value;

  filteredExpenses = expenses.filter(e => {
    const matchQ   = !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q);
    const matchCat = !cat || e.category === cat;
    const matchMon = !mon || e.date.startsWith(mon);
    return matchQ && matchCat && matchMon;
  });
}

function renderTable() {
  if (filteredExpenses.length === 0) {
    tbody.innerHTML = `
      <tr id="empty-row">
        <td colspan="6" class="empty-state">
          <div class="empty-icon">📋</div>
          <div>${expenses.length === 0 ? 'Belum ada pengeluaran tercatat' : 'Tidak ada hasil pencarian'}</div>
          <div class="empty-sub">${expenses.length === 0 ? 'Tambahkan pengeluaran pertama Anda di atas' : 'Coba ubah filter pencarian'}</div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filteredExpenses.map(e => `
    <tr data-id="${e.id}">
      <td class="td-date">${formatDateID(e.date)}</td>
      <td class="td-name">${escapeHtml(e.name)}</td>
      <td class="td-category">${escapeHtml(e.category)}</td>
      <td class="td-amount">${formatRupiah(e.amount)}<span class="sync-indicator ${e.synced ? 'synced' : 'pending'}" title="${e.synced ? 'Tersinkron' : 'Belum tersinkron'}"></span></td>
      <td class="td-notes" title="${escapeHtml(e.notes || '')}">${escapeHtml(e.notes || '')}</td>
      <td>
        <button class="btn-delete" onclick="confirmDelete('${e.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          Hapus
        </button>
      </td>
    </tr>
  `).join('');
}

function renderSummary() {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayExp = expenses.filter(e => e.date === todayStr);

  // Total
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  totalAmount.textContent = formatRupiah(total);
  totalCount.textContent  = `${expenses.length} transaksi`;

  // Today
  const todayTotal = todayExp.reduce((s, e) => s + e.amount, 0);
  todayAmount.textContent = formatRupiah(todayTotal);
  todayCount.textContent  = `${todayExp.length} transaksi`;

  // Top category
  const catMap = {};
  expenses.forEach(e => {
    catMap[e.category] = (catMap[e.category] || 0) + e.amount;
  });
  const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  if (cats.length > 0) {
    topCategory.textContent    = cats[0][0];
    topCategoryAmt.textContent = formatRupiah(cats[0][1]);
  } else {
    topCategory.textContent    = '—';
    topCategoryAmt.textContent = 'Rp 0';
  }
}

function populateFilters() {
  // Categories
  const cats = [...new Set(expenses.map(e => e.category))].sort();
  const prevCat = filterCat.value;
  filterCat.innerHTML = '<option value="">Semua Kategori</option>' +
    cats.map(c => `<option value="${c}"${c === prevCat ? ' selected' : ''}>${c}</option>`).join('');

  // Months
  const months = [...new Set(expenses.map(e => e.date.substring(0, 7)))].sort().reverse();
  const prevMon = filterMonth.value;
  filterMonth.innerHTML = '<option value="">Semua Bulan</option>' +
    months.map(m => {
      const [y, mo] = m.split('-');
      return `<option value="${m}"${m === prevMon ? ' selected' : ''}>${MONTHS_ID[parseInt(mo) - 1]} ${y}</option>`;
    }).join('');
}

// ─── FORM SUBMIT ──────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);

  const expense = {
    id:       `exp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    date:     data.get('date'),
    name:     data.get('name').trim(),
    category: data.get('category'),
    amount:   parseFloat(data.get('amount')),
    notes:    data.get('notes').trim(),
    synced:   false,
    createdAt: new Date().toISOString()
  };

  if (!expense.name || !expense.category || isNaN(expense.amount)) {
    showToast('Mohon lengkapi semua field yang diperlukan.', 'error');
    return;
  }

  try {
    await addExpenseToDB(expense);
    expenses.unshift(expense);

    // Reset form (keep date & category)
    const savedDate = document.getElementById('date').value;
    const savedCat  = document.getElementById('category').value;
    form.reset();
    document.getElementById('date').value     = savedDate;
    document.getElementById('category').value = savedCat;

    renderAll();
    showToast(`✅ Pengeluaran "${expense.name}" berhasil ditambahkan!`, 'success');

    // Auto-sync if online and URL configured
    if (navigator.onLine && SHEETS_URL && !SHEETS_URL.startsWith('GANTI')) {
      syncToSheets([expense]);
    }
  } catch (err) {
    console.error(err);
    showToast('Gagal menyimpan pengeluaran. Coba lagi.', 'error');
  }
});

// ─── DELETE ───────────────────────────────────────────
window.confirmDelete = function(id) {
  deleteTargetId = id;
  modalOverlay.classList.remove('hidden');
};

modalCancel.addEventListener('click', () => {
  deleteTargetId = null;
  modalOverlay.classList.add('hidden');
});

modalConfirm.addEventListener('click', async () => {
  if (!deleteTargetId) return;
  modalOverlay.classList.add('hidden');
  try {
    await deleteExpenseFromDB(deleteTargetId);
    expenses = expenses.filter(e => e.id !== deleteTargetId);
    deleteTargetId = null;
    renderAll();
    showToast('🗑️ Pengeluaran berhasil dihapus.', 'info');
  } catch (err) {
    showToast('Gagal menghapus pengeluaran.', 'error');
  }
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    deleteTargetId = null;
    modalOverlay.classList.add('hidden');
  }
});

// ─── SEARCH & FILTER ──────────────────────────────────
searchInput.addEventListener('input',  () => { applyFilters(); renderTable(); });
filterCat.addEventListener('change',   () => { applyFilters(); renderTable(); });
filterMonth.addEventListener('change', () => { applyFilters(); renderTable(); });

// ─── GOOGLE SHEETS SYNC ───────────────────────────────
syncBtn.addEventListener('click', async () => {
  const unsynced = expenses.filter(e => !e.synced);
  if (unsynced.length === 0) {
    showToast('✨ Semua data sudah tersinkron!', 'info');
    return;
  }
  if (!SHEETS_URL || SHEETS_URL.startsWith('GANTI')) {
    showToast('⚠️ URL Google Sheets belum dikonfigurasi di app.js.', 'error');
    return;
  }
  if (!navigator.onLine) {
    showToast('📡 Tidak ada koneksi internet. Data akan disinkronkan saat online.', 'error');
    return;
  }
  await syncToSheets(unsynced);
});

async function syncToSheets(items) {
  if (!SHEETS_URL || SHEETS_URL.startsWith('GANTI')) return;

  syncBanner.classList.remove('hidden');
  let successCount = 0;

  for (const item of items) {
    try {
      const payload = {
        date:     item.date,
        name:     item.name,
        category: item.category,
        amount:   item.amount,
        notes:    item.notes || ''
      };

      // Content-Type harus 'text/plain' saat mode:'no-cors'
      // Browser memblokir 'application/json' pada no-cors request
      await fetch(SHEETS_URL, {
        method: 'POST',
        mode:   'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body:   JSON.stringify(payload)
      });

      // mode:'no-cors' → response tidak bisa dibaca, asumsikan sukses
      await markExpenseSynced(item.id);
      item.synced = true;
      successCount++;
    } catch (err) {
      console.error('Sync error for item', item.id, err);
    }
  }

  syncBanner.classList.add('hidden');
  renderTable();

  if (successCount > 0) {
    showToast(`☁️ ${successCount} data berhasil disinkronkan ke Google Sheets!`, 'success');
  } else {
    showToast('❌ Gagal menyinkronkan. Periksa koneksi internet.', 'error');
  }
}

// ─── EXPORT CSV ───────────────────────────────────────
exportCsvBtn.addEventListener('click', () => {
  if (filteredExpenses.length === 0) {
    showToast('Tidak ada data untuk diekspor.', 'error');
    return;
  }

  const headers = ['Tanggal', 'Nama Pengeluaran', 'Kategori', 'Jumlah', 'Catatan'];
  const rows = filteredExpenses.map(e => [
    e.date, `"${e.name}"`, `"${e.category}"`, e.amount, `"${e.notes || ''}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `dompetku_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 File CSV berhasil diunduh!', 'success');
});

// ─── PUSH NOTIFICATIONS ───────────────────────────────
function updateNotifButton() {
  if (!('Notification' in window)) {
    notifBtn.style.display = 'none';
    return;
  }
  const status = Notification.permission;
  if (status === 'granted') {
    notifBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
    notifBtn.style.color = 'var(--accent-gold)';
    notifBtn.title = 'Notifikasi Aktif';
  }
}

notifBtn.addEventListener('click', async () => {
  if (!('Notification' in window)) {
    showToast('Browser Anda tidak mendukung notifikasi.', 'error');
    return;
  }

  if (Notification.permission === 'denied') {
    showToast('⚠️ Notifikasi diblokir. Aktifkan di pengaturan browser.', 'error');
    return;
  }

  if (Notification.permission === 'granted') {
    showToast('🔔 Notifikasi sudah aktif! Pengingat setiap jam 20:00.', 'info');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      scheduleDailyReminder();
      updateNotifButton();
      showToast('🔔 Notifikasi berhasil diaktifkan! Pengingat jam 20:00 setiap hari.', 'success');

      // Show test notification
      new Notification('DompetKu 🎉', {
        body: 'Notifikasi berhasil diaktifkan! Kami akan mengingatkan Anda setiap malam jam 20:00.',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png'
      });
    } else {
      showToast('Izin notifikasi ditolak.', 'error');
    }
  } catch (err) {
    showToast('Gagal mengaktifkan notifikasi.', 'error');
  }
});

function scheduleDailyReminder() {
  // Calculate ms until 20:00 tonight
  const now    = new Date();
  const target = new Date();
  target.setHours(20, 0, 0, 0);
  if (now >= target) target.setDate(target.getDate() + 1);

  const msUntil = target - now;

  setTimeout(() => {
    sendReminderNotification();
    // Then repeat every 24h
    setInterval(sendReminderNotification, 24 * 60 * 60 * 1000);
  }, msUntil);
}

function sendReminderNotification() {
  if (Notification.permission !== 'granted') return;
  const todayStr  = new Date().toISOString().split('T')[0];
  const todayExp  = expenses.filter(e => e.date === todayStr);
  const todayTot  = todayExp.reduce((s, e) => s + e.amount, 0);

  const body = todayExp.length > 0
    ? `Hari ini Anda sudah mencatat ${todayExp.length} pengeluaran (${formatRupiah(todayTot)}). Sudah lengkap?`
    : 'Jangan lupa catat pengeluaran hari ini! Ketuk untuk membuka aplikasi.';

  new Notification('DompetKu — Pengingat Harian 🌙', {
    body,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'daily-reminder'
  });
}

// ─── SERVICE WORKER ───────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => {
        console.log('SW registered:', reg.scope);
        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('🔄 Update tersedia! Refresh halaman untuk memperbarui.', 'info');
            }
          });
        });
      })
      .catch(err => console.error('SW registration failed:', err));

    // Listen for SW messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SYNC_PENDING') {
        const unsynced = expenses.filter(e => !e.synced);
        if (unsynced.length > 0 && SHEETS_URL && !SHEETS_URL.startsWith('GANTI')) {
          syncToSheets(unsynced);
        }
      }
    });
  }
}

// ─── ONLINE / OFFLINE ─────────────────────────────────
function setupOnlineOffline() {
  const update = () => {
    if (!navigator.onLine) {
      offlineBanner.classList.remove('hidden');
    } else {
      offlineBanner.classList.add('hidden');
      // Auto-sync on reconnect
      const unsynced = expenses.filter(e => !e.synced);
      if (unsynced.length > 0 && SHEETS_URL && !SHEETS_URL.startsWith('GANTI')) {
        setTimeout(() => syncToSheets(unsynced), 1500);
      }
    }
  };

  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}

// ─── PWA INSTALL ──────────────────────────────────────
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    installBtn.classList.remove('hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const result = await deferredInstall.userChoice;
    if (result.outcome === 'accepted') {
      showToast('🎉 DompetKu berhasil diinstall!', 'success');
      installBtn.classList.add('hidden');
    }
    deferredInstall = null;
  });

  window.addEventListener('appinstalled', () => {
    installBtn.classList.add('hidden');
    showToast('🎉 DompetKu berhasil diinstall!', 'success');
  });
}

// ─── TOAST ────────────────────────────────────────────
let toastTimer;
function showToast(message, type = 'info') {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className   = `toast ${type}`;
  toast.classList.remove('hidden');

  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// ─── HELPERS ──────────────────────────────────────────
function formatRupiah(num) {
  if (isNaN(num) || num === null) return 'Rp 0';
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

function formatDateID(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d} ${MONTHS_ID[parseInt(m) - 1].slice(0, 3)} ${y}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}