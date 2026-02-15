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
  const html = buildDashboardHtml();

  const response = await c.html(html);
  response.headers.set("Content-Security-Policy", DASHBOARD_CSP);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
