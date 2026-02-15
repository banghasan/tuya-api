// Web API untuk smartplug dengan Deno + Hono
import { Hono } from "hono";
import { load as loadEnv } from "std/dotenv";
import TuyAPI from "tuyapi";

// Muat .env dari root project (relative ke file ini)
const envPath = new URL("../.env", import.meta.url).pathname;
await loadEnv({ export: true, envPath });

type TuyaDevice = {
  find: (...args: unknown[]) => Promise<unknown>;
  connect: () => Promise<void>;
  get: (options?: unknown) => Promise<unknown>;
  set: (options?: unknown) => Promise<unknown>;
  disconnect: () => void;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type TuyaFactory = (options: Record<string, unknown>) => TuyaDevice;

const defaultTuyaFactory: TuyaFactory = (options) =>
  new TuyAPI(
    options as unknown as { id: string; key: string },
  ) as unknown as TuyaDevice;

let tuyaFactory: TuyaFactory = defaultTuyaFactory;

export function setTuyaFactoryForTest(factory: TuyaFactory) {
  tuyaFactory = factory;
}

export function resetTuyaFactoryForTest() {
  tuyaFactory = defaultTuyaFactory;
}

function createTuya(options: Record<string, unknown>): TuyaDevice {
  return tuyaFactory(options);
}

function attachTuyaErrorHandler(device: TuyaDevice, label: string) {
  if (typeof device.on !== "function") return;
  device.on("error", (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[tuya] ${label} error: ${message}`);
  });
}

function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
}

function getApiKey(): string | null {
  return Deno.env.get("TUYA_API_KEY") ?? null;
}

function verifyApiKey(c: {
  req: { header: (name: string) => string | undefined };
}): boolean {
  const expected = getApiKey();
  if (!expected) return true;
  const headerKey = c.req.header("x-api-key");
  return headerKey === expected;
}

function verifyApiKeyForDashboard(c: {
  req: { header: (name: string) => string | undefined; url: string };
}): boolean {
  const expected = getApiKey();
  if (!expected) return true;
  const headerKey = c.req.header("x-api-key");
  if (headerKey === expected) return true;
  const urlKey = new URL(c.req.url).searchParams.get("key");
  return urlKey === expected;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function getTimezone(): string {
  return Deno.env.get("TZ") ?? "Asia/Jakarta";
}

function normalizeOffset(offset: string): string | null {
  const trimmed = offset.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/^GMT|^UTC/, "");
  if (
    normalized === "" ||
    normalized === "0" ||
    normalized === "+0" ||
    normalized === "-0"
  ) {
    return "+00:00";
  }

  const match = normalized.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return null;

  const sign = match[1];
  const hours = match[2].padStart(2, "0");
  const minutes = (match[3] ?? "00").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function formatDateTimeTZ(date: Date): { datetime: string; timezone: string } {
  const preferred = getTimezone();
  const fallback = "Asia/Jakarta";
  let timeZone = preferred;
  let formatter: Intl.DateTimeFormat;

  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "shortOffset",
    });
  } catch {
    timeZone = fallback;
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "shortOffset",
    });
  }

  const parts = formatter.formatToParts(date);
  const lookup = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = lookup("year");
  const month = lookup("month");
  const day = lookup("day");
  const hour = lookup("hour");
  const minute = lookup("minute");
  const second = lookup("second");
  const tzName = lookup("timeZoneName");

  const base = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const offset = normalizeOffset(tzName);
  return { datetime: offset ? `${base}${offset}` : base, timezone: timeZone };
}

function getTimeoutMs(): number {
  const raw = Deno.env.get("TUYA_TIMEOUT_MS");
  const parsed = raw ? Number(raw) : 5000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}

function getScanTimeoutSecFromQuery(query: URLSearchParams): number {
  const rawQuery = query.get("timeout");
  const rawEnv = Deno.env.get("TUYA_SCAN_TIMEOUT_SEC");
  const parsed = rawQuery ? Number(rawQuery) : rawEnv ? Number(rawEnv) : 8;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

function getScanVersionsFromQuery(query: URLSearchParams): string[] {
  const rawQuery = query.get("versions");
  const rawEnv = Deno.env.get("TUYA_SCAN_VERSIONS");
  const raw = rawQuery ?? rawEnv ?? "3.3,3.1";
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

async function withTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
  const timeoutMs = getTimeoutMs();
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`${label} timeout ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  return await Promise.race([promise, timeout]);
}

function createSmartplugDevice() {
  const device = createTuya({
    id: requireEnv("TUYA_SMARTPLUG_ID"),
    key: requireEnv("TUYA_SMARTPLUG_KEY"),
    ip: requireEnv("TUYA_SMARTPLUG_IP"),
    version: requireEnv("TUYA_SMARTPLUG_VERSION"),
  });
  attachTuyaErrorHandler(device, "smartplug");
  return device;
}

function createIrblasterDevice() {
  const device = createTuya({
    id: requireEnv("TUYA_IRBLASTER_ID"),
    key: requireEnv("TUYA_IRBLASTER_KEY"),
    ip: requireEnv("TUYA_IRBLASTER_IP"),
    version: requireEnv("TUYA_IRBLASTER_VERSION"),
  });
  attachTuyaErrorHandler(device, "irblaster");
  return device;
}

async function getSmartplugData() {
  const device = createSmartplugDevice();
  try {
    // Jika IP sudah ada, lewati find() agar tidak lambat
    if (!Deno.env.get("TUYA_SMARTPLUG_IP")) {
      await withTimeout("find", device.find());
    }
    await withTimeout("connect", device.connect());

    const data = await withTimeout("get", device.get({ schema: true }));
    const dps = (data as { dps?: Record<string, unknown> } | undefined)?.dps;
    if (!dps) {
      throw new Error("Smartplug dps not found (device returned no dps)");
    }

    const dpsRecord = dps as Record<string, unknown>;
    const getNumber = (key: string, divisor: number) => {
      const value = dpsRecord[key];
      return typeof value === "number" ? value / divisor : null;
    };

    const { datetime, timezone } = formatDateTimeTZ(new Date());
    return {
      datetime,
      timezone,
      status: dpsRecord["1"] ? "ON" : "OFF",
      watt: getNumber("19", 10),
      volt: getNumber("20", 10),
      ampere: getNumber("18", 1000),
      total_kwh: getNumber("17", 100),
      raw_dps: dpsRecord,
    };
  } finally {
    device.disconnect();
  }
}

async function setSmartplugPower(powerOn: boolean) {
  const device = createSmartplugDevice();
  try {
    if (!Deno.env.get("TUYA_SMARTPLUG_IP")) {
      await withTimeout("find", device.find());
    }
    await withTimeout("connect", device.connect());
    await withTimeout(
      "set",
      device.set({
        dps: 1,
        set: powerOn,
      }),
    );
    const { datetime, timezone } = formatDateTimeTZ(new Date());
    return { datetime, timezone, status: powerOn ? "ON" : "OFF" };
  } finally {
    device.disconnect();
  }
}

function buildSmartplugOffline(errorMessage: string) {
  const { datetime, timezone } = formatDateTimeTZ(new Date());
  return {
    datetime,
    timezone,
    status: "OFFLINE",
    watt: null,
    volt: null,
    ampere: null,
    total_kwh: null,
    raw_dps: {},
    error: errorMessage,
  };
}

async function getIrblasterData() {
  const device = createIrblasterDevice();
  try {
    if (!Deno.env.get("TUYA_IRBLASTER_IP")) {
      await withTimeout("find", device.find());
    }
    await withTimeout("connect", device.connect());

    const data = await withTimeout("get", device.get({ schema: true }));
    const dps =
      (data as { dps?: Record<string, unknown> } | undefined)?.dps ?? {};

    const { datetime, timezone } = formatDateTimeTZ(new Date());
    return {
      datetime,
      timezone,
      status: "ONLINE",
      raw_dps: dps,
    };
  } finally {
    device.disconnect();
  }
}

async function scanTuyaDevices(query: URLSearchParams) {
  const timeoutSec = getScanTimeoutSecFromQuery(query);
  const versions = getScanVersionsFromQuery(query);

  const devices: Array<{ id: string; ip: string }> = [];
  const errors: Array<{ version: string; error: string }> = [];

  for (const version of versions) {
    const scanner = createTuya({
      id: "scan",
      key: "0123456789abcdef",
      version,
    });
    attachTuyaErrorHandler(scanner, `scan-v${version}`);

    try {
      const found = await scanner.find({ all: true, timeout: timeoutSec });
      if (Array.isArray(found)) {
        for (const d of found) {
          const id = (d as { id?: string }).id;
          const ip = (d as { ip?: string }).ip;
          if (id && ip && !devices.some((x) => x.id === id && x.ip === ip)) {
            devices.push({ id, ip });
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ version, error: message });
    }
  }

  return { timeout_sec: timeoutSec, versions, devices, errors };
}

export function buildApp() {
  const app = new Hono();

  app.get("/", (c) => c.text("Tuya API: OK"));

  app.get("/smartplug", (c) => {
    if (!verifyApiKeyForDashboard(c)) {
      return c.text("Unauthorized", 401);
    }
    const apiKey = getApiKey() ?? "";
    const refreshParam = new URL(c.req.url).searchParams.get("refresh");
    const refreshMs = Math.max(
      1000,
      Number.isFinite(Number(refreshParam))
        ? Number(refreshParam) * 1000
        : 2000,
    );
    const safeKey = escapeHtml(apiKey);
    const safeRefresh = Number.isFinite(refreshMs) ? String(refreshMs) : "2000";
    const html = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Smartplug Dashboard</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #0e1420;
        --panel: #151d2b;
        --panel-strong: #1b2536;
        --text: #f2f5f9;
        --muted: #9fb0c7;
        --accent: #7dd3fc;
        --accent-strong: #38bdf8;
        --danger: #f87171;
        --ok: #34d399;
        --shadow: 0 20px 60px rgba(6, 12, 24, 0.45);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
        color: var(--text);
        background: radial-gradient(1200px 800px at 10% -10%, #25314b, transparent),
          radial-gradient(900px 600px at 90% 10%, #1c2c4c, transparent),
          var(--bg);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px 20px;
      }
      .shell {
        width: min(920px, 100%);
        display: grid;
        gap: 24px;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
      }
      .title {
        display: grid;
        gap: 6px;
      }
      h1 {
        font-size: clamp(24px, 3vw, 36px);
        margin: 0;
        letter-spacing: -0.02em;
      }
      .subtitle {
        color: var(--muted);
        font-size: 14px;
      }
      .card {
        background: linear-gradient(140deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 18px;
        padding: 22px;
        box-shadow: var(--shadow);
      }
      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }
      .stat {
        background: var(--panel);
        border-radius: 14px;
        padding: 16px;
        display: grid;
        gap: 8px;
      }
      .stat span {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .stat strong {
        font-size: 20px;
        font-weight: 600;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(52, 211, 153, 0.15);
        color: var(--ok);
        font-weight: 600;
        font-size: 13px;
      }
      .status-pill.off {
        background: rgba(248, 113, 113, 0.15);
        color: var(--danger);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      button {
        border: none;
        border-radius: 12px;
        padding: 10px 16px;
        font-weight: 600;
        cursor: pointer;
        background: var(--accent);
        color: #0c1322;
        transition: transform 0.15s ease, box-shadow 0.2s ease;
        box-shadow: 0 10px 24px rgba(56, 189, 248, 0.35);
      }
      button.secondary {
        background: var(--panel-strong);
        color: var(--text);
        box-shadow: none;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      button:hover:not(:disabled) {
        transform: translateY(-1px);
      }
      .footer {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        color: var(--muted);
        font-size: 13px;
      }
      .error {
        color: var(--danger);
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="shell" data-api-key="${safeKey}" data-refresh="${safeRefresh}">
      <header>
        <div class="title">
          <h1>Smartplug Dashboard</h1>
          <div class="subtitle">Monitoring real-time smartplug Tuya</div>
        </div>
        <div id="status-pill" class="status-pill">Muat data...</div>
      </header>

      <section class="card">
        <div class="grid">
          <div class="stat">
            <span>Daya</span>
            <strong id="watt">-</strong>
          </div>
          <div class="stat">
            <span>Tegangan</span>
            <strong id="volt">-</strong>
          </div>
          <div class="stat">
            <span>Arus</span>
            <strong id="ampere">-</strong>
          </div>
          <div class="stat">
            <span>Total kWh</span>
            <strong id="total">-</strong>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="controls">
          <button id="btn-on">Nyalakan</button>
          <button id="btn-off" class="secondary">Matikan</button>
          <button id="btn-refresh" class="secondary">Refresh</button>
        </div>
      </section>

      <section class="footer card">
        <div>Last update: <span id="last-update">-</span></div>
        <div>Next refresh: <span id="next-refresh">-</span> <span id="next-refresh-at"></span></div>
        <div id="error" class="error"></div>
      </section>
    </div>
    <script>
      const root = document.querySelector(".shell");
      const apiKey = root?.dataset?.apiKey ?? "";
      const refreshMs = Number(root?.dataset?.refresh ?? "2000") || 2000;
      const headers = apiKey ? { "x-api-key": apiKey } : {};

      const statusPill = document.getElementById("status-pill");
      const elWatt = document.getElementById("watt");
      const elVolt = document.getElementById("volt");
      const elAmpere = document.getElementById("ampere");
      const elTotal = document.getElementById("total");
      const elLast = document.getElementById("last-update");
      const elNext = document.getElementById("next-refresh");
      const elNextAt = document.getElementById("next-refresh-at");
      const elError = document.getElementById("error");
      const btnOn = document.getElementById("btn-on");
      const btnOff = document.getElementById("btn-off");
      const btnRefresh = document.getElementById("btn-refresh");

      const formatNumber = (value, unit, digits = 2) => {
        if (value === null || value === undefined) return "-";
        if (typeof value !== "number") return "-";
        return value.toFixed(digits) + " " + unit;
      };

      const setStatus = (status) => {
        statusPill.textContent = status;
        statusPill.classList.toggle("off", status !== "ON");
      };

      const updateUI = (payload) => {
        setStatus(payload.status ?? "UNKNOWN");
        elWatt.textContent = formatNumber(payload.watt, "W", 1);
        elVolt.textContent = formatNumber(payload.volt, "V", 1);
        elAmpere.textContent = formatNumber(payload.ampere, "A", 3);
        elTotal.textContent = formatNumber(payload.total_kwh, "kWh", 2);
        elLast.textContent = payload.datetime ?? new Date().toISOString();
        elError.textContent = payload.error ? payload.error : "";
      };

      let countdownTimer = null;
      const startCountdown = () => {
        if (!elNext) return;
        if (countdownTimer) clearInterval(countdownTimer);
        let remaining = Math.round(refreshMs / 1000);
        const nextAt = new Date(Date.now() + refreshMs);
        elNext.textContent = remaining + "s";
        if (elNextAt) {
          elNextAt.textContent =
            "(" +
            nextAt.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }) +
            ")";
        }
        countdownTimer = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            clearInterval(countdownTimer);
            countdownTimer = null;
            return;
          }
          elNext.textContent = remaining + "s";
        }, 1000);
      };

      const fetchData = async () => {
        try {
          const res = await fetch("/api/smartplug/current", { headers });
          const data = await res.json();
          updateUI(data);
          startCountdown();
        } catch (err) {
          setStatus("OFFLINE");
          elError.textContent = err?.message ?? "Gagal memuat data";
        }
      };

      const sendPower = async (on) => {
        btnOn.disabled = true;
        btnOff.disabled = true;
        try {
          const res = await fetch(on ? "/api/smartplug/on" : "/api/smartplug/off", {
            method: "POST",
            headers,
          });
          const data = await res.json();
          updateUI(data);
        } catch (err) {
          elError.textContent = err?.message ?? "Gagal mengubah status";
        } finally {
          btnOn.disabled = false;
          btnOff.disabled = false;
        }
      };

      btnOn?.addEventListener("click", () => sendPower(true));
      btnOff?.addEventListener("click", () => sendPower(false));
      btnRefresh?.addEventListener("click", fetchData);

      fetchData();
      setInterval(fetchData, refreshMs);
    </script>
  </body>
</html>`;
    return c.html(html);
  });

  app.use("/api/*", async (c, next) => {
    if (!verifyApiKey(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });

  app.get("/api/smartplug/current", async (c) => {
    try {
      const result = await getSmartplugData();
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json(buildSmartplugOffline(message));
    }
  });

  app.get("/api/smartplug/status", async (c) => {
    try {
      const result = await getSmartplugData();
      return c.json({
        datetime: result.datetime,
        timezone: result.timezone,
        status: result.status === "ON",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const { datetime, timezone } = formatDateTimeTZ(new Date());
      return c.json({ datetime, timezone, status: false, error: message });
    }
  });

  app.post("/api/smartplug/on", async (c) => {
    try {
      const result = await setSmartplugPower(true);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json(buildSmartplugOffline(message));
    }
  });

  app.get("/api/smartplug/on", async (c) => {
    try {
      const result = await setSmartplugPower(true);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json(buildSmartplugOffline(message));
    }
  });

  app.post("/api/smartplug/off", async (c) => {
    try {
      const result = await setSmartplugPower(false);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json(buildSmartplugOffline(message));
    }
  });

  app.get("/api/smartplug/off", async (c) => {
    try {
      const result = await setSmartplugPower(false);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json(buildSmartplugOffline(message));
    }
  });

  app.get("/api/irblaster/current", async (c) => {
    try {
      const result = await getIrblasterData();
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  app.get("/api/irblaster/status", async (c) => {
    try {
      const result = await getIrblasterData();
      return c.json({
        datetime: result.datetime,
        timezone: result.timezone,
        status: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  app.get("/api/devices/scan", async (c) => {
    try {
      const query = new URL(c.req.url).searchParams;
      const result = await scanTuyaDevices(query);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  app.get("/api/devices/list", (c) => {
    try {
      const devices = [
        {
          name: "smartplug",
          id: requireEnv("TUYA_SMARTPLUG_ID"),
          ip: requireEnv("TUYA_SMARTPLUG_IP"),
          version: requireEnv("TUYA_SMARTPLUG_VERSION"),
        },
        {
          name: "irblaster",
          id: requireEnv("TUYA_IRBLASTER_ID"),
          ip: requireEnv("TUYA_IRBLASTER_IP"),
          version: requireEnv("TUYA_IRBLASTER_VERSION"),
        },
      ];
      return c.json({ devices });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  return app;
}

export const api = buildApp();

if (import.meta.main) {
  Deno.serve(api.fetch);
}
