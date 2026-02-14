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

## Konfigurasi .env

Salin `.env.example` menjadi `.env` lalu isi kredensial sesuai device milikmu:

```bash
cp .env.example .env
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
