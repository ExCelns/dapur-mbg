// ====== KONFIGURASI ======
// PENTING: pakai path relatif (tanpa "/" di depan), karena situs ini
// di-hosting di subfolder (contoh: namakamu.github.io/website-mbg/)
const URL_DATA = 'menu.json';

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function tanggalHariIni() {
    const d = new Date();
    return formatKeYMD(d);
}

function formatKeYMD(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Cari tanggal hari Senin di minggu yang sama dengan tanggalKunci (format YYYY-MM-DD)
function awalMingguDari(tanggalKunci) {
    const d = new Date(tanggalKunci + 'T00:00:00');
    const hari = d.getDay(); // 0 = Minggu, 1 = Senin, ... 6 = Sabtu
    const mundur = (hari === 0) ? 6 : (hari - 1); // kalau Minggu, mundur 6 hari ke Senin sebelumnya
    d.setDate(d.getDate() - mundur);
    return formatKeYMD(d);
}

function formatTanggalIndonesia(d) {
    return `${NAMA_HARI[d.getDay()]}, ${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

async function ambilData() {
    const res = await fetch(URL_DATA, { cache: 'no-store' });
    if (!res.ok) throw new Error('menu.json tidak ditemukan (status ' + res.status + ')');
    return res.json();
}

function tampilkanFoto(idImg, idPlaceholder, pathFoto) {
    const img = document.getElementById(idImg);
    const placeholder = document.getElementById(idPlaceholder);
    if (!pathFoto) {
        img.hidden = true;
        placeholder.hidden = false;
        return;
    }
    img.onload = () => { img.hidden = false; placeholder.hidden = true; };
    img.onerror = () => { img.hidden = true; placeholder.hidden = false; };
    img.src = pathFoto;
}

function isiListMakanan(idUl, daftar) {
    const ul = document.getElementById(idUl);
    ul.innerHTML = '';
    (daftar || []).forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
    });
    if (!daftar || daftar.length === 0) {
        ul.innerHTML = '<li>Belum ada data isi ompreng.</li>';
    }
}

function isiPenerimaManfaat(idEl, angka) {
    document.getElementById(idEl).textContent =
        (typeof angka === 'number') ? angka.toLocaleString('id-ID') : '–';
}

function isiGizi(idUl, daftar) {
    const ul = document.getElementById(idUl);
    ul.innerHTML = '';
    (daftar || []).forEach(g => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${g.label}</span><span class="nilai">${g.value}</span>`;
        ul.appendChild(li);
    });
    if (!daftar || daftar.length === 0) {
        ul.innerHTML = '<li><span>Belum ada data gizi</span></li>';
    }
}

function isiPeringatan(idEl, teks) {
    const el = document.getElementById(idEl);
    // dukung dua format: string biasa, ATAU array kalau mau lebih dari satu kalimat
    // dibuat aman: apapun tipe datanya, nggak akan bikin error/berhenti di tengah jalan
    let daftar = [];
    if (Array.isArray(teks)) {
        daftar = teks.filter(t => typeof t === 'string' && t.trim().length > 0);
    } else if (typeof teks === 'string' && teks.trim().length > 0) {
        daftar = [teks];
    }

    if (daftar.length === 0) {
        el.innerHTML = '<p>Tidak ada peringatan khusus untuk menu hari ini.</p>';
        return;
    }
    el.innerHTML = daftar.map(t => `<p>${t}</p>`).join('');
}

function tampilkanSatuPorsi(porsiKey, entry) {
    const dataPorsi = entry.porsi && entry.porsi[porsiKey];

    tampilkanFoto('foto-menu-' + porsiKey, 'foto-placeholder-' + porsiKey, dataPorsi && dataPorsi.foto);
    isiListMakanan('list-isiOmpreng-' + porsiKey, entry.isiOmpreng);
    isiPenerimaManfaat('angka-penerima-' + porsiKey, entry.penerimaManfaat);
    isiGizi('list-gizi-' + porsiKey, dataPorsi && dataPorsi.gizi);
    isiPeringatan('teks-peringatan-' + porsiKey, dataPorsi && dataPorsi.peringatan);
}

function tampilkanMingguIni(menuMingguan, kunciHariIni, tanggalAktif) {
    const ul = document.getElementById('week-list');
    ul.innerHTML = '';

    const awalMinggu = awalMingguDari(kunciHariIni);
    const entries = Object.entries(menuMingguan || {})
        .filter(([tanggal]) => tanggal >= awalMinggu && tanggal <= kunciHariIni)
        .sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) {
        ul.innerHTML = '<li style="width:auto;cursor:default;">Belum ada menu diunggah</li>';
        return;
    }

    entries.forEach(([tanggal, data]) => {
        const li = document.createElement('li');
        if (tanggal === kunciHariIni) li.classList.add('hari-ini');
        if (tanggal === tanggalAktif) li.classList.add('aktif');
        li.textContent = (data.hari || '').slice(0, 3);
        li.addEventListener('click', () => renderUntukTanggal(tanggal));
        ul.appendChild(li);
    });
}

function pasangTab() {
    document.querySelectorAll('.tabs').forEach(nav => {
        const grup = nav.dataset.tabgroup;
        const slide = nav.closest('.porsi-slide');
        nav.querySelectorAll('.tabs__btn').forEach(btn => {
            btn.addEventListener('click', () => {
                nav.querySelectorAll('.tabs__btn').forEach(b => b.setAttribute('aria-selected', 'false'));
                btn.setAttribute('aria-selected', 'true');
                slide.querySelectorAll('.panel').forEach(p => p.hidden = true);
                slide.querySelector(`.panel[data-panel="${btn.dataset.tab}"]`).hidden = false;
            });
        });
    });
}

// ====== SLIDER PORSI KECIL / BESAR ======
let indexPorsi = 0; // 0 = kecil, 1 = besar
const NAMA_PORSI = ['kecil', 'besar'];
const LABEL_PORSI = { kecil: 'Porsi Kecil', besar: 'Porsi Besar' };

function pindahKeSlide(index) {
    indexPorsi = Math.max(0, Math.min(1, index));
    const track = document.getElementById('porsi-track');
    track.style.transform = `translateX(-${indexPorsi * 50}%)`;
    document.getElementById('porsi-label').textContent = LABEL_PORSI[NAMA_PORSI[indexPorsi]];
    document.querySelectorAll('.porsi-dots .dot').forEach((dot, i) => {
        dot.classList.toggle('aktif', i === indexPorsi);
    });
}

function pasangSlider() {
    document.getElementById('porsi-prev').addEventListener('click', () => pindahKeSlide(indexPorsi - 1));
    document.getElementById('porsi-next').addEventListener('click', () => pindahKeSlide(indexPorsi + 1));
    document.querySelectorAll('.porsi-dots .dot').forEach((dot, i) => {
        dot.addEventListener('click', () => pindahKeSlide(i));
    });

    const viewport = document.getElementById('porsi-viewport');
    let xMulai = null;
    viewport.addEventListener('touchstart', (e) => { xMulai = e.touches[0].clientX; }, { passive: true });
    viewport.addEventListener('touchend', (e) => {
        if (xMulai === null) return;
        const xAkhir = e.changedTouches[0].clientX;
        const selisih = xAkhir - xMulai;
        if (selisih > 50) pindahKeSlide(indexPorsi - 1);      // swipe ke kanan -> porsi sebelumnya
        else if (selisih < -50) pindahKeSlide(indexPorsi + 1); // swipe ke kiri -> porsi berikutnya
        xMulai = null;
    });
}

// ====== STATE & NAVIGASI ANTAR HARI ======
let dataGlobal = null;
let kunciHariIniGlobal = '';

function renderUntukTanggal(tanggal) {
    if (!dataGlobal) return;
    const entry = (dataGlobal.menu || {})[tanggal];
    const tombolKembali = document.getElementById('kembali-hari-ini');

    if (!entry) {
        ['kecil', 'besar'].forEach(p => {
            try { tampilkanSatuPorsi(p, { porsi: {} }); }
            catch (e) { console.error('Gagal render porsi ' + p, e); }
        });
    } else {
        document.getElementById('hari-tanggal').textContent =
            formatTanggalIndonesia(new Date(tanggal + 'T00:00:00'));

        try { tampilkanSatuPorsi('kecil', entry); }
        catch (e) { console.error('Gagal render porsi kecil (cek menu.json tanggal ' + tanggal + ')', e); }

        try { tampilkanSatuPorsi('besar', entry); }
        catch (e) { console.error('Gagal render porsi besar (cek menu.json tanggal ' + tanggal + ')', e); }
    }

    tombolKembali.hidden = (tanggal === kunciHariIniGlobal);

    try { tampilkanMingguIni(dataGlobal.menu, kunciHariIniGlobal, tanggal); }
    catch (e) { console.error('Gagal render menu minggu ini', e); }
}

async function init() {
    pasangTab();
    pasangSlider();
    pindahKeSlide(0);

    kunciHariIniGlobal = tanggalHariIni();
    document.getElementById('hari-tanggal').textContent = formatTanggalIndonesia(new Date());

    document.getElementById('kembali-hari-ini').addEventListener('click', () => {
        renderUntukTanggal(kunciHariIniGlobal);
    });

    try {
        const data = await ambilData();
        dataGlobal = data;

        document.getElementById('nama-sppg').textContent = data.dapur || 'SPPG';
        document.getElementById('footer-dapur').textContent = 'Disiapkan di dapur — ' + (data.dapur || '-');

        renderUntukTanggal(kunciHariIniGlobal);

    } catch (err) {
        console.error(err);
        document.getElementById('nama-sppg').textContent = 'Gagal memuat menu';
        document.getElementById('hari-tanggal').textContent = 'Cek menu.json / koneksi internet';
    }
}

init();
