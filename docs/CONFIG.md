# Konfigurasi

Kembali ke [README utama](../README.md) · [Dokumentasi](README.md).

## File .env

Salin contoh dan isi kredensial perangkat:

```bash
cp .env.example .env
```

## Variabel Lingkungan

- `TZ`: zona waktu (default: `Asia/Jakarta`).
- `TUYA_API_KEY`: kunci opsional untuk melindungi endpoint `/api/*`.
- `TUYA_SMARTPLUG_ID`, `TUYA_SMARTPLUG_KEY`, `TUYA_SMARTPLUG_IP`,
  `TUYA_SMARTPLUG_VERSION`.
- `TUYA_IRBLASTER_ID`, `TUYA_IRBLASTER_KEY`, `TUYA_IRBLASTER_IP`,
  `TUYA_IRBLASTER_VERSION`.
- `TUYA_TIMEOUT_MS`: timeout koneksi (ms).
- `TUYA_SCAN_TIMEOUT_SEC`, `TUYA_SCAN_VERSIONS`: parameter scan perangkat.

## Catatan

- Jika nilai `KEY` mengandung karakter khusus (mis. `$` atau `'`), gunakan tanda
  kutip ganda.
- Jika `TUYA_API_KEY` diisi, semua endpoint `/api/*` membutuhkan header
  `x-api-key`.

## Security Headers (Dashboard)

Dashboard `/smartplug` mengirim header keamanan berikut:

- `Content-Security-Policy`: batasi sumber resource ke `self` (dengan inline
  CSS/JS untuk template).
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: no-referrer`.
