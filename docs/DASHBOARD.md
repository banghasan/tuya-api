# Dashboard

## Akses

- URL: `http://localhost:8000/smartplug`
- Jika `TUYA_API_KEY` diaktifkan, isi key via modal atau gunakan `?key=YOUR_KEY`
  sekali (disimpan di session).

## Query Params

- `refresh` (detik): interval auto refresh. Contoh: `?refresh=10`.
- `points`: jumlah titik grafik. Contoh: `?points=200`.
- `watt_max`: skala maksimum gauge watt. Contoh: `?watt_max=3000`.
- `ampere_max`: skala maksimum gauge ampere. Contoh: `?ampere_max=15`.
