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
Dashboard `/smartplug` bisa diakses dengan `?key=YOUR_KEY` jika `TUYA_API_KEY` diisi. Interval auto refresh default 2 detik, bisa diubah dengan `?refresh=10` (detik). Jumlah titik grafik default 120, bisa diubah dengan `?points=200`. Skala maksimum gauge watt default 2000, bisa diubah dengan `?watt_max=3000`. Skala maksimum gauge ampere default 10, bisa diubah dengan `?ampere_max=15`. Dashboard menampilkan countdown, jam refresh berikutnya, label max di gauge, dan grafik watt/ampere (hover untuk detail).

Contoh isi `.env` (tanpa kredensial asli):

```env
# Timezone (default: Asia/Jakarta)
TZ=Asia/Jakarta

# API key untuk proteksi endpoint ON/OFF (opsional)
TUYA_API_KEY=change_this_key

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

## Daftar API

| Method | URL | Deskripsi | Auth |
| --- | --- | --- | --- |
| GET | `/` | Health check | Tidak |
| GET | `/smartplug` | Dashboard monitoring smartplug | Query `?key=` jika `TUYA_API_KEY` diisi |
| GET | `/api/smartplug/current` | Status lengkap smartplug + metrik listrik | Header `x-api-key` |
| GET | `/api/smartplug/status` | Status smartplug (boolean) | Header `x-api-key` |
| GET | `/api/smartplug/on` | Nyalakan smartplug | Header `x-api-key` |
| POST | `/api/smartplug/on` | Nyalakan smartplug | Header `x-api-key` |
| GET | `/api/smartplug/off` | Matikan smartplug | Header `x-api-key` |
| POST | `/api/smartplug/off` | Matikan smartplug | Header `x-api-key` |
| GET | `/api/irblaster/current` | Status lengkap IR blaster | Header `x-api-key` |
| GET | `/api/irblaster/status` | Status IR blaster | Header `x-api-key` |
| GET | `/api/devices/list` | Daftar device terkonfigurasi | Header `x-api-key` |
| GET | `/api/devices/scan` | Scan device Tuya di jaringan | Header `x-api-key` |

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
# buka dashboard (jika API key diaktifkan)
curl "http://localhost:8000/smartplug?key=change_this_key"

```bash
# buka dashboard dengan refresh 10 detik
curl "http://localhost:8000/smartplug?key=change_this_key&refresh=10"
```

```bash
# buka dashboard dengan 200 titik history grafik
curl "http://localhost:8000/smartplug?key=change_this_key&points=200"
```

```bash
# buka dashboard dengan skala maksimum 3000W
curl "http://localhost:8000/smartplug?key=change_this_key&watt_max=3000"
```

```bash
# buka dashboard dengan skala maksimum 15A
curl "http://localhost:8000/smartplug?key=change_this_key&ampere_max=15"
```
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
