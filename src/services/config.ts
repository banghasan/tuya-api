export function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
}

export function getApiKey(): string | null {
  return Deno.env.get("TUYA_API_KEY") ?? null;
}

export function verifyApiKey(
  c: { req: { header: (name: string) => string | undefined } },
): boolean {
  const expected = getApiKey();
  if (!expected) return true;
  const headerKey = c.req.header("x-api-key");
  return headerKey === expected;
}

export function verifyApiKeyForDashboard(
  c: { req: { header: (name: string) => string | undefined; url: string } },
): boolean {
  const expected = getApiKey();
  if (!expected) return true;
  const headerKey = c.req.header("x-api-key");
  if (headerKey === expected) return true;
  const urlKey = new URL(c.req.url).searchParams.get("key");
  return urlKey === expected;
}

export function getTimezone(): string {
  return Deno.env.get("TZ") ?? "Asia/Jakarta";
}

export function getTimeoutMs(): number {
  const raw = Deno.env.get("TUYA_TIMEOUT_MS");
  const value = Number(raw);
  if (!raw || !Number.isFinite(value)) return 5000;
  return Math.max(1000, value);
}

export function getScanTimeoutSecFromQuery(query: URLSearchParams): number {
  const rawQuery = query.get("timeout");
  const rawEnv = Deno.env.get("TUYA_SCAN_TIMEOUT_SEC");
  const value = Number(rawQuery ?? rawEnv);
  if (!Number.isFinite(value)) return 8;
  return Math.max(1, Math.floor(value));
}

export function getScanVersionsFromQuery(query: URLSearchParams): string[] {
  const rawQuery = query.get("versions");
  const rawEnv = Deno.env.get("TUYA_SCAN_VERSIONS");
  const raw = rawQuery ?? rawEnv ?? "3.3,3.1";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
