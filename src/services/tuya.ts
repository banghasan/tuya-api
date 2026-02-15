import TuyAPI from "tuyapi";
import {
  getScanTimeoutSecFromQuery,
  getScanVersionsFromQuery,
  getTimeoutMs,
  requireEnv,
} from "./config.ts";
import { formatDateTimeTZ } from "./time.ts";

export type TuyaDevice = {
  find: (...args: unknown[]) => Promise<unknown>;
  connect: () => Promise<void>;
  get: (options?: unknown) => Promise<unknown>;
  set: (options?: unknown) => Promise<unknown>;
  disconnect: () => void;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type TuyaFactory = (options: Record<string, unknown>) => TuyaDevice;

const defaultTuyaFactory: TuyaFactory = (options) =>
  new TuyAPI(options as unknown as { id: string; key: string }) as unknown as TuyaDevice;

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

function withTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
  const timeoutMs = getTimeoutMs();
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timeout ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]);
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

export async function getSmartplugData() {
  const device = createSmartplugDevice();
  try {
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

export async function setSmartplugPower(powerOn: boolean) {
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

export async function getIrblasterData() {
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

export async function scanTuyaDevices(query: URLSearchParams) {
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
