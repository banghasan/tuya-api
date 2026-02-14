# Tuya Smartplug API (Deno + Hono)

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

## Contoh .env

```env
# Smartplug device (contoh)
TUYA_SMARTPLUG_ID=a38f8867156175d341ccd4
TUYA_SMARTPLUG_KEY=OfDMhmEE8)l2sWjl
TUYA_SMARTPLUG_IP=192.168.6.51

# IR Blaster device (contoh)
TUYA_IRBLASTER_ID=a3c391633371ced1ecnlpx
TUYA_IRBLASTER_KEY="$81y'47jr<[R14*b"
TUYA_IRBLASTER_IP=192.168.6.54

# Versi device (bisa beda tiap device)
TUYA_SMARTPLUG_VERSION=3.3
TUYA_IRBLASTER_VERSION=3.1

# Timeout (ms) untuk find/connect/get (opsional)
TUYA_TIMEOUT_MS=5000

# Scan device Tuya di jaringan (opsional)
TUYA_SCAN_TIMEOUT_SEC=8
TUYA_SCAN_VERSIONS=3.3,3.1
```

Catatan: Jika value `KEY` mengandung karakter khusus (mis. `$` atau `'`), gunakan tanda kutip ganda agar tidak salah dibaca.

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
