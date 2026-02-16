# Dokumentasi

Kembali ke [README utama](../README.md).

Ringkasan dokumen penting untuk project ini:

- [docs/CONFIG.md](CONFIG.md): konfigurasi `.env` dan variabel lingkungan.
- [docs/API.md](API.md): daftar endpoint dan contoh request.
- [docs/DASHBOARD.md](DASHBOARD.md): cara akses dashboard dan query params.
- Versi aplikasi: gunakan `deno task version` (lihat detail di bawah).

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

## Versi Aplikasi

- Sumber versi: file `VERSION`.
- Cek versi (interactive): `deno task version`.
- Dump versi saja: `deno task version:dump`.
- Bump versi langsung: `deno task version:bump -- patch|minor|major`.

`deno task version` akan menampilkan versi sekarang lalu menawarkan pilihan:

- `0` batal.
- `1` patch: perbaikan kecil/bugfix.
- `2` minor: fitur baru kompatibel.
- `3` major: perubahan besar (breaking).

## Security & Hardening

- Dashboard `/smartplug` sudah mengirim CSP, `X-Content-Type-Options`, dan
  `Referrer-Policy`.
- Gunakan `TUYA_API_KEY` agar endpoint `/api/*` tidak terbuka.
- Jalankan service di jaringan lokal jika tidak butuh akses publik.
