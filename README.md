# Tuya Smartplug API

API sederhana untuk monitoring dan kontrol smartplug/IR blaster Tuya, lengkap
dengan dashboard real-time.

![smartplug](./image/smartplug.webp)

## Fitur

- Endpoint ON/OFF + status perangkat.
- Dashboard `/smartplug` dengan grafik watt/ampere dan refresh otomatis (default 10 detik).
- Proteksi API key opsional via header `x-api-key`.
- Endpoint root `/` mengembalikan versi aplikasi (JSON).

## Cepat Mulai

```bash
cp .env.example .env

deno task dev
# atau
# deno task start
```

## Dokumentasi

- Indeks dokumentasi: [docs/README.md](docs/README.md)
- Konfigurasi env: [docs/CONFIG.md](docs/CONFIG.md)
- API & contoh request: [docs/API.md](docs/API.md)
- Dashboard & query params: [docs/DASHBOARD.md](docs/DASHBOARD.md)

## Pengujian & Kualitas

```bash
deno task test

deno task lint

deno task format
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

## Struktur Direktori

- `src/` aplikasi utama (`server.ts`, `routes/`, `controllers/`, `services/`).
- `src/views/` template HTML/CSS/JS dashboard.
- `tests/` unit/integration test.
- `image/` aset statis.

## Catatan Keamanan

Jika `TUYA_API_KEY` diisi, semua endpoint `/api/*` wajib header `x-api-key`.
Dashboard bisa mengisi key via `?key=YOUR_KEY` sekali (disimpan di session).
