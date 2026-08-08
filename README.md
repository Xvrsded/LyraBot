<div align="center">
  <img src="Public/QR Payment.jpg" alt="LyraBlox Banner" width="600" />

  # 🌟 LyraBot

  **Bot Discord Multi-Fungsi untuk Komunitas Roblox & Manajemen Toko Digital LyraBlox**

  [![Node.js](https://img.shields.io/badge/Node.js-v16.14.0+-green.svg)](https://nodejs.org/)
  [![Discord.js](https://img.shields.io/badge/Discord.js-v14-blue.svg)](https://discord.js.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen.svg)](https://www.mongodb.com/)
</div>

<br />

## 📖 Tentang LyraBot

LyraBot adalah bot Discord canggih yang dirancang khusus untuk mempermudah pengelolaan komunitas berbasis Roblox serta mengotomatisasi sistem toko digital langsung di dalam server Discord Anda. Dilengkapi dengan antarmuka yang ramah pengguna (Slash Commands & Buttons) dan integrasi database yang kuat.

---

## ✨ Fitur Unggulan

🛡️ **Sistem Verifikasi Roblox**
- Integrasi mulus antara akun Discord dan Roblox menggunakan `noblox.js`.
- Pemberian role otomatis berdasarkan status verifikasi dan kepemilikan grup/item.

🎫 **Sistem Tiket Lanjutan**
- Panel tiket interaktif berbasis tombol UI.
- Kategori tiket: *Support*, *Order*, *Custom UGC*, dan *Report*.
- Manajemen log tiket yang rapi dan terstruktur.

🛍️ **Manajemen Toko & Produk (E-Commerce)**
- Tambah, Edit, dan Hapus produk toko langsung dari Discord.
- Sistem pesanan interaktif: pengguna dapat melihat katalog dan memesan produk.
- Manajemen order untuk Admin (Accept, Reject, Complete).

🛠️ **Utilitas & Informasi**
- Command informasi server dan pengguna secara detail (`/serverinfo`, `/userinfo`).
- Pengecekan status bot dan latensi (`/ping`).
- Sistem Welcome & Goodbye yang dapat dikustomisasi.

---

## 🚀 Panduan Instalasi

Ikuti langkah-langkah di bawah ini untuk menjalankan LyraBot di server Anda sendiri.

### 📋 Persyaratan Sistem
- [Node.js](https://nodejs.org/) v16.14.0 atau yang lebih baru.
- Database [MongoDB](https://www.mongodb.com/) (Bisa menggunakan MongoDB Atlas yang gratis).
- Token Bot Discord dari [Discord Developer Portal](https://discord.com/developers/applications).

### 🛠️ Langkah Instalasi

1. **Clone Repository**
   ```bash
   git clone https://github.com/Xvrsded/LyraBot.git
   cd LyraBot
   ```

2. **Instalasi Dependencies**
   Pastikan Anda menginstal semua package yang dibutuhkan:
   ```bash
   npm install
   ```

3. **Konfigurasi Environment (`.env`)**
   Buat file bernama `.env` di folder utama (satu level dengan `package.json`) dan isi dengan konfigurasi berikut:
   ```env
   # --- Discord Bot Config ---
   TOKEN=YOUR_DISCORD_BOT_TOKEN
   CLIENT_ID=YOUR_BOT_CLIENT_ID
   GUILD_ID=YOUR_SERVER_ID

   # --- Database Config ---
   MONGO_URI=YOUR_MONGODB_URI

   # --- Roblox & Verification Config ---
   ROBLOX_COOKIE=YOUR_ROBLOX_SECURITY_COOKIE
   GROUP_ID=YOUR_ROBLOX_GROUP_ID
   ELIGIBLE_ROLE_ID=YOUR_DISCORD_ROLE_ID
   ```
   
   **📌 Cara Mendapatkan Masing-Masing Nilai:**
   - **`TOKEN`**: Buka [Discord Developer Portal](https://discord.com/developers/applications), pilih bot Anda, masuk ke menu **Bot**, klik **Reset Token**, lalu salin token tersebut. *(Jaga kerahasiaan token ini!)*
   - **`CLIENT_ID`**: Masih di Developer Portal, pada menu **General Information**, temukan **Application ID** lalu salin.
   - **`GUILD_ID`**: ID server Discord pengujian Anda. Aktifkan *Developer Mode* di pengaturan Discord (*Advanced* > *Developer Mode*), lalu klik kanan ikon server Anda dan pilih **Copy Server ID**.
   - **`MONGO_URI`**: Buat cluster gratis di [MongoDB Atlas](https://www.mongodb.com/atlas/database). Klik *Connect* > *Connect your application*, lalu salin string koneksi dan ganti `<password>` dengan password database user Anda.
   - **`ROBLOX_COOKIE`**: Login ke akun Roblox bot/alt di browser. Tekan `F12` (Developer Tools) -> tab **Application** -> **Cookies** -> `https://www.roblox.com`. Cari cookie bernama `.ROBLOSECURITY`. Salin seluruh isinya (termasuk teks peringatannya). *(Jaga kerahasiaan cookie ini karena dapat memberikan akses penuh ke akun!)*
   - **`GROUP_ID`**: ID Grup Roblox Anda. Buka halaman grup di Roblox, lalu lihat angka pada URL browser Anda (contoh: `roblox.com/groups/1234567/...` maka ID-nya adalah `1234567`).
   - **`ELIGIBLE_ROLE_ID`**: ID Role Discord yang akan diberikan kepada member (misalnya setelah verifikasi). Di pengaturan Server Discord, masuk ke tab *Roles*, klik kanan pada role yang diinginkan lalu pilih **Copy Role ID**.

4. **Jalankan Bot**
   ```bash
   npm start
   ```
   *Bot akan mulai berjalan dan terhubung ke Discord serta MongoDB.*

---

## 📂 Struktur Direktori Proyek

Proyek ini dibangun dengan arsitektur modular agar mudah dikembangkan:

```text
📦 src
 ┣ 📂 commands     # Kumpulan Slash Commands (admin, general, shop)
 ┣ 📂 events       # Event listeners Discord (ready, interactionCreate, dll)
 ┣ 📂 handlers     # Sistem handler otomatis untuk memuat command & event
 ┣ 📂 models       # Skema database Mongoose (User, Ticket, Product, dll)
 ┣ 📂 services     # Service eksternal (Integrasi API Roblox & Store)
 ┣ 📂 scripts      # Script utilitas dan pemeliharaan tambahan
 ┗ 📜 index.js     # Entry point aplikasi bot
```

---

## 🤝 Kontribusi

Kami sangat menyambut kontribusi! Jika Anda menemukan bug atau memiliki ide fitur baru, silakan buat *Pull Request* atau buka *Issue* di repositori ini.

---

<div align="center">
  Dibuat dengan ❤️ untuk komunitas Discord & Roblox.
</div>
