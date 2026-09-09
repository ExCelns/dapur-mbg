// notify-menu.js
// Ambil menu MBG hari ini dari menu.json, lalu kirim notifikasi (teks + foto)
// ke Discord dan/atau WhatsApp.
// Dijalankan otomatis via GitHub Actions (lihat .github/workflows/menu-notify.yml)

const MENU_URL = 'https://sppgsicarjosari.github.io/WebsiteMBG-SPPGSIC/menu.json';

// Tanggal hari ini dalam zona waktu WIB (Asia/Jakarta), format YYYY-MM-DD
function getTodayWIB() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
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
    const {
        DISCORD_WEBHOOK_URL,
        CALLMEBOT_PHONE,
        CALLMEBOT_APIKEY,
    } = process.env;

    const res = await fetch(MENU_URL);
    if (!res.ok) throw new Error(`Gagal mengambil menu.json: ${res.status}`);
    const data = await res.json();

    const today = getTodayWIB();
    const entry = data.menu[today];

    if (!entry) {
        console.log(`Tidak ada data menu untuk tanggal ${today}. Tidak ada notifikasi yang dikirim.`);
        return;
    }

    const discordPayload = buildDiscordPayload(data.dapur, today, entry);
    const fotoLinks = discordPayload.embeds.map(e => e.image.url);

    console.log('--- Pesan yang akan dikirim ---');
    console.log(discordPayload.content);
    if (fotoLinks.length) console.log('Foto:', fotoLinks.join(', '));
    console.log('-------------------------------');

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
        process.exit(1); // supaya job GitHub Actions ditandai gagal & kamu dapat notifikasi email dari GitHub
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});