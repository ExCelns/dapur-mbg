# Notifikasi Menu MBG Harian (Discord + WhatsApp)

Bot sederhana yang cek `menu.json` dari situs SPPG Sicarjosari tiap hari, dan kalau ada menu untuk hari itu, kirim notifikasi otomatis ke Discord dan WhatsApp lewat GitHub Actions (gratis, tidak perlu server sendiri).

## Isi folder

```
notify-menu.js                     ← script utama (Node.js)
.github/workflows/menu-notify.yml  ← jadwal otomatis (GitHub Actions)
README.md                          ← panduan ini
```

## Langkah 1 — Buat repo GitHub

1. Buat repo baru di GitHub (boleh private).
2. Upload `notify-menu.js` ke root repo.
3. Upload `menu-notify.yml` ke path **`.github/workflows/menu-notify.yml`** (folder `.github/workflows/` harus persis seperti itu, ini yang dibaca GitHub Actions).

## Langkah 2 — Setup Discord (mudah, langsung jalan)

1. Buka server Discord kamu → **Server Settings → Integrations → Webhooks → New Webhook**.
2. Pilih channel tujuan, kasih nama (misal "Menu MBG"), lalu **Copy Webhook URL**.
3. Simpan URL ini untuk langkah 4 (secrets).

## Langkah 3 — Setup WhatsApp

Ini bagian yang perlu kamu tahu dulu: **tidak ada API WhatsApp gratis yang benar-benar "pasang-langsung-jalan"** untuk kebutuhan seperti ini. Berikut opsi realistisnya:

### Opsi A — CallMeBot (gratis, tapi saat ini penuh)

Script ini sudah saya siapkan pakai CallMeBot karena paling simpel untuk kasus notifikasi pribadi. Cara daftarnya:
1. Simpan nomor bot CallMeBot ke kontak WhatsApp kamu.
2. Kirim pesan `I allow callmebot to send me messages` ke nomor itu.
3. Bot akan balas dengan API key kamu (biasanya dalam 1-2 menit).

**Catatan penting:** saat saya cek halaman resmi mereka hari ini, statusnya *"bot sedang penuh, coba lagi beberapa hari lagi"* — nomor bot baru terlihat kalau slot sudah tersedia lagi. Jadi cek langsung ke halaman ini secara berkala: https://www.callmebot.com/blog/free-api-whatsapp-messages/

Kalau slot sudah kebuka dan kamu dapat API key, tinggal isi secrets `CALLMEBOT_PHONE` dan `CALLMEBOT_APIKEY` (langkah 4) — script sudah otomatis mengenali dan mengirim ke WhatsApp, tidak perlu ubah kode.

### Opsi B — Twilio WhatsApp API (berbayar kecil, lebih stabil)

Kalau tidak mau nunggu CallMeBot:
- Twilio adalah provider resmi yang direkomendasikan (bahkan oleh CallMeBot sendiri).
- Versi **Sandbox** gratis untuk testing, tapi ada 2 batasan yang bikin kurang cocok untuk notifikasi harian otomatis jangka panjang: (1) sesi sandbox **expired tiap 3 hari** dan kamu harus kirim ulang kode "join" dari WhatsApp, (2) nomor sandbox kadang **dibatasi untuk mengirim ke nomor Indonesia** oleh Twilio.
- Untuk pemakaian jangka panjang yang stabil, perlu daftar **WhatsApp sender resmi** di Twilio (perlu verifikasi bisnis + approval template pesan dari Meta) — sedikit lebih ribet tapi ini pilihan paling reliable.
- Saya bisa bantu bikinkan kode versi Twilio kalau kamu mau jalan ke arah ini.

### Opsi C — Pakai Telegram sebagai pengganti (bonus saran)

Kalau tujuan utamanya sekadar dapat notifikasi otomatis dan tidak harus WhatsApp, **Telegram Bot API 100% gratis, resmi, dan tidak ada antrian/limit** seperti CallMeBot. Setup-nya cuma chat `@BotFather` di Telegram, dapat token dalam semenit. Bilang saja kalau kamu mau versi ini juga disiapkan.

## Langkah 4 — Isi Secrets di GitHub

Di repo kamu: **Settings → Secrets and variables → Actions → New repository secret**. Tambahkan:

| Nama Secret | Isi |
|---|---|
| `DISCORD_WEBHOOK_URL` | URL webhook dari Langkah 2 |
| `CALLMEBOT_PHONE` | Nomor WhatsApp kamu dengan kode negara, contoh `6281234567890` |
| `CALLMEBOT_APIKEY` | API key dari CallMeBot |

Kalau salah satu channel belum siap (misal WhatsApp masih nunggu slot CallMeBot), tinggal isi secret Discord dulu — script otomatis skip WhatsApp tanpa error.

## Langkah 5 — Test manual

1. Buka tab **Actions** di repo kamu.
2. Pilih workflow **"Notifikasi Menu MBG Harian"**.
3. Klik **Run workflow** (tombol ini muncul karena ada `workflow_dispatch` di file yml).
4. Cek log-nya — kalau ada error (misal webhook salah), akan kelihatan di situ.

## Mengatur jam kirim

Defaultnya jam **06:00 WIB**. GitHub Actions pakai UTC, jadi WIB dikonversi -7 jam. Untuk ubah jam, edit baris `cron` di `menu-notify.yml`:

```
- cron: '0 23 * * *'   # 23:00 UTC = 06:00 WIB
```

Contoh lain: mau jam 07:30 WIB → `30 0 * * *` (00:30 UTC).

## Yang perlu kamu pahami

- Ini **bukan** notifikasi real-time saat data di-update — ini cek terjadwal 1x sehari, lalu kirim menu untuk tanggal hari itu kalau ada datanya di `menu.json`.
- Jadwal GitHub Actions kadang **meleset beberapa menit** dari waktu cron pada jam-jam sibuk (bukan garansi presisi ke detik) — ini batasan dari GitHub, bukan dari script.
- `menu.json` adalah file statis milik SPPG Sicarjosari, bukan API resmi — kalau strukturnya berubah suatu saat, script perlu disesuaikan.
