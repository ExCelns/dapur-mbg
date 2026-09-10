// notify-menu.js
// Cek menu.json secara berkala. Kalau menu hari ini sudah tersedia DAN belum pernah
// dikirim hari ini, kirim notifikasi (teks + foto) ke Discord dan/atau WhatsApp, lalu
// tandai "sudah terkirim" supaya tidak dobel di run berikutnya.
//
// Dijalankan otomatis via GitHub Actions tiap 30 menit (lihat .github/workflows/menu-notify.yml),
// tapi hanya benar-benar aktif memproses di jam CHECK_START_HOUR_WIB–CHECK_END_HOUR_WIB.

const fs = require('fs');
const path = require('path');

const MENU_URL = 'https://sppgsicarjosari.github.io/WebsiteMBG-SPPGSIC/menu.json';
const STATE_FILE = path.join(__dirname, '.state', 'last-sent.json');

// Jendela jam aktif cek, dalam WIB (24 jam, inklusif). Ubah sesuai kebutuhan.
const CHECK_START_HOUR_WIB = 6;
const CHECK_END_HOUR_WIB = 11;

// Tanggal & jam saat ini dalam WIB (Asia/Jakarta)
function getWIBParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  // "hour" dari Intl bisa berupa "24" untuk tengah malam di beberapa environment; normalkan ke 0-23
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;

  return { date: `${map.year}-${map.month}-${map.day}`, hour };
}

function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { date: null };
  }
}

function writeState(date) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ date }, null, 2) + '\n');
}

// menu.json menyimpan path foto secara relatif, mis. "image/menu-2026-09-09-kecil.jpeg".
// Ubah jadi URL absolut, dihitung relatif terhadap lokasi menu.json itu sendiri.
function resolveFotoUrl(pathFoto) {
  if (!pathFoto) return null;
  try {
    return new URL(pathFoto, MENU_URL).href;
  } catch {
    return null;
  }
}

function formatMessage(dapur, tanggal, entry) {
  const lines = [];
  lines.push(`🍱 *Menu MBG Hari Ini — ${entry.hari}, ${tanggal}*`);
  lines.push(`📍 ${dapur}`);
  lines.push('');
  lines.push('*Isi Ompreng:*');
  entry.isiOmpreng.forEach(item => lines.push(`• ${item}`));
  lines.push('');
  lines.push(`👥 Penerima manfaat: ${entry.penerimaManfaat}`);

  const kecil = entry.porsi?.kecil;
  const besar = entry.porsi?.besar;
  const energiKecil = kecil?.gizi?.find(g => g.label === 'Energi')?.value;
  const energiBesar = besar?.gizi?.find(g => g.label === 'Energi')?.value;
  if (energiKecil) lines.push(`⚡ Energi (porsi kecil): ${energiKecil}`);
  if (energiBesar) lines.push(`⚡ Energi (porsi besar): ${energiBesar}`);

  lines.push(`@everyone`);

  return lines.join('\n');
}

// Payload Discord: teks di "content", foto porsi kecil & besar sebagai embed terpisah
// (Discord webhook mendukung banyak embed sekaligus, masing-masing bisa punya 1 gambar).
function buildDiscordPayload(dapur, tanggal, entry) {
  const message = formatMessage(dapur, tanggal, entry);
  const embeds = [];

  const kecilFoto = resolveFotoUrl(entry.porsi?.kecil?.foto);
  const besarFoto = resolveFotoUrl(entry.porsi?.besar?.foto);

  if (kecilFoto) {
    embeds.push({ title: 'Foto — Porsi Kecil', image: { url: kecilFoto }, color: 0xff9800 });
  }
  if (besarFoto) {
    embeds.push({ title: 'Foto — Porsi Besar', image: { url: besarFoto }, color: 0x4caf50 });
  }

  return { content: message, embeds };
}

async function sendDiscord(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook gagal: ${res.status} ${await res.text()}`);
  }
  console.log('✅ Terkirim ke Discord (dengan foto).');
}

// Menggunakan CallMeBot (https://www.callmebot.com/blog/free-api-whatsapp-messages/)
// Catatan: layanan gratis pihak ketiga, tidak resmi dari WhatsApp/Meta.
// CallMeBot hanya mendukung teks polos, jadi link foto disisipkan di pesan.
async function sendWhatsApp(phone, apiKey, message, fotoLinks) {
  const fullMessage = fotoLinks.length
    ? `${message}\n\n📷 Foto:\n${fotoLinks.join('\n')}`
    : message;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(fullMessage)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`CallMeBot gagal: ${res.status} ${body}`);
  }
  console.log('✅ Terkirim ke WhatsApp.', body);
}

async function main() {
  const { date: today, hour } = getWIBParts();

  if (hour < CHECK_START_HOUR_WIB || hour > CHECK_END_HOUR_WIB) {
    console.log(`Di luar jendela cek (${CHECK_START_HOUR_WIB}:00–${CHECK_END_HOUR_WIB}:00 WIB). Sekarang jam ${hour}:00 WIB. Lewati.`);
    return;
  }

  const state = readState();
  if (state.date === today) {
    console.log(`Notifikasi untuk ${today} sudah pernah dikirim hari ini. Lewati.`);
    return;
  }

  const res = await fetch(MENU_URL);
  if (!res.ok) throw new Error(`Gagal mengambil menu.json: ${res.status}`);
  const data = await res.json();

  const entry = data.menu[today];

  if (!entry) {
    console.log(`Menu untuk ${today} belum tersedia di sumber data. Akan dicek lagi di jadwal berikutnya.`);
    return;
  }

  const discordPayload = buildDiscordPayload(data.dapur, today, entry);
  const fotoLinks = discordPayload.embeds.map(e => e.image.url);

  console.log('--- Pesan yang akan dikirim ---');
  console.log(discordPayload.content);
  if (fotoLinks.length) console.log('Foto:', fotoLinks.join(', '));
  console.log('-------------------------------');

  const {
    DISCORD_WEBHOOK_URL,
    CALLMEBOT_PHONE,
    CALLMEBOT_APIKEY,
  } = process.env;

  const tasks = [];

  if (DISCORD_WEBHOOK_URL) {
    tasks.push(sendDiscord(DISCORD_WEBHOOK_URL, discordPayload));
  } else {
    console.warn('⚠️ DISCORD_WEBHOOK_URL belum diset, lewati Discord.');
  }

  if (CALLMEBOT_PHONE && CALLMEBOT_APIKEY) {
    tasks.push(sendWhatsApp(CALLMEBOT_PHONE, CALLMEBOT_APIKEY, discordPayload.content, fotoLinks));
  } else {
    console.warn('⚠️ CALLMEBOT_PHONE / CALLMEBOT_APIKEY belum diset, lewati WhatsApp.');
  }

  if (tasks.length === 0) {
    console.warn('Tidak ada channel notifikasi yang terkonfigurasi. Cek secrets di repo.');
    return;
  }

  const results = await Promise.allSettled(tasks);
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    failed.forEach(f => console.error(f.reason));
    process.exit(1); // job ditandai gagal, dan TIDAK menandai "sudah terkirim" -> akan dicoba lagi di run berikutnya
  }

  writeState(today);
  console.log(`Status ditandai: notifikasi untuk ${today} sudah terkirim.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
