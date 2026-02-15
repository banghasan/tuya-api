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
    const apiKey = getApiKey() ?? "";
    const urlParams = new URL(c.req.url).searchParams;
    const refreshParam = urlParams.get("refresh");
    const pointsParam = urlParams.get("points");
    const wattMaxParam = urlParams.get("watt_max");
    const ampereMaxParam = urlParams.get("ampere_max");
    const refreshMs = Math.max(
      1000,
      Number.isFinite(Number(refreshParam))
        ? Number(refreshParam) * 1000
        : 2000,
    );
    const maxPoints = Math.max(
      20,
      Number.isFinite(Number(pointsParam)) ? Number(pointsParam) : 120,
    );
    const maxWatt = Math.max(
      50,
      Number.isFinite(Number(wattMaxParam)) ? Number(wattMaxParam) : 2000,
    );
    const maxAmpere = Math.max(
      1,
      Number.isFinite(Number(ampereMaxParam)) ? Number(ampereMaxParam) : 10,
    );
    const requiresKey = apiKey ? "1" : "0";
    const safeRefresh = Number.isFinite(refreshMs) ? String(refreshMs) : "2000";
    const safePoints = Number.isFinite(maxPoints) ? String(maxPoints) : "120";
    const safeWattMax = Number.isFinite(maxWatt) ? String(maxWatt) : "2000";
    const safeAmpereMax = Number.isFinite(maxAmpere) ? String(maxAmpere) : "10";
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
      .stat.gauge {
        grid-column: span 2;
        align-items: center;
        justify-items: center;
      }
      .gauge-wrap {
        position: relative;
        width: 220px;
        height: 220px;
      }
      .gauge-wrap svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }
      .gauge-track {
        fill: none;
        stroke: rgba(255, 255, 255, 0.08);
        stroke-width: 14;
      }
      .gauge-arc {
        fill: none;
        stroke: url(#gaugeGradient);
        stroke-width: 14;
        stroke-linecap: round;
        stroke-dasharray: 0 999;
        stroke-dashoffset: 0;
      }
      .gauge-arc.ampere {
        stroke: url(#ampereGradient);
      }
      .gauge-center {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        text-align: center;
        gap: 2px;
        transform: translateY(55px);
      }
      .gauge-value {
        font-size: 32px;
        font-weight: 600;
        line-height: 1;
      }
      .gauge-meta {
        font-size: 11px;
        color: var(--muted);
        letter-spacing: 0.06em;
        line-height: 1;
        margin-top: -6px;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        border-radius: 999px;
        background: rgba(52, 211, 153, 0.18);
        color: var(--ok);
        font-weight: 600;
        font-size: 14px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .status-pill.off {
        background: rgba(248, 113, 113, 0.15);
        color: var(--danger);
      }
      .status-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: currentColor;
        box-shadow: 0 0 12px currentColor;
      }
      .icon-actions {
        display: inline-flex;
        gap: 8px;
      }
      .icon-btn {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.12);
        background: var(--panel-strong);
        color: var(--text);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.2s ease, border 0.2s ease;
      }
      .icon-btn svg {
        width: 20px;
        height: 20px;
      }
      .icon-btn[data-tip] {
        position: relative;
      }
      .icon-btn[data-tip]::after {
        content: attr(data-tip);
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translate(-50%, 120%) scale(0.98);
        background: rgba(15, 23, 42, 0.95);
        color: #e2e8f0;
        padding: 6px 8px;
        border-radius: 8px;
        font-size: 11px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        opacity: 0;
        pointer-events: none;
        white-space: nowrap;
        transition: opacity 0.15s ease, transform 0.15s ease;
        box-shadow: 0 12px 24px rgba(8, 15, 28, 0.35);
      }
      .icon-btn[data-tip]:hover::after {
        opacity: 1;
        transform: translate(-50%, 140%) scale(1);
      }
      .icon-btn.dim {
        background: var(--panel-strong);
        color: var(--muted);
        border-color: rgba(148, 163, 184, 0.2);
        box-shadow: none;
      }
      .icon-btn.primary {
        background: rgba(52, 211, 153, 0.18);
        color: #34d399;
        border-color: rgba(52, 211, 153, 0.4);
        box-shadow: 0 10px 24px rgba(52, 211, 153, 0.2);
      }
      .icon-btn.danger {
        background: rgba(248, 113, 113, 0.18);
        color: #f87171;
        border-color: rgba(248, 113, 113, 0.4);
        box-shadow: 0 10px 24px rgba(248, 113, 113, 0.2);
      }
      .icon-btn:hover:not(:disabled) {
        transform: translateY(-1px);
      }
      .icon-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .footer {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        color: var(--muted);
        font-size: 13px;
        align-items: center;
      }
      .refresh-config {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--muted);
      }
      .refresh-config label {
        font-size: 12px;
      }
      #refresh-input {
        width: 72px;
        padding: 6px 8px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.12);
        background: #0f172a;
        color: var(--text);
        font-size: 12px;
      }
      #refresh-input:focus {
        outline: none;
        border-color: rgba(56, 189, 248, 0.6);
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.15);
      }
      canvas {
        width: 100%;
        height: 240px;
        display: block;
        border-radius: 12px;
        background: #0f172a;
      }
      .chart-wrap {
        position: relative;
      }
      .chart-header {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 10px;
      }
      .legend {
        display: inline-flex;
        gap: 16px;
        align-items: center;
        color: #e2e8f0;
        font-size: 12px;
      }
      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .legend-swatch {
        display: inline-block;
        width: 14px;
        height: 14px;
        border-radius: 4px;
        background: #38bdf8;
      }
      .legend-swatch.ampere {
        background: #34d399;
      }
      .modal {
        position: fixed;
        inset: 0;
        background: rgba(6, 12, 24, 0.65);
        display: grid;
        place-items: center;
        padding: 20px;
        backdrop-filter: blur(4px);
      }
      .modal.hidden {
        display: none;
      }
      .modal-card {
        width: min(420px, 100%);
        background: var(--panel);
        border-radius: 16px;
        padding: 22px;
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: var(--shadow);
        display: grid;
        gap: 12px;
      }
      .modal-title {
        font-size: 18px;
        font-weight: 600;
      }
      .modal-subtitle {
        color: var(--muted);
        font-size: 13px;
      }
      #key-input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.12);
        background: #0f172a;
        color: var(--text);
        font-size: 14px;
      }
      #key-input:focus {
        outline: none;
        border-color: rgba(56, 189, 248, 0.6);
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
      }
      .tooltip {
        position: absolute;
        padding: 8px 10px;
        border-radius: 10px;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(148, 163, 184, 0.4);
        color: #e2e8f0;
        font-size: 12px;
        white-space: nowrap;
        pointer-events: none;
        transform: translate(-50%, -110%);
        box-shadow: 0 12px 24px rgba(8, 15, 28, 0.45);
      }
      .tooltip.hidden {
        display: none;
      }
      .error {
        color: var(--danger);
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="shell" data-requires-key="${requiresKey}" data-refresh="${safeRefresh}" data-points="${safePoints}" data-watt-max="${safeWattMax}" data-ampere-max="${safeAmpereMax}">
      <header>
        <div class="title">
          <h1>Smartplug Dashboard</h1>
          <div class="subtitle">Monitoring real-time smartplug Tuya</div>
        </div>
        <div class="status-wrap">
          <div id="status-pill" class="status-pill">
            <span class="status-dot" aria-hidden="true"></span>
            <span id="status-text">Muat data...</span>
          </div>
          <div class="icon-actions">
            <button id="btn-on" class="icon-btn primary" aria-label="Nyalakan" data-tip="Nyalakan">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v6m4.24-3.76a8 8 0 1 1-8.48 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <button id="btn-off" class="icon-btn danger" aria-label="Matikan" data-tip="Matikan">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v6m4.24-3.76a8 8 0 1 1-8.48 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M5 19l14-14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <button id="btn-refresh" class="icon-btn" aria-label="Refresh" data-tip="Refresh">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button id="btn-key" class="icon-btn dim" aria-label="Ganti API Key" data-tip="Ganti API Key">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 3l-8.5 8.5a4.5 4.5 0 1 1-1.5-1.5L19.5 1.5 21 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 7l1 1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <section class="card">
        <div class="grid">
          <div class="stat gauge">
            <span>Daya</span>
            <div class="gauge-wrap">
              <svg id="watt-gauge" viewBox="0 0 220 220" aria-label="Watt gauge" role="img">
                <defs>
                  <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#22d3ee"></stop>
                    <stop offset="50%" stop-color="#38bdf8"></stop>
                    <stop offset="100%" stop-color="#f87171"></stop>
                  </linearGradient>
                </defs>
                <circle class="gauge-track" cx="110" cy="110" r="90"></circle>
                <circle class="gauge-arc" id="gauge-arc" cx="110" cy="110" r="90"></circle>
              </svg>
              <div class="gauge-center">
                <div class="gauge-value" id="watt">-</div>
                <div class="gauge-meta" id="watt-meta">Max - W</div>
              </div>
            </div>
          </div>
          <div class="stat gauge">
            <span>Arus</span>
            <div class="gauge-wrap">
              <svg id="ampere-gauge" viewBox="0 0 220 220" aria-label="Ampere gauge" role="img">
                <defs>
                  <linearGradient id="ampereGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#34d399"></stop>
                    <stop offset="50%" stop-color="#a3e635"></stop>
                    <stop offset="100%" stop-color="#facc15"></stop>
                  </linearGradient>
                </defs>
                <circle class="gauge-track" cx="110" cy="110" r="90"></circle>
                <circle class="gauge-arc ampere" id="gauge-ampere" cx="110" cy="110" r="90"></circle>
              </svg>
              <div class="gauge-center">
                <div class="gauge-value" id="ampere">-</div>
                <div class="gauge-meta" id="ampere-meta">Max - A</div>
              </div>
            </div>
          </div>
          <div class="stat">
            <span>Tegangan</span>
            <strong id="volt">-</strong>
          </div>
          <div class="stat">
            <span>Total kWh</span>
            <strong id="total">-</strong>
          </div>
        </div>
      </section>

      <section class="card chart-card">
        <div class="chart-header">
          <div class="legend">
            <span class="legend-item"><i class="legend-swatch watt"></i>Watt</span>
            <span class="legend-item"><i class="legend-swatch ampere"></i>Ampere</span>
          </div>
        </div>
        <div class="chart-wrap">
          <canvas id="chart" width="900" height="240" aria-label="Grafik watt dan ampere" role="img"></canvas>
          <div id="chart-tooltip" class="tooltip hidden"></div>
        </div>
      </section>

      <section class="footer card">
        <div>Last update: <span id="last-update">-</span></div>
        <div>Next refresh: <span id="next-refresh">-</span> <span id="next-refresh-at"></span></div>
        <div class="refresh-config">
          <label for="refresh-input">Refresh (detik)</label>
          <input id="refresh-input" type="number" min="1" step="1" />
          <button id="refresh-save" class="icon-btn dim" aria-label="Simpan refresh" data-tip="Simpan refresh">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12l4 4L19 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div id="error" class="error"></div>
      </section>
    </div>
    <div id="key-modal" class="modal hidden" role="dialog" aria-modal="true">
      <div class="modal-card">
        <div class="modal-title">Masukkan API Key</div>
        <div class="modal-subtitle">Key disimpan di session browser (tidak tampil di URL).</div>
        <input id="key-input" type="password" placeholder="TUYA_API_KEY" autocomplete="off" />
        <div class="modal-actions">
          <button id="key-save" class="icon-btn primary">Simpan</button>
        </div>
        <div id="key-error" class="error"></div>
      </div>
    </div>
    <script>
      const root = document.querySelector(".shell");
      const dataset = root && root.dataset ? root.dataset : {};
      const requiresKey = dataset.requiresKey === "1";
      const refreshMs = Number(dataset.refresh || "2000") || 2000;
      const maxPoints = Number(dataset.points || "120") || 120;
      const maxWatt = Number(dataset.wattMax || "2000") || 2000;
      const maxAmpere = Number(dataset.ampereMax || "10") || 10;
      const headers = {};
      let refreshTimer = null;

      const statusPill = document.getElementById("status-pill");
      const statusText = document.getElementById("status-text");
      const elWatt = document.getElementById("watt");
      const elVolt = document.getElementById("volt");
      const elAmpere = document.getElementById("ampere");
      const elTotal = document.getElementById("total");
      const elLast = document.getElementById("last-update");
      const elNext = document.getElementById("next-refresh");
      const elNextAt = document.getElementById("next-refresh-at");
      const elError = document.getElementById("error");
      const refreshInput = document.getElementById("refresh-input");
      const refreshSave = document.getElementById("refresh-save");
      const btnOn = document.getElementById("btn-on");
      const btnOff = document.getElementById("btn-off");
      const btnRefresh = document.getElementById("btn-refresh");
      const btnKey = document.getElementById("btn-key");
      const chart = document.getElementById("chart");
      const ctx = chart && chart.getContext ? chart.getContext("2d") : null;
      const tooltip = document.getElementById("chart-tooltip");
      const gaugeArc = document.getElementById("gauge-arc");
      const gaugeAmpere = document.getElementById("gauge-ampere");
      const wattMeta = document.getElementById("watt-meta");
      const ampereMeta = document.getElementById("ampere-meta");
      const keyModal = document.getElementById("key-modal");
      const keyInput = document.getElementById("key-input");
      const keySave = document.getElementById("key-save");
      const keyError = document.getElementById("key-error");

      const getStoredKey = () => {
        try {
          return sessionStorage.getItem("tuyaApiKey") || "";
        } catch {
          return "";
        }
      };
      const setStoredKey = (value) => {
        try {
          sessionStorage.setItem("tuyaApiKey", value);
        } catch {
          return;
        }
      };
      const applyHeaders = () => {
        const stored = getStoredKey();
        if (stored) headers["x-api-key"] = stored;
        else delete headers["x-api-key"];
      };
      const showKeyModal = (message) => {
        if (!keyModal) return;
        if (keyError) keyError.textContent = message || "";
        keyModal.classList.remove("hidden");
        if (keyInput) keyInput.focus();
      };
      const hideKeyModal = () => {
        if (!keyModal) return;
        keyModal.classList.add("hidden");
      };

      const urlKey = new URL(window.location.href).searchParams.get("key");
      if (urlKey) {
        setStoredKey(urlKey);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("key");
        history.replaceState({}, "", cleanUrl.toString());
      }
      applyHeaders();
      if (requiresKey && !getStoredKey()) {
        showKeyModal("");
      }

      if (keySave && keyInput) {
        keySave.addEventListener("click", () => {
          const value = keyInput.value.trim();
          if (!value) {
            showKeyModal("API key wajib diisi.");
            return;
          }
          setStoredKey(value);
          applyHeaders();
          hideKeyModal();
          fetchData();
        });
      }
      if (btnKey) {
        btnKey.addEventListener("click", () => {
          setStoredKey("");
          applyHeaders();
          showKeyModal("");
        });
      }

      if (gaugeArc || gaugeAmpere) {
        const r = 90;
        const circumference = 2 * Math.PI * r;
        if (gaugeArc) {
          gaugeArc.style.strokeDasharray = circumference + " " + circumference;
          gaugeArc.style.strokeDashoffset = String(circumference);
        }
        if (gaugeAmpere) {
          gaugeAmpere.style.strokeDasharray = circumference + " " + circumference;
          gaugeAmpere.style.strokeDashoffset = String(circumference);
        }
      }
      if (wattMeta) wattMeta.textContent = "Max " + maxWatt + " W";
      if (ampereMeta) ampereMeta.textContent = "Max " + maxAmpere + " A";

      const formatNumber = (value, unit, digits = 2) => {
        if (value === null || value === undefined) return "-";
        if (typeof value !== "number") return "-";
        return value.toFixed(digits) + " " + unit;
      };
      const formatGauge = (value, unit, digits = 2) => {
        if (value === null || value === undefined) return "-";
        if (typeof value !== "number") return "-";
        return value.toFixed(digits) + unit;
      };

      const history = {
        watt: [],
        ampere: [],
        ts: [],
        maxPoints,
      };

      const resizeChart = () => {
        if (!chart) return;
        const rect = chart.getBoundingClientRect();
        const scale = window.devicePixelRatio || 1;
        chart.width = Math.max(300, Math.floor(rect.width * scale));
        chart.height = Math.floor(240 * scale);
      };

      const pushHistory = (payload) => {
        if (!payload || typeof payload.watt !== "number" || typeof payload.ampere !== "number") return;
        history.watt.push(payload.watt);
        history.ampere.push(payload.ampere);
        history.ts.push(Date.now());
        if (history.watt.length > history.maxPoints) {
          history.watt.shift();
          history.ampere.shift();
          history.ts.shift();
        }
      };

      let hoverIndex = null;
      const drawChart = () => {
        if (!ctx || !chart) return;
        const w = chart.width;
        const h = chart.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
          const y = (h / 5) * i;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        const values = history.watt.concat(history.ampere);
        if (!values.length) return;
        const maxValue = Math.max(...values, 1);
        const minValue = 0;
        const scaleY = (val) => h - ((val - minValue) / (maxValue - minValue)) * (h - 20) - 10;
        const scaleX = (idx) => (w - 20) * (idx / Math.max(history.watt.length - 1, 1)) + 10;

        const drawLine = (arr, color) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          arr.forEach((val, idx) => {
            const x = scaleX(idx);
            const y = scaleY(val);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        };

        drawLine(history.watt, "#38bdf8");
        drawLine(history.ampere, "#34d399");

        if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < history.watt.length) {
          const x = scaleX(hoverIndex);
          ctx.strokeStyle = "rgba(226, 232, 240, 0.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, 10);
          ctx.lineTo(x, h - 10);
          ctx.stroke();
          const dot = (val, color) => {
            const y = scaleY(val);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#0f172a";
            ctx.lineWidth = 2;
            ctx.stroke();
          };
          const wVal = history.watt[hoverIndex];
          const aVal = history.ampere[hoverIndex];
          if (typeof wVal === "number") dot(wVal, "#38bdf8");
          if (typeof aVal === "number") dot(aVal, "#34d399");
        }

      };

      const showTooltip = (evt) => {
        if (!chart || !tooltip) return;
        const len = history.watt.length;
        if (!len) return;
        const rect = chart.getBoundingClientRect();
        const x = evt.clientX - rect.left;
        const y = evt.clientY - rect.top;
        const padding = 10;
        const usable = rect.width - padding * 2;
        const idx = Math.max(
          0,
          Math.min(len - 1, Math.round(((x - padding) / Math.max(usable, 1)) * (len - 1))),
        );
        hoverIndex = idx;
        const wVal = history.watt[idx];
        const aVal = history.ampere[idx];
        const ts = history.ts[idx];
        if (typeof wVal !== "number" || typeof aVal !== "number") return;
        tooltip.textContent =
          new Date(ts).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }) +
          " • " +
          wVal.toFixed(1) +
          " W • " +
          aVal.toFixed(3) +
          " A";
        tooltip.style.left = x + "px";
        tooltip.style.top = y + "px";
        tooltip.classList.remove("hidden");
        drawChart();
      };

      const hideTooltip = () => {
        if (!tooltip) return;
        hoverIndex = null;
        tooltip.classList.add("hidden");
        drawChart();
      };

      const setStatus = (status) => {
        if (statusText) statusText.textContent = status;
        if (statusPill) statusPill.classList.toggle("off", status !== "ON");
      };

      const updateUI = (payload) => {
        setStatus(payload && payload.status ? payload.status : "UNKNOWN");
        elWatt.textContent = formatGauge(payload.watt, "W", 1);
        elVolt.textContent = formatNumber(payload.volt, "V", 1);
        elAmpere.textContent = formatGauge(payload.ampere, "A", 3);
        elTotal.textContent = formatNumber(payload.total_kwh, "kWh", 2);
        elLast.textContent =
          payload && payload.datetime ? payload.datetime : new Date().toISOString();
        elError.textContent = payload && payload.error ? payload.error : "";
        if (payload) {
          const r = 90;
          const circumference = 2 * Math.PI * r;
          if (gaugeArc && typeof payload.watt === "number") {
            const ratio = Math.max(0, Math.min(payload.watt / maxWatt, 1));
            gaugeArc.style.strokeDasharray = circumference + " " + circumference;
            gaugeArc.style.strokeDashoffset = String(circumference * (1 - ratio));
          }
          if (gaugeAmpere && typeof payload.ampere === "number") {
            const ratio = Math.max(0, Math.min(payload.ampere / maxAmpere, 1));
            gaugeAmpere.style.strokeDasharray = circumference + " " + circumference;
            gaugeAmpere.style.strokeDashoffset = String(circumference * (1 - ratio));
          }
        }
        pushHistory(payload);
        drawChart();
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
      const setRefreshInterval = (ms) => {
        const safe = Math.max(1000, ms);
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(fetchData, safe);
      };

      const fetchData = async () => {
        try {
          const res = await fetch("/api/smartplug/current", { headers });
          if (res.status === 401) {
            showKeyModal("API key salah atau tidak ada.");
            return;
          }
          const data = await res.json();
          updateUI(data);
          startCountdown();
        } catch (err) {
          setStatus("OFFLINE");
          elError.textContent = err && err.message ? err.message : "Gagal memuat data";
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
          if (res.status === 401) {
            showKeyModal("API key salah atau tidak ada.");
            return;
          }
          const data = await res.json();
          updateUI(data);
        } catch (err) {
          elError.textContent =
            err && err.message ? err.message : "Gagal mengubah status";
        } finally {
          btnOn.disabled = false;
          btnOff.disabled = false;
        }
      };

      if (btnOn) btnOn.addEventListener("click", () => sendPower(true));
      if (btnOff) btnOff.addEventListener("click", () => sendPower(false));
      if (btnRefresh) btnRefresh.addEventListener("click", fetchData);

      if (refreshInput) {
        refreshInput.value = String(Math.round(refreshMs / 1000));
      }
      if (refreshSave && refreshInput) {
        refreshSave.addEventListener("click", () => {
          const value = Number(refreshInput.value);
          const ms = Number.isFinite(value) ? value * 1000 : refreshMs;
          setRefreshInterval(ms);
        });
      }

      resizeChart();
      window.addEventListener("resize", () => {
        resizeChart();
        drawChart();
      });
      if (chart) {
        chart.addEventListener("mousemove", showTooltip);
        chart.addEventListener("mouseleave", hideTooltip);
      }

      fetchData();
      setRefreshInterval(refreshMs);
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
