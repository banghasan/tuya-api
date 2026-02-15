# Tuya Smartplug API

## Menjalankan

```bash
deno task dev
# atau
# deno task start
```

## Test

```bash
deno task test
```

## Konfigurasi .env

Salin `.env.example` menjadi `.env` lalu isi kredensial sesuai device milikmu:

```bash
cp .env.example .env
```

Catatan: Jika value `KEY` mengandung karakter khusus (mis. `$` atau `'`), gunakan tanda kutip ganda agar tidak salah dibaca.
Catatan keamanan: jika `TUYA_API_KEY` diisi, semua endpoint `/api/*` wajib mengirim header `x-api-key`. Jika kosong, endpoint tetap terbuka.

Contoh isi `.env` (tanpa kredensial asli):

```env
# Smartplug device
TUYA_SMARTPLUG_ID=your_smartplug_id
TUYA_SMARTPLUG_KEY="your_smartplug_key"
TUYA_SMARTPLUG_IP=192.168.0.10

# IR Blaster device
TUYA_IRBLASTER_ID=your_irblaster_id
TUYA_IRBLASTER_KEY="your_irblaster_key"
TUYA_IRBLASTER_IP=192.168.0.11

# Versi device (bisa beda tiap device)
TUYA_SMARTPLUG_VERSION=3.3
TUYA_IRBLASTER_VERSION=3.1

# Timeout (ms) untuk find/connect/get (opsional)
TUYA_TIMEOUT_MS=5000

# Scan device Tuya di jaringan (opsional)
TUYA_SCAN_TIMEOUT_SEC=8
TUYA_SCAN_VERSIONS=3.3,3.1

# Timezone (default: Asia/Jakarta)
TZ=Asia/Jakarta

# API key untuk proteksi endpoint ON/OFF (opsional)
TUYA_API_KEY=change_this_key
```

## Contoh request (curl)

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/current
```

Jika API key salah / tidak dikirim:
```json
{
  "error": "Unauthorized"
}
```

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/status
```

```bash
# nyalakan smartplug (GET)
curl -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/on
```

Contoh response:
```json
{
  "datetime": "2026-02-15T10:12:30+07:00",
  "timezone": "Asia/Jakarta",
  "status": "ON"
}
```

Jika device offline / IP tidak aktif:
```json
{
  "datetime": "2026-02-15T10:12:30+07:00",
  "timezone": "Asia/Jakarta",
  "status": "OFFLINE",
  "watt": null,
  "volt": null,
  "ampere": null,
  "total_kwh": null,
  "raw_dps": {},
  "error": "connection timed out"
}
```

```bash
# matikan smartplug (GET)
curl -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/off
```

Contoh response:
```json
{
  "datetime": "2026-02-15T10:12:35+07:00",
  "timezone": "Asia/Jakarta",
  "status": "OFF"
}
```

```bash
# nyalakan smartplug (POST)
curl -X POST -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/on
```

Contoh response:
```json
{
  "datetime": "2026-02-15T10:12:40+07:00",
  "timezone": "Asia/Jakarta",
  "status": "ON"
}
```

```bash
# matikan smartplug (POST)
curl -X POST -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/off
```

Contoh response:
```json
{
  "datetime": "2026-02-15T10:12:45+07:00",
  "timezone": "Asia/Jakarta",
  "status": "OFF"
}
```

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/irblaster/current
```

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/irblaster/status
```

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/devices/scan
```

```bash
# override via query params
curl -H "x-api-key: change_this_key" "http://localhost:8000/api/devices/scan?timeout=12&versions=3.1,3.3"
```

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/devices/list
```

Output list menampilkan `id` dan `ip`.

## Docker (tanpa build image)

Jalankan dengan Docker Compose:

```bash
docker compose up
```

Compose akan membaca `.env` otomatis.

Jika ingin mode dev:

```bash
docker compose run --rm -e DENO_DIR=/app/.deno tuya-api deno task dev
```
