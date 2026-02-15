import { getApiKey } from "../services/config.ts";
import { buildDashboardHtml } from "../views/dashboard.ts";

type DashboardContext = {
  req: { url: string };
  html: (body: string) => Response | Promise<Response>;
};

const DASHBOARD_CSP = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

export async function dashboardHandler(c: DashboardContext) {
  const apiKey = getApiKey() ?? "";
  const urlParams = new URL(c.req.url).searchParams;
  const refreshParam = urlParams.get("refresh");
  const pointsParam = urlParams.get("points");
  const wattMaxParam = urlParams.get("watt_max");
  const ampereMaxParam = urlParams.get("ampere_max");

  const refreshMs = Math.max(
    1000,
    Number.isFinite(Number(refreshParam)) ? Number(refreshParam) * 1000 : 2000,
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

  const html = buildDashboardHtml({
    requiresKey: Boolean(apiKey),
    refreshMs,
    maxPoints,
    maxWatt,
    maxAmpere,
  });

  const response = await c.html(html);
  response.headers.set("Content-Security-Policy", DASHBOARD_CSP);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
