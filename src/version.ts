const versionPath = new URL("../VERSION", import.meta.url);

let cachedVersion: string | null = null;

export async function getVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  const raw = await Deno.readTextFile(versionPath);
  cachedVersion = raw.trim();
  return cachedVersion;
}
