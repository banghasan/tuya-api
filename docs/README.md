# Dokumentasi

Ringkasan dokumen penting untuk project ini:

- `docs/CONFIG.md`: konfigurasi `.env` dan variabel lingkungan.
- `docs/API.md`: daftar endpoint dan contoh request.
- `docs/DASHBOARD.md`: cara akses dashboard dan query params.

## Mulai Cepat

```bash
cp .env.example .env

deno task dev
```

## Kualitas Kode

```bash
deno task lint

deno task format

deno task test
```

## Security & Hardening

- Dashboard `/smartplug` sudah mengirim CSP, `X-Content-Type-Options`, dan
  `Referrer-Policy`.
- Gunakan `TUYA_API_KEY` agar endpoint `/api/*` tidak terbuka.
- Jalankan service di jaringan lokal jika tidak butuh akses publik.
