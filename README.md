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
```

## Contoh request (curl)

```bash
curl http://localhost:8000/api/smartplug/current
```

```bash
curl http://localhost:8000/api/smartplug/status
```

```bash
curl http://localhost:8000/api/irblaster/current
```

```bash
curl http://localhost:8000/api/irblaster/status
```

```bash
curl http://localhost:8000/api/devices/scan
```

```bash
# override via query params
curl "http://localhost:8000/api/devices/scan?timeout=12&versions=3.1,3.3"
```

```bash
curl http://localhost:8000/api/devices/list
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
