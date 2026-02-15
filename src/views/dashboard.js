const queryParams = new URL(globalThis.location.href).searchParams;
const parseQueryNumber = (key, fallback) => {
  const value = Number(queryParams.get(key));
  return Number.isFinite(value) ? value : fallback;
};
const refreshMs = Math.max(1000, parseQueryNumber("refresh", 2) * 1000);
const maxPoints = Math.max(20, parseQueryNumber("points", 120));
const maxWatt = Math.max(50, parseQueryNumber("watt_max", 2000));
const maxAmpere = Math.max(1, parseQueryNumber("ampere_max", 10));
let requiresKey = false;
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

const loadConfig = async () => {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    const data = await res.json();
    requiresKey = Boolean(data && data.requiresKey);
  } catch {
    return;
  }
};

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
  const scale = globalThis.devicePixelRatio || 1;
  chart.width = Math.max(300, Math.floor(rect.width * scale));
  chart.height = Math.floor(240 * scale);
};

const pushHistory = (payload) => {
  if (
    !payload ||
    typeof payload.watt !== "number" ||
    typeof payload.ampere !== "number"
  ) {
    return;
  }
  const wattVal = payload.watt === 0 ? 0.001 : payload.watt;
  const ampVal = payload.ampere === 0 ? 0.001 : payload.ampere;
  history.watt.push(wattVal);
  history.ampere.push(ampVal);
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
  const padding = 18;
  const innerH = h - padding * 2;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = padding + (innerH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const values = history.watt.concat(history.ampere);
  if (!values.length) return;
  const maxValue = Math.max(...values, 1);
  const minValue = 0;
  const scaleY = (val) =>
    h - padding - ((val - minValue) / (maxValue - minValue)) * innerH;
  const scaleX = (idx) =>
    (w - padding * 2) * (idx / Math.max(history.watt.length - 1, 1)) + padding;

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

  if (
    hoverIndex !== null &&
    hoverIndex >= 0 &&
    hoverIndex < history.watt.length
  ) {
    const x = scaleX(hoverIndex);
    ctx.strokeStyle = "rgba(226, 232, 240, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, h - padding);
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
    Math.min(
      len - 1,
      Math.round(((x - padding) / Math.max(usable, 1)) * (len - 1)),
    ),
  );
  hoverIndex = idx;
  const wVal = history.watt[idx];
  const aVal = history.ampere[idx];
  const ts = history.ts[idx];
  if (typeof wVal !== "number" || typeof aVal !== "number") return;
  tooltip.textContent = new Date(ts).toLocaleTimeString("id-ID", {
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
  elLast.textContent = payload && payload.datetime
    ? payload.datetime
    : new Date().toISOString();
  elError.textContent = payload && payload.error ? payload.error : "";
  if (payload) {
    const r = 90;
    const circumference = 2 * Math.PI * r;
    if (gaugeArc && typeof payload.watt === "number") {
      let ratio = Math.max(0, Math.min(payload.watt / maxWatt, 1));
      if (payload.watt === 0) ratio = 0.02;
      gaugeArc.style.strokeDasharray = circumference + " " + circumference;
      gaugeArc.style.strokeDashoffset = String(circumference * (1 - ratio));
    }
    if (gaugeAmpere && typeof payload.ampere === "number") {
      let ratio = Math.max(0, Math.min(payload.ampere / maxAmpere, 1));
      if (payload.ampere === 0) ratio = 0.02;
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
    elNextAt.textContent = "(" +
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
    if (res.status === 401) {
      showKeyModal("API key salah atau tidak ada.");
      return;
    }
    const data = await res.json();
    updateUI(data);
    startCountdown();
  } catch (err) {
    setStatus("OFFLINE");
    elError.textContent = err && err.message
      ? err.message
      : "Gagal memuat data";
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
    elError.textContent = err && err.message
      ? err.message
      : "Gagal mengubah status";
  } finally {
    btnOn.disabled = false;
    btnOff.disabled = false;
  }
};

const setRefreshInterval = (ms) => {
  const safe = Math.max(1000, ms);
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(fetchData, safe);
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

const init = async () => {
  const urlKey = queryParams.get("key");
  if (urlKey) {
    setStoredKey(urlKey);
    const cleanUrl = new URL(globalThis.location.href);
    cleanUrl.searchParams.delete("key");
    globalThis.history.replaceState({}, "", cleanUrl.toString());
  }

  applyHeaders();
  await loadConfig();
  if (requiresKey && !getStoredKey()) {
    showKeyModal("");
  }

  resizeChart();
  globalThis.addEventListener("resize", () => {
    resizeChart();
    drawChart();
  });
  if (chart) {
    chart.addEventListener("mousemove", showTooltip);
    chart.addEventListener("mouseleave", hideTooltip);
  }

  fetchData();
  setRefreshInterval(refreshMs);
};

init();
