const cssPath = new URL("../views/dashboard.css", import.meta.url);
const jsPath = new URL("../views/dashboard.js", import.meta.url);

const css = await Deno.readTextFile(cssPath);
const js = await Deno.readTextFile(jsPath);

function buildAssetResponse(content: string, contentType: string): Response {
  return new Response(content, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=300",
    },
  });
}

export function dashboardCss(): Response {
  return buildAssetResponse(css, "text/css; charset=utf-8");
}

export function dashboardJs(): Response {
  return buildAssetResponse(js, "application/javascript; charset=utf-8");
}
