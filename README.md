# 💰 DompetKu — Pencatat Pengeluaran Harian (PWA)

![Version](https://img.shields.io/badge/version-1.0.0-gold)
![PWA](https://img.shields.io/badge/PWA-ready-brightgreen)
![Offline](https://img.shields.io/badge/offline-capable-blue)

Aplikasi Progressive Web App (PWA) untuk mencatat dan mengelola pengeluaran harian, dengan sinkronisasi otomatis ke Google Sheets dan notifikasi pengingat harian.

---

## 📁 Struktur Project

```
dompetku/
├── index.html              ← Halaman utama
├── style.css               ← Stylesheet (dark premium theme)
├── app.js                  ← Logic utama (IndexedDB, Sync, Notif)
├── manifest.json           ← PWA manifest
├── service-worker.js       ← Offline caching & background sync
├── offline.html            ← Halaman fallback saat offline
├── generate-icons.py       ← Script untuk generate icon PNG
├── icons/
│   ├── icon.svg            ← Master icon (SVG)
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-192.png
│   ├── icon-384.png
│   └── icon-512.png
└── google-apps-script/
    └── Code.gs             ← Script untuk Google Sheets backend
```

---

## 🚀 Cara Deploy

### Option 1: GitHub Pages (Gratis & Mudah)

1. **Buat repository baru** di GitHub
   ```
   https://github.com/new
   ```

2. **Upload semua file** ke repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: DompetKu PWA"
   git remote add origin https://github.com/USERNAME/dompetku.git
   git push -u origin main
   ```

3. **Aktifkan GitHub Pages:**
   - Buka Settings repository → Pages
   - Source: Branch `main`, folder `/` (root)
   - Klik Save
   - URL akan tersedia di: `https://USERNAME.github.io/dompetku`

4. **Pastikan HTTPS aktif** (GitHub Pages otomatis HTTPS) — Service Worker **wajib** HTTPS.

---

### Option 2: Netlify (Drag & Drop)

1. Buka [netlify.com](https://netlify.com) dan daftar/login
2. Drag & drop **folder project** ke dashboard Netlify
3. Netlify akan otomatis deploy dan memberikan URL
4. Custom domain bisa diatur di Settings

---

### Option 3: Vercel

```bash
npm install -g vercel
cd dompetku
vercel
# Ikuti instruksi, pilih Static HTML
```

---

### Option 4: Server Sendiri / VPS

Upload semua file ke web server dengan konfigurasi:

**Nginx config:**
```nginx
server {
    listen 443 ssl;
    server_name dompetku.yourdomain.com;
    root /var/www/dompetku;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # MIME types penting untuk PWA
    location ~* \.json$ {
        add_header Content-Type application/json;
    }

    # Cache assets
    location ~* \.(js|css|png|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

> ⚠️ **Wajib HTTPS** untuk Service Worker & Push Notifications!

---

## 🔗 Cara Menghubungkan ke Google Spreadsheet

### Langkah 1: Buat Google Spreadsheet

1. Buka [Google Sheets](https://sheets.google.com)
2. Buat spreadsheet baru, beri nama **"DompetKu - Pengeluaran"**
3. Catat **Spreadsheet ID** dari URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```

---

### Langkah 2: Setup Google Apps Script

1. Buka [Google Apps Script](https://script.google.com)
2. Klik **"New Project"**
3. Hapus kode default, paste seluruh isi file `google-apps-script/Code.gs`
4. (Opsional) Isi `SPREADSHEET_ID` di baris 17 jika ingin menggunakan spreadsheet tertentu
5. **Simpan project** (Ctrl+S), beri nama misalnya "DompetKu API"

---

### Langkah 3: Deploy sebagai Web App

1. Klik tombol **"Deploy"** (kanan atas)
2. Pilih **"New deployment"**
3. Klik ⚙️ gear icon → pilih **"Web app"**
4. Isi konfigurasi:
   - **Description:** DompetKu API v1
   - **Execute as:** `Me (email@gmail.com)`
   - **Who has access:** `Anyone`
5. Klik **"Deploy"**
6. **Authorize** akses ke Google Sheets saat diminta
7. **Copy URL** Web App yang diberikan

   Format URL:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```

---

### Langkah 4: Konfigurasi di DompetKu

1. Buka aplikasi DompetKu
2. Scroll ke bawah form input
3. Klik **"⚙️ Konfigurasi Google Sheets"**
4. Paste URL Apps Script ke input
5. Klik **"Simpan Konfigurasi"**
6. Coba tambah pengeluaran → data akan otomatis terkirim ke Sheets!

---

### Struktur Spreadsheet Hasil

| Tanggal    | Nama Pengeluaran | Kategori              | Jumlah  | Catatan    | Waktu Sync          |
|------------|------------------|-----------------------|---------|------------|---------------------|
| 2024-01-15 | Makan Siang      | 🍽️ Makanan & Minuman | 25.000  | Nasi goreng| 15/01/2024 12:30:45 |
| 2024-01-15 | Bensin           | 🚗 Transportasi       | 50.000  |            | 15/01/2024 18:00:12 |

---

### Mode No-CORS

> Karena keterbatasan CORS pada Google Apps Script dengan mode `no-cors`, respons dari server tidak bisa dibaca langsung oleh browser. Aplikasi **mengasumsikan sukses** setelah request terkirim. Untuk verifikasi, cek langsung di Google Sheets apakah data masuk.

---

## 🔔 Cara Mengaktifkan Push Notification

### Di Browser (Desktop & Mobile)

1. Buka aplikasi DompetKu
2. Klik tombol **🔔** di pojok kanan atas header
3. Browser akan meminta izin notifikasi → klik **"Izinkan"**
4. Notifikasi pengingat akan muncul setiap hari **jam 20:00**

---

### Cara Kerja Notifikasi

Notifikasi menggunakan **Web Notifications API** langsung dari browser:

```
Jam 20:00 setiap malam:
→ "DompetKu — Pengingat Harian 🌙"
→ "Hari ini Anda sudah mencatat 3 pengeluaran (Rp 125.000). Sudah lengkap?"
```

Jika belum ada pengeluaran hari itu:
```
→ "Jangan lupa catat pengeluaran hari ini! Ketuk untuk membuka aplikasi."
```

---

### Notifikasi di Android (Setelah Install PWA)

1. Install aplikasi melalui tombol **"Install"** di header
2. Aktifkan notifikasi seperti langkah di atas
3. Notifikasi akan muncul seperti aplikasi native

---

### Troubleshooting Notifikasi

| Problem | Solusi |
|---------|--------|
| Tombol notifikasi tidak muncul | Browser tidak mendukung Web Notifications |
| Notifikasi diblokir | Settings browser → Site Settings → Notifications → Allow |
| Tidak muncul saat app ditutup | Normal untuk browser PWA tanpa Push Server |
| iOS Safari | Harus install PWA dulu ke homescreen |

> 📝 **Catatan:** Notifikasi saat app tertutup memerlukan Push Server (Firebase/web-push). Implementasi saat ini menggunakan scheduling di browser (tab harus terbuka atau PWA terinstall).

---

## 📱 Cara Install PWA

### Android (Chrome)
1. Buka URL aplikasi di Chrome
2. Akan muncul banner "Tambahkan ke layar utama"
3. Atau klik menu ⋮ → "Tambahkan ke layar utama"

### iOS (Safari)
1. Buka URL di Safari
2. Tap tombol Share (kotak dengan panah)
3. Scroll → "Add to Home Screen"
4. Ketuk "Add"

### Desktop (Chrome/Edge)
1. Klik tombol **"Install"** di header aplikasi
2. Atau klik ikon install di address bar browser

---

## 💾 Penyimpanan Data

| Storage | Digunakan untuk |
|---------|----------------|
| **IndexedDB** | Data pengeluaran utama (offline-capable) |
| **LocalStorage** | Konfigurasi (URL Sheets, preferensi) |
| **Google Sheets** | Backup cloud & laporan (via sync) |

---

## 🛠️ Fitur Lengkap

- ✅ Input pengeluaran (Tanggal, Nama, Kategori, Jumlah, Catatan)
- ✅ 10 kategori pengeluaran dengan emoji
- ✅ Summary cards (Total, Hari Ini, Kategori Terbesar)
- ✅ Tabel riwayat dengan sorting otomatis (terbaru di atas)
- ✅ Filter berdasarkan kategori & bulan
- ✅ Search real-time
- ✅ Export ke CSV
- ✅ Sync ke Google Sheets
- ✅ Indikator sync status (🟡 pending / 🟢 synced)
- ✅ Auto-sync saat online kembali
- ✅ Offline mode dengan IndexedDB
- ✅ Service Worker dengan Stale-While-Revalidate caching
- ✅ Offline fallback page
- ✅ Push Notification pengingat harian jam 20:00
- ✅ PWA installable (Android, iOS, Desktop)
- ✅ Responsive design (mobile-first)
- ✅ Hapus pengeluaran dengan konfirmasi modal

---

## 🎨 Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES2020+)
- **Storage:** IndexedDB, LocalStorage
- **PWA:** Service Worker, Web App Manifest
- **Notifications:** Web Notifications API
- **Backend:** Google Apps Script (serverless)
- **Database:** Google Sheets
- **Fonts:** Playfair Display + Outfit + DM Mono (Google Fonts)

---

## 📄 License

MIT License — Bebas digunakan dan dimodifikasi.
