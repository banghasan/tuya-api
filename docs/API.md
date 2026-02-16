# API

Kembali ke [README utama](../README.md) · [Dokumentasi](README.md).

## Endpoint

| Method   | URL                      | Deskripsi                                 | Auth                                    |
| -------- | ------------------------ | ----------------------------------------- | --------------------------------------- |
| GET      | `/`                      | Health check + version (JSON)             | Tidak                                   |
| GET      | `/health`                | Health check (JSON)                       | Tidak                                   |
| GET      | `/smartplug`             | Dashboard monitoring                      | Query `?key=` jika `TUYA_API_KEY` diisi |
| GET      | `/api/config`            | Info konfigurasi publik (requiresKey)     | Tidak                                   |
| GET      | `/api/smartplug/current` | Status lengkap smartplug + metrik listrik | Header `x-api-key`                      |
| GET      | `/api/smartplug/status`  | Status smartplug (boolean)                | Header `x-api-key`                      |
| GET/POST | `/api/smartplug/on`      | Nyalakan smartplug                        | Header `x-api-key`                      |
| GET/POST | `/api/smartplug/off`     | Matikan smartplug                         | Header `x-api-key`                      |
| GET      | `/api/irblaster/current` | Status lengkap IR blaster                 | Header `x-api-key`                      |
| GET      | `/api/irblaster/status`  | Status IR blaster                         | Header `x-api-key`                      |
| GET      | `/api/devices/list`      | Daftar device terkonfigurasi              | Header `x-api-key`                      |
| GET      | `/api/devices/scan`      | Scan device Tuya di jaringan              | Header `x-api-key`                      |

## Otorisasi

Jika `TUYA_API_KEY` diisi, semua endpoint `/api/*` wajib header:

```bash
-H "x-api-key: change_this_key"
```

Jika API key salah/tidak dikirim:

```json
{ "error": "Unauthorized" }
```

## Contoh Curl (Semua Endpoint)

### Health check

```bash
curl http://localhost:8000/
```

Response:

```json
{ "status": "ok", "version": "1.0.0" }
```

```bash
curl http://localhost:8000/health
```

```bash
curl http://localhost:8000/api/config
```

### Dashboard

```bash
curl http://localhost:8000/smartplug
```

```bash
curl "http://localhost:8000/smartplug?key=change_this_key"
```

### Smartplug

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/current
```

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/status
```

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/on
```

```bash
curl -X POST -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/on
```

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/off
```

```bash
curl -X POST -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/off
```

### IR Blaster

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/irblaster/current
```

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/irblaster/status
```

### Devices

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/devices/list
```

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/devices/scan
```

## Contoh Response

### Smartplug ON/OFF

```json
{
  "datetime": "2026-02-15T10:12:30+07:00",
  "timezone": "Asia/Jakarta",
  "status": "ON"
}
```

### Smartplug Offline

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
