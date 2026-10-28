# 🛡️ Cek Plagiasi Karya Ilmiah

Aplikasi web untuk mendeteksi **plagiarisme** dan **tulisan AI** pada karya ilmiah.
Dengan Bantuan [Quetext v2](https://www.quetext.com/developers-api) (plagiarism + AI detection dalam satu API key).

## Fitur

- 📎 Upload file **PDF**, **DOCX**, **TXT/MD**
- 📝 Atau langsung Paste Text
- 🔎 Cek plagiarisme: skor kemiripan, daftar sumber + URL, sorotan otomatis pada naskah
- 🤖 Deteksi AI: skor keseluruhan, ringkasan, dan probabilitas per kalimat
- 💰 Estimasi biaya kata terhadap kuota gratis 5.000 kata

## Persiapan

1. Daftar gratis tanpa kartu kredit: <https://www.quetext.com/signup> → dapat **5.000 kata**
   ($0,10 / 1.000 kata setelah kuota habis).
2. Buka **Account → API Keys**, buat apikey baru, copy.
3. Isi file `.env.local` di folder ini:

   ```env
   QUETEXT_API_KEY=kunci_kamu
   ```

4. Jalankan aplikasi.

Tanpa API key, aplikasi tetap terbuka dan menampilkan panduan pengaturan.

## Menjalankan

```bash
npm install
npm run dev
```

Buka <http://localhost:3000>.

## Command

```bash
npm run build   # build produksi
npm start       # jalankan build produksi
npm run lint    # ESLint
```

## Struktur

```
src/
├── app/
│   ├── page.tsx              # halaman utama (server component)
│   ├── layout.tsx
│   └── api/
│       ├── extract/route.ts  # ekstraksi teks PDF/DOCX/TXT
│       └── check/route.ts    # submit + polling hasil Quetext
├── components/
│   ├── Checker.tsx           # UI input, progres, alur pemeriksaan
│   └── Results.tsx           # panel skor, sumber, sorotan, deteksi AI
└── lib/
    ├── quetext.ts            # klien Quetext API + penanganan error
    └── types.ts              # tipe bersama
```

## Catatan teknis

- Semua request ke Quetext dilakukan dari **server** (API key tidak pernah
  dikirim ke browser).
- Laporan diproses asinkron oleh Quetext; aplikasi mem-*poll* progres tiap 2,5 detik.
- Ekstraksi teks: `unpdf` (PDF) dan `mammoth` (DOCX). File hasil scan gambar
  (butuh OCR) belum didukung.
- Batasan: file maksimal 10 MB, minimal 20 kata, rate limit Quetext 10 request
  / 5 detik per akun.
