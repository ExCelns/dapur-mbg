# Notifikasi Menu MBG Harian (Discord + WhatsApp)

Bot yang cek `menu.json` dari situs SPPG Sicarjosari **secara berkala** tiap hari, dan begitu menu hari itu tersedia, langsung kirim notifikasi otomatis ke Discord dan WhatsApp lewat GitHub Actions (gratis, tidak perlu server sendiri).

## Isi folder

```
notify-menu.js                     ← script utama (Node.js)
.github/workflows/menu-notify.yml  ← jadwal otomatis (GitHub Actions)
README.md                          ← panduan ini
```

## Cara kerja mekanisme cek berkala

- Workflow dipicu **tiap 30 menit, sepanjang hari** (`*/30 * * * *`).
- Tapi script hanya benar-benar memproses kalau jam saat itu ada di dalam jendela **06:00–11:00 WIB** (bisa diubah, lihat bagian "Mengatur jendela jam" di bawah). Di luar jendela itu, script langsung berhenti tanpa melakukan apa-apa — jadi tidak boros walau dipicu tiap 30 menit.
- Setiap kali berhasil mengirim notifikasi, script menulis tanggal hari itu ke file `.state/last-sent.json`, lalu workflow **commit & push** file itu balik ke repo.
- Run-run berikutnya di hari yang sama akan baca file ini dulu — kalau tanggalnya sudah cocok, langsung skip (tidak fetch ulang, tidak kirim ulang).
- Kalau menu belum ada saat dicek (misal masih kosong jam 06:00), script diam dan **otomatis coba lagi** di run 30 menit berikutnya, sampai ketemu atau jendela jam habis.

Dengan begini, kapan pun tim SPPG publish menu hari itu (asal masih dalam jendela jam), notifikasi akan terkirim maksimal 30 menit setelahnya — tanpa risiko dobel kirim.

## Langkah 1 — Buat repo GitHub

1. Buat repo baru di GitHub (boleh private).
2. Upload `notify-menu.js` ke root repo.
3. Upload `menu-notify.yml` ke path **`.github/workflows/menu-notify.yml`**.

## Langkah 2 — Wajib: izinkan GitHub Actions untuk push

Karena workflow ini perlu commit file status balik ke repo, aktifkan izin tulis untuk token bawaan Actions:

1. Buka **Settings → Actions → General** di repo kamu.
2. Scroll ke bagian **Workflow permissions**.
3. Pilih **"Read and write permissions"**, lalu **Save**.

Kalau langkah ini dilewati, step commit di workflow akan gagal dengan error izin (403).

> Catatan: workflow ini **tidak** dipicu oleh event `push`, jadi commit otomatis dari bot tidak akan memicu loop tanpa henti — aman.

## Langkah 3 — Setup Discord

1. Buka server Discord kamu → **Server Settings → Integrations → Webhooks → New Webhook**.
2. Pilih channel tujuan, kasih nama (misal "Menu MBG"), lalu **Copy Webhook URL**.
3. Simpan URL ini untuk Langkah 5 (secrets).

## Langkah 4 — Setup WhatsApp

### Opsi A — CallMeBot (gratis, tapi saat ini penuh)

1. Simpan nomor bot CallMeBot ke kontak WhatsApp kamu.
2. Kirim pesan `I allow callmebot to send me messages` ke nomor itu.
3. Bot balas dengan API key kamu.

**Catatan:** saat dicek, status resminya *"bot sedang penuh, coba lagi beberapa hari lagi"* — nomor baru muncul kalau slot tersedia. Cek berkala di: https://www.callmebot.com/blog/free-api-whatsapp-messages/

Begitu dapat API key, isi secrets `CALLMEBOT_PHONE` dan `CALLMEBOT_APIKEY` (Langkah 5) — tidak perlu ubah kode.

### Opsi B — Twilio WhatsApp API (berbayar kecil, lebih stabil)

Sandbox gratis Twilio punya 2 batasan untuk notifikasi otomatis jangka panjang: sesi expired tiap 3 hari (perlu rejoin manual), dan nomor sandbox kadang dibatasi untuk mengirim ke nomor Indonesia. Untuk produksi stabil perlu daftar WhatsApp sender resmi (verifikasi bisnis + approval template). Bilang kalau mau saya bantu bikinkan versi Twilio.

### Opsi C — Telegram (gratis, resmi, tanpa antrian)

Kalau terbuka pakai Telegram sebagai pengganti/tambahan: setup lewat `@BotFather` di Telegram, dapat token dalam semenit, tanpa approval atau slot terbatas. Bilang kalau mau versi ini disiapkan.

## Langkah 5 — Isi Secrets di GitHub

**Settings → Secrets and variables → Actions → New repository secret**:

| Nama Secret | Isi |
|---|---|
| `DISCORD_WEBHOOK_URL` | URL webhook dari Langkah 3 |
| `CALLMEBOT_PHONE` | Nomor WhatsApp kamu dengan kode negara, contoh `6281234567890` |
| `CALLMEBOT_APIKEY` | API key dari CallMeBot |

Kalau salah satu channel belum siap, isi yang sudah siap dulu — script otomatis skip channel yang secret-nya kosong.

## Langkah 6 — Test manual

1. Buka tab **Actions** di repo kamu.
2. Pilih workflow **"Notifikasi Menu MBG Harian"**.
3. Klik **Run workflow**.
4. Cek log-nya. Kalau ingin memastikan kirim benar-benar terjadi (bukan cuma "di luar jendela jam"), jalankan manual test ini di antara jam 06:00–11:00 WIB, atau ubah sementara `CHECK_START_HOUR_WIB` / `CHECK_END_HOUR_WIB` di `notify-menu.js`.

## Mengatur jendela jam

Buka `notify-menu.js`, cari baris ini di bagian atas:

```js
const CHECK_START_HOUR_WIB = 6;
const CHECK_END_HOUR_WIB = 11;
```

Ubah angkanya sesuai kebutuhan (format 24 jam, WIB). Interval cek (30 menit) diatur di `menu-notify.yml` lewat `cron: '*/30 * * * *'` — ubah `*/30` jadi `*/15` kalau mau tiap 15 menit, dsb.

## Reset manual (kalau perlu kirim ulang di hari yang sama)

Hapus atau kosongkan isi file `.state/last-sent.json` di repo (lewat GitHub web atau git), lalu jalankan workflow manual lagi.

## Yang perlu kamu pahami

- `menu.json` adalah file statis milik SPPG Sicarjosari, bukan API resmi — kalau strukturnya berubah suatu saat, script perlu disesuaikan.
- Jadwal GitHub Actions kadang meleset beberapa menit dari cron pada jam sibuk — bukan garansi presisi ke detik.
- Mekanisme ini menambah commit kecil ke repo tiap hari (1 baris tanggal) — normal dan ringan, tidak akan membengkakkan repo secara berarti.
