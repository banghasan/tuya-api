const cssPath = new URL("../views/dashboard.css", import.meta.url);
const jsPath = new URL("../views/dashboard.js", import.meta.url);
const faviconPath = new URL("../views/favicon.svg", import.meta.url);
const favicon16Path = new URL("../views/favicon-16.png", import.meta.url);
const favicon32Path = new URL("../views/favicon-32.png", import.meta.url);
const appleTouchPath = new URL(
  "../views/apple-touch-icon.png",
  import.meta.url,
);
const faviconIcoPath = new URL("../views/favicon.ico", import.meta.url);

const css = await Deno.readTextFile(cssPath);
const js = await Deno.readTextFile(jsPath);
const favicon = await Deno.readTextFile(faviconPath);
const favicon16 = await Deno.readFile(favicon16Path);
const favicon32 = await Deno.readFile(favicon32Path);
const appleTouch = await Deno.readFile(appleTouchPath);
const faviconIco = await Deno.readFile(faviconIcoPath);

function buildAssetResponse(content: string, contentType: string): Response {
  return new Response(content, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=300",
    },
  });
}

function buildBinaryResponse(
  content: Uint8Array,
  contentType: string,
): Response {
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

export function dashboardFavicon(): Response {
  return buildAssetResponse(favicon, "image/svg+xml; charset=utf-8");
}

export function dashboardFavicon16(): Response {
  return buildBinaryResponse(favicon16, "image/png");
}

export function dashboardFavicon32(): Response {
  return buildBinaryResponse(favicon32, "image/png");
}

export function dashboardAppleTouch(): Response {
  return buildBinaryResponse(appleTouch, "image/png");
}

export function dashboardFaviconIco(): Response {
  return buildBinaryResponse(faviconIco, "image/x-icon");
}
