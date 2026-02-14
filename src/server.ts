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
  disconnect: () => void;
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

function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
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
  return createTuya({
    id: requireEnv("TUYA_SMARTPLUG_ID"),
    key: requireEnv("TUYA_SMARTPLUG_KEY"),
    ip: requireEnv("TUYA_SMARTPLUG_IP"),
    version: requireEnv("TUYA_SMARTPLUG_VERSION"),
  });
}

function createIrblasterDevice() {
  return createTuya({
    id: requireEnv("TUYA_IRBLASTER_ID"),
    key: requireEnv("TUYA_IRBLASTER_KEY"),
    ip: requireEnv("TUYA_IRBLASTER_IP"),
    version: requireEnv("TUYA_IRBLASTER_VERSION"),
  });
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

  app.get("/api/smartplug/current", async (c) => {
    try {
      const result = await getSmartplugData();
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
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
      return c.json({ error: message }, 500);
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
