# API

## Endpoint

| Method   | URL                      | Deskripsi                                 | Auth                                    |
| -------- | ------------------------ | ----------------------------------------- | --------------------------------------- |
| GET      | `/`                      | Health check                              | Tidak                                   |
| GET      | `/health`                | Health check (JSON)                       | Tidak                                   |
| GET      | `/smartplug`             | Dashboard monitoring                      | Query `?key=` jika `TUYA_API_KEY` diisi |
| GET      | `/api/smartplug/current` | Status lengkap smartplug + metrik listrik | Header `x-api-key`                      |
| GET      | `/api/smartplug/status`  | Status smartplug (boolean)                | Header `x-api-key`                      |
| GET/POST | `/api/smartplug/on`      | Nyalakan smartplug                        | Header `x-api-key`                      |
| GET/POST | `/api/smartplug/off`     | Matikan smartplug                         | Header `x-api-key`                      |
| GET      | `/api/irblaster/current` | Status lengkap IR blaster                 | Header `x-api-key`                      |
| GET      | `/api/irblaster/status`  | Status IR blaster                         | Header `x-api-key`                      |
| GET      | `/api/devices/list`      | Daftar device terkonfigurasi              | Header `x-api-key`                      |
| GET      | `/api/devices/scan`      | Scan device Tuya di jaringan              | Header `x-api-key`                      |

## Contoh Request

```bash
curl -H "x-api-key: change_this_key" http://localhost:8000/api/smartplug/current
```

Jika API key salah/tidak dikirim:

```json
{ "error": "Unauthorized" }
```
