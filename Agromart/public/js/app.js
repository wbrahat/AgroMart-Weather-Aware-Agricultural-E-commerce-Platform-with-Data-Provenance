/* AgroMart app.js  -  patched for kW heat monitor + DELIVERY_PROFIT price audit */

const agromartUser = sessionStorage.getItem("agromart_user");
const agromartToken = sessionStorage.getItem("agromart_token");

if (!agromartUser || !agromartToken) {
  window.location.replace("/?login=1");
}

function logout() {
  sessionStorage.removeItem("agromart_user");
  sessionStorage.removeItem("agromart_token");
  sessionStorage.removeItem("agromart_role");
  localStorage.removeItem("hasSeenOnboarding");
  window.location.replace("/");
}

let districts = [];
let farmers = [];
let products = [];
let vehicles = [];
let warehouses = [];
let shipments = [];
let orders = [];
let monitoring = [];
let dashboardState = null;

const API_ORIGIN =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:3000"
    : window.location.origin;

const SHIP_STATUSES = [
  "PENDING",
  "IN_TRANSIT",
  "IN_WAREHOUSE",
  "DELIVERED",
  "PARTIALLY_DELIVERED",
  "SPOILED",
  "DELAYED",
  "CANCELLED"
];

const ORDER_STATUSES = [
  "PLACED",
  "CONFIRMED",
  "IN_TRANSIT",
  "DELAYED",
  "DELIVERED",
  "PARTIALLY_DELIVERED",
  "CANCELLED",
  "RETURNED"
];

async function api(url, opts = {}) {
  let res;
  try {
    res = await fetch(`${API_ORIGIN}${url}`, {
      headers: { "Content-Type": "application/json" },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  } catch (error) {
    throw new Error("Backend server is offline. Start API server on port 3000.");
  }

  const contentType = res.headers.get("content-type") || "";
  let d = {};

  if (contentType.includes("application/json")) {
    d = await res.json();
  } else {
    throw new Error("Invalid API response from server.");
  }

  if (!res.ok) {
    throw new Error(d.error || "Request failed");
  }

  return d;
}

function toast(msg, type = "success") {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function bdt(n) {
  return "Tk " + Number(n || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function fmtDate(ts) {
  return ts
    ? new Date(ts).toLocaleDateString("en-BD", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      })
    : " - ";
}

function fmtDT(ts) {
  return ts
    ? new Date(ts).toLocaleString("en-BD", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : " - ";
}

function faIcon(name) {
  return `<i class="fa-solid ${name}" aria-hidden="true"></i>`;
}

function emptyState(iconName, message) {
  return `<div class="empty"><div class="empty-icon">${faIcon(iconName)}</div><p>${message}</p></div>`;
}

function toLocalDT(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function badge(s) {
  const c =
    {
      PENDING: "badge-yellow",
      IN_TRANSIT: "badge-blue",
      IN_WAREHOUSE: "badge-yellow",
      DELIVERED: "badge-green",
      PARTIALLY_DELIVERED: "badge-green",
      SPOILED: "badge-red",
      DELAYED: "badge-red",
      CANCELLED: "badge-gray",

      PLACED: "badge-blue",
      CONFIRMED: "badge-blue",
      RETURNED: "badge-gray",

      LOW: "badge-green",
      MEDIUM: "badge-yellow",
      HIGH: "badge-red",

      INFO: "badge-blue",
      WARNING: "badge-yellow",
      CRITICAL: "badge-red",

      Active: "badge-green",
      Inactive: "badge-gray",
      Available: "badge-green",
      Busy: "badge-yellow",
      OK: "badge-green",

      PROFIT: "badge-green",
      LOSS: "badge-red",
      BREAK_EVEN: "badge-gray",

      "HIGH RISK": "badge-red",
      SAFE: "badge-green"
    }[s] || "badge-gray";

  return `<span class="badge ${c}">${String(s).replace(/_/g, " ")}</span>`;
}

function getDashboardUser() {
  try {
    return JSON.parse(sessionStorage.getItem("agromart_user") || "null");
  } catch {
    return null;
  }
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function compactNumber(value) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(toNumber(value));
}

function dashboardInitials(user) {
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "A";
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "A";
}

function dashboardFullName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Admin";
}

function dashboardRole() {
  return sessionStorage.getItem("agromart_role") || "Admin";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRoute(source, destination) {
  return `${source || "-"} \u2192 ${destination || "-"}`;
}

function getRouteLabel(shipment) {
  return formatRoute(
    shipment.source_district?.name || shipment.source_district || "-",
    shipment.dest_district?.name || shipment.dest_district || "-"
  );
}

function getShipmentRiskLevel(shipment) {
  if (shipment.status === "DELAYED" || shipment.is_temp_breach || shipment.is_overloaded) return "danger";
  if (shipment.status === "IN_TRANSIT") return "warning";
  return "success";
}

function getShipmentRiskText(shipment) {
  if (shipment.is_temp_breach || shipment.is_overloaded) return "Cold-chain risk";
  if (shipment.status === "DELAYED") return "Delayed";
  if (shipment.status === "IN_TRANSIT") return "Moving";
  return "Healthy";
}

function getDashboardNotifications() {
  if (!dashboardState) return [];

  const items = [];

  (dashboardState.coldChainCards || []).forEach((card) => {
    if (card.statusClass === "danger") {
      items.push({
        tone: "danger",
        title: `${card.code} needs attention`,
        text: `${card.product} on ${card.route} is reporting ${card.temp}`,
        meta: card.riskText
      });
    }
  });

  (dashboardState.activeShipmentRows || []).forEach((shipment) => {
    if (shipment.status === "DELAYED") {
      items.push({
        tone: "warning",
        title: `${shipment.product?.name || "Shipment"} delayed`,
        text: `${getRouteLabel(shipment)} is behind schedule`,
        meta: shipment.estimated_arrival ? `ETA ${fmtDT(shipment.estimated_arrival)}` : "No ETA"
      });
    }
  });

  if ((dashboardState.summary?.critical_events_24h || 0) > 0) {
    items.push({
      tone: "danger",
      title: "Critical events in last 24h",
      text: `${dashboardState.summary.critical_events_24h} critical event(s) recorded from the live feed.`,
      meta: "Monitor now"
    });
  }

  if ((dashboardState.summary?.low_stock || 0) > 0) {
    items.push({
      tone: "warning",
      title: "Low stock detected",
      text: `${dashboardState.summary.low_stock} products are under the threshold.`,
      meta: "Reorder soon"
    });
  }

  if (!items.length) {
    items.push({
      tone: "success",
      title: "All systems nominal",
      text: "No high-priority alerts right now.",
      meta: "Live dashboard"
    });
  }

  return items.slice(0, 6);
}

// AI Suggestions have been removed per user request.

function toggleDashboardPanel(panel) {
  const notificationPanel = document.getElementById("dashboard-notification-panel");
  if (!notificationPanel) return;

  const willOpen = !notificationPanel.classList.contains("open");

  // Only notifications panel is supported now.
  notificationPanel.classList.remove("open");

  if (panel === "notifications" && willOpen) {
    notificationPanel.classList.add("open");
  }
}

function closeDashboardPanels() {
  document.getElementById("dashboard-notification-panel")?.classList.remove("open");
}

function renderDashboardNotificationPanel() {
  const items = getDashboardNotifications();

  return `
    <div class="dashboard-popover-overlay" id="dashboard-notification-panel" onclick="closeDashboardPanels()">
      <div class="dashboard-popover dashboard-notification-panel" onclick="event.stopPropagation()">
        <div class="dashboard-popover-head">
          <div>
            <h3>Notifications</h3>
            <p>Live risk and status signals from your project data.</p>
          </div>
          <button class="dashboard-popover-close" type="button" onclick="closeDashboardPanels()">×</button>
        </div>
        <div class="dashboard-popover-list">
          ${items
            .map(
              (item) => `
                <div class="dashboard-notification-item ${item.tone}">
                  <div class="dashboard-notification-dot"></div>
                  <div>
                    <strong>${escapeHtml(item.title)}</strong>
                    <p>${escapeHtml(item.text)}</p>
                    <span>${escapeHtml(item.meta)}</span>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

// AI panel removed. Keep an empty renderer to avoid undefined calls.
function renderDashboardAiPanel() {
  return "";
}

function refreshDashboardOverlays() {
  const notificationPanel = document.getElementById("dashboard-notification-panel");
  if (notificationPanel) notificationPanel.outerHTML = renderDashboardNotificationPanel();
}

function filterDashboard(query = "") {
  const q = query.trim().toLowerCase();

  document.querySelectorAll("#dashboard-root .dashboard-searchable").forEach((el) => {
    const visible = !q || el.textContent.toLowerCase().includes(q);
    el.classList.toggle("is-hidden", !visible);
  });
}

function average(values) {
  const nums = values.map((value) => toNumber(value)).filter((value) => Number.isFinite(value));
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatDayLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function groupShipmentStatus(status) {
  if (status === "DELIVERED") return "Delivered";
  if (status === "SPOILED") return "Spoiled";
  if (status === "DELAYED") return "Delayed";
  if (status === "PENDING") return "Pending";
  return ["IN_TRANSIT", "IN_WAREHOUSE", "PARTIALLY_DELIVERED"].includes(status)
    ? "In Transit"
    : "Other";
}

function renderLineChart(series, options = {}) {
  const width = options.width || 720;
  const height = options.height || 240;
  const paddingX = 24;
  const paddingY = 24;
  const color = options.color || "#ef4444";
  const labels = series.length ? series : [{ label: "No data", value: 0 }];
  const maxValue = Math.max(1, ...labels.map((item) => toNumber(item.value)));
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  const step = labels.length > 1 ? usableWidth / (labels.length - 1) : 0;
  const points = labels.map((item, index) => {
    const x = labels.length > 1 ? paddingX + index * step : width / 2;
    const y = height - paddingY - (toNumber(item.value) / maxValue) * usableHeight;
    return { x, y, label: item.label, value: item.value };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = points.length > 1
    ? `M ${points[0].x} ${height - paddingY} L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points[points.length - 1].x} ${height - paddingY} Z`
    : `M ${points[0].x} ${height - paddingY} L ${points[0].x} ${points[0].y} L ${points[0].x} ${height - paddingY} Z`;
  const xLabels = points
    .map((point) => `<span>${point.label}</span>`)
    .join("");

  return `
    <div class="chart-shell">
      <svg viewBox="0 0 ${width} ${height}" class="line-chart" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="dashboardTrendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.28" />
            <stop offset="100%" stop-color="${color}" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#dashboardTrendFill)"></path>
        <polyline points="${linePoints}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${points
          .map(
            (point) => `
              <circle cx="${point.x}" cy="${point.y}" r="4.2" fill="white" stroke="${color}" stroke-width="3"></circle>
            `
          )
          .join("")}
      </svg>
      <div class="chart-axis">${xLabels}</div>
    </div>
  `;
}

function renderBarChart(series, options = {}) {
  const maxValue = Math.max(1, ...series.map((item) => toNumber(item.value)));
  const color = options.color || "#16a34a";

  return `
    <div class="bars-chart">
      ${series
        .map((item) => {
          const heightPercent = Math.max(6, (toNumber(item.value) / maxValue) * 100);
          return `
            <div class="bar-item dashboard-searchable">
              <div class="bar-track">
                <span class="bar-fill" style="height:${heightPercent}%; background: linear-gradient(180deg, ${color} 0%, rgba(22, 163, 74, 0.82) 100%);"></span>
              </div>
              <div class="bar-label">${item.label}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderDonutChart(segments) {
  const total = segments.reduce((sum, item) => sum + toNumber(item.value), 0) || 1;
  let cursor = 0;

  const stops = segments.map((item) => {
    const start = cursor;
    const pct = (toNumber(item.value) / total) * 100;
    cursor += pct;
    return `${item.color} ${start}% ${cursor}%`;
  }).join(", ");

  const legend = segments
    .map(
      (item) => `
        <div class="legend-item dashboard-searchable">
          <div class="legend-left">
            <span class="legend-dot" style="background:${item.color}"></span>
            <span>${item.label}</span>
          </div>
          <strong>${item.value} (${item.percent}%)</strong>
        </div>
      `
    )
    .join("");

  return `
    <div class="donut-grid">
      <div class="donut-wrap">
        <div class="donut" data-total="${total}" style="background: conic-gradient(${stops})"></div>
      </div>
      <div class="legend-list">${legend}</div>
    </div>
  `;
}

function buildSpoilageTrend(records) {
  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: 8 }, (_, index) => ({
    label: index === 7 ? "This week" : `${7 - index}w ago`,
    sent: 0,
    spoiled: 0
  }));

  records.forEach((record) => {
    const rawDate = record.detected_at || record.recorded_at || record.changed_at || record.created_at;
    const date = rawDate ? new Date(rawDate) : null;
    if (!date || Number.isNaN(date.getTime())) return;

    const weeksAgo = Math.min(7, Math.floor((now - date) / weekMs));
    const bucket = buckets[7 - weeksAgo];
    bucket.sent += toNumber(record.qty_sent ?? record.qty_received ?? 1);
    bucket.spoiled += toNumber(record.qty_spoiled ?? record.loss_amount ?? 0);
  });

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: bucket.sent ? (bucket.spoiled / bucket.sent) * 100 : 0
  }));
}

function buildMonthlyOrderSeries(orderRows) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const bucketSize = Math.max(1, Math.ceil(daysInMonth / 15));
  const bucketCount = Math.ceil(daysInMonth / bucketSize);

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    label: String(index * bucketSize + 1),
    value: 0
  }));

  orderRows.forEach((order) => {
    const rawDate = order.ordered_at || order.created_at || order.inserted_at;
    const date = rawDate ? new Date(rawDate) : null;
    if (!date || Number.isNaN(date.getTime()) || date < monthStart) return;

    const day = date.getDate();
    const index = Math.min(bucketCount - 1, Math.floor((day - 1) / bucketSize));
    buckets[index].value += 1;
  });

  return buckets;
}

function buildStockLevels(productsList) {
  const categoryMap = new Map();

  productsList.forEach((product) => {
    const category = String(product.category || "Other").trim();
    const current = categoryMap.get(category) || { stock: 0, label: category };
    current.stock += toNumber(product.stock_quantity || 0);
    categoryMap.set(category, current);
  });

  const categoryOrder = ["Grain", "Vegetable", "Vegetables", "Fruit", "Fruits", "Fish", "Dairy", "Meat"];
  const rows = [...categoryMap.values()].sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a.label);
    const bIndex = categoryOrder.indexOf(b.label);
    if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    return b.stock - a.stock;
  });

  const top = rows.slice(0, 5);
  const maxStock = Math.max(1, ...top.map((item) => item.stock));
  const labelMap = {
    Grain: "Grain",
    Vegetable: "Vegetables",
    Vegetables: "Vegetables",
    Fruit: "Fruits",
    Fruits: "Fruits",
    Fish: "Fish",
    Dairy: "Dairy",
    Meat: "Meat",
    Other: "Other"
  };

  return top.map((item) => ({
    label: labelMap[item.label] || item.label,
    stock: item.stock,
    percent: Math.round((item.stock / maxStock) * 100)
  }));
}

function buildShipmentBreakdown(shipmentRows) {
  const counts = new Map([
    ["Delivered", 0],
    ["In Transit", 0],
    ["Pending", 0],
    ["Delayed", 0],
    ["Spoiled", 0]
  ]);

  shipmentRows.forEach((shipment) => {
    const bucket = groupShipmentStatus(shipment.status);
    counts.set(bucket, (counts.get(bucket) || 0) + 1);
  });

  const palette = {
    Delivered: "#16a34a",
    "In Transit": "#3b82f6",
    Pending: "#f59e0b",
    Delayed: "#ef4444",
    Spoiled: "#f97316"
  };

  return [...counts.entries()].map(([label, value]) => ({
    label,
    value,
    percent: Math.round((value / Math.max(1, shipmentRows.length)) * 100),
    color: palette[label]
  }));
}

function buildTopFarmers(farmerRows, orderRows, shipmentRows) {
  const counts = new Map();

  const bump = (keys) => {
    keys.filter(Boolean).forEach((key) => {
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  };

  const pickCount = (keys) => {
    for (const key of keys.filter(Boolean)) {
      if (counts.has(key)) return counts.get(key);
    }
    return 0;
  };

  orderRows.forEach((order) => {
    (order.order_item || []).forEach((item) => {
      bump([
        item.farmer_id,
        item.farmer?.farmer_id,
        item.farmer?.name,
        item.farmer?.name?.trim().toLowerCase()
      ]);
    });
  });

  if (!counts.size) {
    shipmentRows.forEach((shipment) => {
      bump([
        shipment.farmer_id,
        shipment.farmer?.farmer_id,
        shipment.farmer?.name,
        shipment.farmer?.name?.trim().toLowerCase()
      ]);
    });
  }

  return farmerRows
    .map((farmer) => ({
      farmer,
      orders: pickCount([
        farmer.farmer_id,
        farmer.name,
        farmer.name?.trim().toLowerCase()
      ])
    }))
    .sort((a, b) => b.orders - a.orders || toNumber(b.farmer.rating) - toNumber(a.farmer.rating))
    .slice(0, 5);
}

function buildColdChainCards(monitoringRows, fallbackShipments = []) {
  const rows = (monitoringRows && monitoringRows.length ? monitoringRows : fallbackShipments)
    .slice()
    .sort((a, b) => {
      const aScore = Number(Boolean(a.is_temp_breach || a.is_overloaded)) + toNumber(a.load_ratio || 0) * 0.01;
      const bScore = Number(Boolean(b.is_temp_breach || b.is_overloaded)) + toNumber(b.load_ratio || 0) * 0.01;
      return bScore - aScore;
    })
    .slice(0, 4);

  return rows.map((row) => {
    const shipment = row.shipment || row;
    const source = shipment.source_district?.name || shipment.source_district || shipment.farmer?.district?.name || "-";
    const destination = shipment.dest_district?.name || shipment.dest_district || "-";
    const product = shipment.product?.name || shipment.product_name || "Shipment";
    const farmer = shipment.farmer?.name || shipment.farmer_name || "-";
    const route = `${source} -> ${destination}`;
    const temp = row.internal_temp != null
      ? `+${toNumber(row.internal_temp).toFixed(1)}C`
      : row.ambient_temp != null
        ? `+${toNumber(row.ambient_temp).toFixed(1)}C`
        : "-";
    const isBreached = Boolean(row.is_temp_breach || row.is_overloaded || row.status === "DELAYED");
    const statusLabel = row.is_temp_breach || row.is_overloaded ? "Breach" : (row.status || "OK").replace(/_/g, " ");
    const riskText = row.is_temp_breach || row.is_overloaded
      ? `Heat load ${toNumber(row.load_ratio || 0).toFixed(2)}x of capacity`
      : row.status === "DELAYED"
        ? "Delayed in transit"
        : "Temperature within target range";

    return {
      code: `#${String(shipment.shipment_id || row.shipment_id || " - ").slice(-4)}`,
      temp,
      product,
      route,
      farmer,
      statusLabel,
      statusClass: isBreached ? "danger" : "success",
      riskText
    };
  });
}

function filterTable(id, q) {
  document.querySelectorAll(`#${id} tbody tr`).forEach((r) => {
    r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase())
      ? ""
      : "none";
  });
}

function fillSelect(id, items, valKey, labelFn, empty = false) {
  const el = document.getElementById(id);
  if (!el) return;

  el.innerHTML = empty ? "<option value=''> -  Select  - </option>" : "";

  items.forEach((item, index) => {
    const o = document.createElement("option");
    o.value = item[valKey];
    o.textContent = typeof labelFn === "function" ? labelFn(item) : item[labelFn];
    el.appendChild(o);
  });
}

function fillStatusSelect(id, statuses, current = "") {
  const el = document.getElementById(id);
  if (!el) return;

  el.innerHTML = "";

  statuses.forEach((s) => {
    const o = document.createElement("option");
    o.value = s;
    o.textContent = s.replace(/_/g, " ");
    if (s === current) o.selected = true;
    el.appendChild(o);
  });
}

/* Navigation */
const PAGES = {
  "#dashboard": { el: "page-dashboard", load: loadDashboard },
  "#orders": { el: "page-orders", load: loadOrders },
  "#shipments": { el: "page-shipments", load: loadShipments },
  "#farmers": { el: "page-farmers", load: loadFarmers },
  "#products": { el: "page-products", load: loadProducts },
  "#warehouses": { el: "page-warehouses", load: loadWarehouses },
  "#vehicles": { el: "page-vehicles", load: loadVehicles },
  "#monitoring": { el: "page-monitoring", load: loadMonitoring },
  "#weather": { el: "page-weather", load: loadWeather },
  "#spoilage": { el: "page-spoilage", load: loadSpoilage },
  "#provenance": { el: "page-provenance", load: loadProvenance },
  "#price-audit": { el: "page-price-audit", load: loadPriceAudit }
};

function navigate(hash) {
  const page = PAGES[hash] || PAGES["#dashboard"];

  document.querySelectorAll(".page").forEach((p) => {
    p.style.display = "none";
  });

  document.getElementById(page.el).style.display = "block";

  document.querySelectorAll(".nav-link").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === hash);
  });

  page.load();
}

document.querySelectorAll(".nav-link").forEach((a) =>
  a.addEventListener("click", (e) => {
    e.preventDefault();
    location.hash = a.getAttribute("href");
  })
);

window.addEventListener("hashchange", () => navigate(location.hash));

function openModal(name) {
  ({
    farmer: openFarmerModal,
    product: openProductModal,
    warehouse: openWarehouseModal,
    vehicle: openVehicleModal,
    shipment: openShipmentModal,
    weather: openWeatherModal,
    order: openOrderModal,
    spoilage: openSpoilageModal,
    sensor: openSensorModal
  })[name]?.();
}

function closeModal(name) {
  document.getElementById(`modal-${name}`)?.classList.remove("open");
}

document.querySelectorAll(".modal-overlay").forEach((m) =>
  m.addEventListener("click", (e) => {
    if (e.target === m) m.classList.remove("open");
  })
);

/* Dashboard */
async function loadDashboard() {
  const root = document.getElementById("dashboard-root");

  if (!root) return;

  root.innerHTML = '<div class="loader dashboard-loader"><div class="spinner"></div></div>';

  try {
    const [summary, orderRows, spoilageRows, monitoringRows] = await Promise.all([
      api("/api/dashboard"),
      api("/api/orders"),
      api("/api/spoilage"),
      api("/api/monitoring")
    ]);

    const activeShipmentRows = (shipments || [])
      .filter((shipment) => ["PENDING", "IN_TRANSIT", "IN_WAREHOUSE", "DELAYED"].includes(shipment.status))
      .sort((a, b) => new Date(a.estimated_arrival || a.start_time || 0) - new Date(b.estimated_arrival || b.start_time || 0));
    const totalShipmentRows = shipments || [];
    const dashboardUser = getDashboardUser();
    const currentDate = formatShortDate(new Date());
    const revenueThisMonth = orderRows.reduce((sum, order) => {
      const orderedAt = order.ordered_at || order.created_at || order.inserted_at;
      const orderDate = orderedAt ? new Date(orderedAt) : null;
      if (!orderDate || Number.isNaN(orderDate.getTime())) return sum;
      if (orderDate.getMonth() !== new Date().getMonth() || orderDate.getFullYear() !== new Date().getFullYear()) return sum;

      const itemTotal = (order.order_item || []).reduce((itemSum, item) => {
        const totalPrice = toNumber(item.total_price);
        if (totalPrice) return itemSum + totalPrice;
        return itemSum + toNumber(item.quantity) * toNumber(item.agreed_price_per_unit);
      }, 0);

      return sum + (itemTotal || toNumber(order.agreed_total));
    }, 0);
    const spoilageRate = summary.total_shipments ? (toNumber(summary.spoiled_shipments) / toNumber(summary.total_shipments)) * 100 : 0;
    const breachCount = monitoringRows.filter((row) => row.is_temp_breach || row.is_overloaded).length || toNumber(summary.critical_events_24h);
    const trendSeries = buildSpoilageTrend(spoilageRows);
    const orderSeries = buildMonthlyOrderSeries(orderRows);
    const stockSeries = buildStockLevels(products || []);
    const shipmentSeries = buildShipmentBreakdown(totalShipmentRows);
    const farmerLeaderboard = buildTopFarmers(farmers || [], orderRows, totalShipmentRows);
    const coldChainCards = buildColdChainCards(monitoringRows, activeShipmentRows);
    const activeShipmentCount = summary.active_shipments ?? activeShipmentRows.length;

    dashboardState = {
      summary,
      activeShipmentRows,
      totalShipmentRows,
      spoilageRate,
      breachCount,
      revenueThisMonth,
      stockSeries,
      orderRows,
      shipmentSeries,
      coldChainCards
    };

    const metricCards = [
      {
        tone: "red",
        label: "Spoilage Rate",
        pill: "High Risk",
        value: `${spoilageRate.toFixed(1)}%`,
        note: `${toNumber(summary.spoiled_shipments)} spoiled shipments out of ${toNumber(summary.total_shipments)} total`
      },
      {
        tone: "red",
        label: "Cold Chain Breaches",
        pill: `${breachCount} live`,
        value: compactNumber(breachCount),
        note: `${toNumber(summary.critical_events_24h)} critical events in the last 24h`
      },
      {
        tone: "green",
        label: "Active Shipments",
        pill: "In Transit",
        value: compactNumber(activeShipmentCount),
        note: `${toNumber(summary.delayed_shipments)} delayed shipments are under watch`
      },
      {
        tone: "green",
        label: "Revenue (This Month)",
        pill: "Live Orders",
        value: bdt(revenueThisMonth),
        note: `${toNumber(orderRows.length)} orders captured from the current month`
      }
    ];

    const topFarmersRows = farmerLeaderboard
      .map(({ farmer, orders }) => {
        const district = farmer.district?.name || farmer.district || " - ";
        return `
          <tr class="dashboard-searchable">
            <td><strong>${farmer.name}</strong></td>
            <td class="td-muted">${district}</td>
            <td><span class="status-chip ${toNumber(farmer.rating) >= 4.6 ? "success" : toNumber(farmer.rating) >= 4.2 ? "info" : "warning"}">${toNumber(farmer.rating || 0).toFixed(1)}</span></td>
            <td><strong>${orders}</strong></td>
          </tr>
        `;
      })
      .join("") || `<tr><td colspan="4"><div class="dashboard-empty">No farmer activity yet.</div></td></tr>`;

    const activeShipmentRowsHtml = activeShipmentRows
      .slice(0, 5)
      .map((shipment) => {
        const route = formatRoute(
          shipment.source_district?.name || shipment.source_district || "-",
          shipment.dest_district?.name || shipment.dest_district || "-"
        );
        const riskLabel = shipment.status === "DELAYED" ? "High" : shipment.status === "IN_TRANSIT" ? "Medium" : "Low";
        const riskClass = shipment.status === "DELAYED" ? "danger" : shipment.status === "IN_TRANSIT" ? "warning" : "success";
        const eta = shipment.actual_arrival ? fmtDT(shipment.actual_arrival) : shipment.estimated_arrival ? `Est. ${fmtDT(shipment.estimated_arrival)}` : " - ";

        return `
          <tr class="dashboard-searchable">
            <td><strong>${shipment.product?.name || " - "}</strong><div class="td-muted">${shipment.product?.category || ""}</div></td>
            <td>${shipment.farmer?.name || " - "}<div class="td-muted">${shipment.farmer?.district?.name || ""}</div></td>
            <td>${route}</td>
            <td>${toNumber(shipment.quantity)} ${shipment.product?.unit || "kg"}</td>
            <td>${badge(shipment.status)}</td>
            <td><span class="status-chip ${riskClass}">${riskLabel}</span></td>
            <td class="td-muted">${eta}</td>
          </tr>
        `;
      })
      .join("") || `<tr><td colspan="7"><div class="dashboard-empty">No active shipments right now.</div></td></tr>`;

    const stockRowsHtml = stockSeries
      .map((item) => {
        return `
          <div class="dashboard-searchable" style="display:grid;gap:8px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:#0f172a;font-weight:700;">
              <span>${item.label}</span>
              <span style="color:#64748b;font-weight:600;">${item.percent}%</span>
            </div>
            <div class="progress" style="height:8px;background:#e2e8f0;">
              <div class="progress-bar" style="width:${item.percent}%;background:linear-gradient(90deg,#a855f7 0%,#16a34a 100%);"></div>
            </div>
            <div class="td-muted">${compactNumber(item.stock)} units in stock</div>
          </div>
        `;
      })
      .join("") || `<div class="dashboard-empty">No stock data available.</div>`;

    const dashboardHtml = `
      <div class="dashboard-topbar">
        <label class="dashboard-search" aria-label="Search dashboard">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input id="dashboard-search" type="search" placeholder="Search shipments, orders, products..." oninput="filterDashboard(this.value)" />
        </label>
        <div class="dashboard-topbar-actions">
          <button class="topbar-icon" type="button" aria-label="Notifications" onclick="toggleDashboardPanel('notifications')">
            <i class="fa-regular fa-bell"></i>
          </button>
          <div class="date-chip" id="dashboard-date">${currentDate}</div>
          <div class="profile-chip">
            <div class="profile-avatar">${dashboardInitials(dashboardUser)}</div>
            <div class="profile-copy">
              <span class="profile-name" id="dashboard-user-name">${dashboardFullName(dashboardUser)}</span>
              <span class="profile-role" id="dashboard-user-role">${dashboardRole()}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard-hero">
        <div>
          <div class="dashboard-eyebrow">Dashboard</div>
          <h1>Overview of your supply chain operations</h1>
          <p>Live shipment flow, cold-chain risk, stock levels, and order activity pulled from your project data.</p>
        </div>
      </div>

      <div class="dashboard-metrics">
        ${metricCards
          .map(
            (metric) => `
              <div class="dashboard-section metric-card metric-${metric.tone}">
                <div class="metric-label">
                  <span>${metric.label}</span>
                  <span class="metric-pill">${metric.pill}</span>
                </div>
                <div class="metric-value">${metric.value}</div>
                <div class="metric-note">${metric.note}</div>
              </div>
            `
          )
          .join("")}
      </div>

      <div class="dashboard-grid">
        <section class="dashboard-section dashboard-panel dashboard-span-7">
          <div class="panel-head">
            <div class="panel-title">
              <div>
                <h2>Spoilage Trend (Weekly)</h2>
                <p>Rate of spoiled produce over the last 8 weeks.</p>
              </div>
            </div>
          </div>
          ${renderLineChart(trendSeries, { color: "#ef4444" })}
        </section>

        <section class="dashboard-section dashboard-panel dashboard-span-5">
          <div class="panel-head">
            <div class="panel-title">
              <div>
                <h2>Cold Chain Status</h2>
                <p>${breachCount} active breaches or overload risks.</p>
              </div>
            </div>
            <span class="panel-badge red">${breachCount} Breaches</span>
          </div>
          <div class="cold-grid">
            ${coldChainCards
              .map(
                (card) => `
                  <div class="cold-card dashboard-searchable">
                    <div class="cold-head">
                      <div class="cold-code">${card.code}</div>
                      <span class="status-chip ${card.statusClass}">${card.statusLabel}</span>
                    </div>
                    <div class="cold-temp">${card.temp}</div>
                    <div class="cold-route">${card.route} | ${card.product}</div>
                    <div class="cold-foot">${card.farmer}</div>
                    <div class="cold-foot">${card.riskText}</div>
                  </div>
                `
              )
              .join("") || `<div class="dashboard-empty" style="grid-column:1/-1;">No cold-chain telemetry yet.</div>`}
          </div>
        </section>

        <section class="dashboard-section dashboard-panel dashboard-span-7 table-shell">
          <div class="panel-head">
            <div class="panel-title">
              <div>
                <h2>Active Shipments</h2>
                <p>Current in-transit and delayed shipments.</p>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" type="button" onclick="location.hash='#shipments'">View All</button>
          </div>
          <div class="table-wrapper">
            <table class="dashboard-table" id="dashboard-active-shipments">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Farmer</th>
                  <th>Route</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Arrival</th>
                </tr>
              </thead>
              <tbody>${activeShipmentRowsHtml}</tbody>
            </table>
          </div>
        </section>

        <section class="dashboard-section dashboard-panel dashboard-span-5">
          <div class="panel-head">
            <div class="panel-title">
              <div>
                <h2>Stock Level</h2>
                <p>Category-level inventory pressure.</p>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" type="button" onclick="location.hash='#products'">View All</button>
          </div>
          ${stockRowsHtml}
        </section>

        <section class="dashboard-section dashboard-panel dashboard-span-4">
          <div class="panel-head">
            <div class="panel-title">
              <div>
                <h2>Orders (This Month)</h2>
                <p>Order volume by day bucket.</p>
              </div>
            </div>
          </div>
          ${renderBarChart(orderSeries, { color: "#16a34a" })}
        </section>

        <section class="dashboard-section dashboard-panel dashboard-span-4">
          <div class="panel-head">
            <div class="panel-title">
              <div>
                <h2>Shipment Breakdown</h2>
                <p>Status mix across all shipments.</p>
              </div>
            </div>
          </div>
          ${renderDonutChart(shipmentSeries)}
        </section>

        <section class="dashboard-section dashboard-panel dashboard-span-4 table-shell">
          <div class="panel-head">
            <div class="panel-title">
              <div>
                <h2>Top Farmers</h2>
                <p>Most active supply partners.</p>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" type="button" onclick="location.hash='#farmers'">View All</button>
          </div>
          <div class="table-wrapper">
            <table class="dashboard-table">
              <thead>
                <tr>
                  <th>Farmer</th>
                  <th>District</th>
                  <th>Rating</th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>${topFarmersRows}</tbody>
            </table>
          </div>
        </section>
      </div>

      ${renderDashboardNotificationPanel()}
      ${renderDashboardAiPanel()}
    `;

    root.innerHTML = dashboardHtml;
    filterDashboard(document.getElementById("dashboard-search")?.value || "");
  } catch (e) {
    root.innerHTML = `<div class="dashboard-error">Error: ${e.message}</div>`;
  }
}

/* Orders */
let ordersUiInitialized = false;
let ordersViewAllRows = false;

function getOrderPrimaryItem(order) {
  const items = order.order_item || order.items || [];
  return items[0] || null;
}

function getOrderDistrict(order) {
  const item = getOrderPrimaryItem(order);
  return item?.source_district?.name || item?.farmer?.district?.name || "Unknown";
}

function getOrderDistricts(order) {
  const items = order.order_item || order.items || [];
  const names = items
    .map((item) => item?.source_district?.name || item?.farmer?.district?.name || "")
    .filter(Boolean);
  return Array.from(new Set(names));
}

function getOrderShipmentStatuses(order) {
  const items = order.order_item || order.items || [];
  const seen = new Set();
  const statuses = [];

  items.forEach((item) => {
    const shipmentId = item?.shipment?.shipment_id || item?.shipment_id;
    const shipmentStatus = item?.shipment?.status;
    if (!shipmentStatus) return;

    const key = shipmentId || `${item?.item_id || index}-${shipmentStatus}`;
    if (seen.has(key)) return;
    seen.add(key);
    statuses.push(shipmentStatus);
  });

  return statuses;
}

function getOrderTempTone(order) {
  const shipmentStatuses = getOrderShipmentStatuses(order);

  if (shipmentStatuses.some((status) => ["DELAYED", "SPOILED", "CANCELLED"].includes(status))) {
    return { label: "Breach", className: "danger" };
  }

  if (shipmentStatuses.some((status) => ["PENDING", "IN_TRANSIT", "IN_WAREHOUSE"].includes(status))) {
    return { label: "Watch", className: "warning" };
  }

  return { label: "Normal", className: "success" };
}

function getOrderProgress(order) {
  const status = order.order_status || "PLACED";
  const map = {
    PLACED: 10,
    CONFIRMED: 30,
    IN_TRANSIT: 60,
    DELAYED: 45,
    PARTIALLY_DELIVERED: 80,
    DELIVERED: 100,
    CANCELLED: 0,
    RETURNED: 0
  };
  return map[status] ?? 20;
}

function initOrdersUi() {
  if (ordersUiInitialized) return;

  const searchInput = document.getElementById("orders-search-input");
  const statusFilter = document.getElementById("orders-status-filter");
  const districtFilter = document.getElementById("orders-district-filter");
  const dateFilter = document.getElementById("orders-date-filter");
  const applyBtn = document.getElementById("orders-apply-filter-btn");
  const viewAllLink = document.getElementById("orders-view-all-link");

  [searchInput, statusFilter, districtFilter, dateFilter].forEach((el) => {
    el?.addEventListener("input", () => {
      ordersViewAllRows = false;
      renderOrdersTable();
    });
    el?.addEventListener("change", () => {
      ordersViewAllRows = false;
      renderOrdersTable();
    });
  });

  applyBtn?.addEventListener("click", () => {
    ordersViewAllRows = false;
    renderOrdersTable();
  });

  viewAllLink?.addEventListener("click", (event) => {
    event.preventDefault();
    ordersViewAllRows = true;
    renderOrdersTable();
  });

  ordersUiInitialized = true;
}

function populateOrdersDistrictFilter() {
  const districtFilter = document.getElementById("orders-district-filter");
  if (!districtFilter) return;

  const previousValue = districtFilter.value;
  const districtsSet = new Set();
  (districts || []).forEach((district) => {
    const name = district?.name;
    if (name) districtsSet.add(name);
  });

  orders.forEach((order) => {
    getOrderDistricts(order).forEach((name) => {
      if (name && name !== "Unknown") districtsSet.add(name);
    });
  });

  const options = Array.from(districtsSet)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");

  districtFilter.innerHTML = `<option value="">All Districts</option>${options}`;
  if (previousValue && districtsSet.has(previousValue)) districtFilter.value = previousValue;
}

function getFilteredOrders() {
  const q = (document.getElementById("orders-search-input")?.value || "").trim().toLowerCase();
  const status = document.getElementById("orders-status-filter")?.value || "";
  const district = document.getElementById("orders-district-filter")?.value || "";
  const days = Number(document.getElementById("orders-date-filter")?.value || 0);

  const cutoffTime = days > 0 ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;

  return orders.filter((order) => {
    const items = order.order_item || order.items || [];
    const orderDate = new Date(order.ordered_at || 0).getTime();

    const inSearch =
      !q ||
      String(order.order_id || "").toLowerCase().includes(q) ||
      items.some((item) => {
        const productName = item?.product?.name || "";
        const farmerName = item?.farmer?.name || "";
        return productName.toLowerCase().includes(q) || farmerName.toLowerCase().includes(q);
      });

    const inStatus = !status || order.order_status === status;
    const inDistrict = !district || getOrderDistricts(order).includes(district);
    const inDate = !cutoffTime || (orderDate && orderDate >= cutoffTime);

    return inSearch && inStatus && inDistrict && inDate;
  });
}

function renderOrdersSummary(filteredOrders) {
  const total = filteredOrders.length;
  const inTransit = filteredOrders.reduce((count, order) => {
    const statuses = getOrderShipmentStatuses(order);
    if (statuses.length) return count + statuses.filter((status) => ["IN_TRANSIT", "IN_WAREHOUSE", "PENDING"].includes(status)).length;
    return count + (order.order_status === "IN_TRANSIT" ? 1 : 0);
  }, 0);
  const delivered = filteredOrders.reduce((count, order) => {
    const statuses = getOrderShipmentStatuses(order);
    if (statuses.length) return count + statuses.filter((status) => ["DELIVERED", "PARTIALLY_DELIVERED"].includes(status)).length;
    return count + (["DELIVERED", "PARTIALLY_DELIVERED"].includes(order.order_status) ? 1 : 0);
  }, 0);
  const delayed = filteredOrders.reduce((count, order) => {
    const statuses = getOrderShipmentStatuses(order);
    if (statuses.length) return count + statuses.filter((status) => status === "DELAYED").length;
    return count + (order.order_status === "DELAYED" ? 1 : 0);
  }, 0);

  document.getElementById("orders-total-count").textContent = String(total);
  document.getElementById("orders-intransit-count").textContent = String(inTransit);
  document.getElementById("orders-delivered-count").textContent = String(delivered);
  document.getElementById("orders-delayed-count").textContent = String(delayed);
}

function renderOrderDetailsRow(order) {
  const items = order.order_item || order.items || [];

  const itemRows = items
    .map((item) => {
      const productName = item?.product?.name || "?";
      const farmerName = item?.farmer?.name || "-";
      const districtName = item?.source_district?.name || "-";
      const unit = item?.product?.unit || "kg";
      const quantity = Number(item?.quantity || 0);
      const price = Number(item?.agreed_price_per_unit || 0);
      const subtotal = Number(item?.total_price) || quantity * price;

      return `
        <tr>
          <td>${escapeHtml(productName)}</td>
          <td>${escapeHtml(farmerName)}</td>
          <td>${escapeHtml(districtName)}</td>
          <td>${quantity} ${escapeHtml(unit.toLowerCase())}</td>
          <td>${bdt(price)}</td>
          <td>${bdt(subtotal)}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteOrderItem('${order.order_id}','${item.item_id}')">${faIcon("fa-trash-can")}</button>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <tr class="orders-detail-row" id="order-detail-${order.order_id}" style="display:none">
      <td colspan="9">
        <div class="orders-detail-box">
          <div class="orders-detail-head">
            <div>
              <strong>Order ${escapeHtml((order.order_id || "").slice(0, 8))}</strong>
              <span class="td-muted">${fmtDT(order.ordered_at)}</span>
              ${order.notes ? `<span class="td-muted">${escapeHtml(order.notes)}</span>` : ""}
            </div>
            <div class="orders-detail-actions">
              <span style="cursor:pointer" onclick="openOrderStatusModal('${order.order_id}','${order.order_status}')">${badge(order.order_status)}</span>
              <button class="btn btn-primary btn-sm" onclick="openOrderItemModal('${order.order_id}')">+ Add Item</button>
            </div>
          </div>
          <div class="table-wrapper">
            <table class="orders-detail-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Farmer</th>
                  <th>District</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${itemRows || `<tr><td colspan="7" class="td-muted" style="text-align:center">No items added yet.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function renderOrdersTable() {
  const list = document.getElementById("order-list");
  if (!list) return;

  const filteredOrders = getFilteredOrders();
  renderOrdersSummary(filteredOrders);

  if (!filteredOrders.length) {
    list.innerHTML = emptyState("fa-cart-shopping", "No orders found for this filter.");
    return;
  }

  const visibleOrders = ordersViewAllRows ? filteredOrders : filteredOrders.slice(0, 8);

  const rowsHtml = visibleOrders
    .map((order) => {
      const item = getOrderPrimaryItem(order);
      const product = item?.product?.name || "-";
      const farmer = item?.farmer?.name || "-";
      const districtList = getOrderDistricts(order);
      const district = districtList.length ? districtList.join(", ") : "Unknown";
      const quantity = Number(item?.quantity || 0);
      const unit = (item?.product?.unit || "kg").toLowerCase();
      const progress = getOrderProgress(order);
      const temp = getOrderTempTone(order);
      const toneClass = temp.className;
      const progressClass = progress < 20 ? "red" : progress < 60 ? "yellow" : "";

      return `
        <tr>
          <td>
            <div class="orders-order-id">#${escapeHtml((order.order_id || "").slice(0, 8).toUpperCase())}</div>
            <div class="td-muted">${fmtDate(order.ordered_at)}</div>
          </td>
          <td>
            <strong>${escapeHtml(farmer)}</strong>
            <div class="td-muted">${escapeHtml(district)}</div>
          </td>
          <td>
            <strong>${escapeHtml(product)}</strong>
            <div class="td-muted">${quantity} ${escapeHtml(unit)}</div>
          </td>
          <td>
            <span style="cursor:pointer" onclick="openOrderStatusModal('${order.order_id}','${order.order_status}')">${badge(order.order_status)}</span>
          </td>
          <td>
            <span class="orders-temp-badge ${toneClass}">${temp.label}</span>
          </td>
          <td>
            <div class="orders-progress-meta">${progress}%</div>
            <div class="progress"><div class="progress-bar ${progressClass}" style="width:${progress}%"></div></div>
          </td>
          <td>
            <div class="orders-action-stack">
              <button class="btn btn-primary btn-sm" onclick="openOrderItemModal('${order.order_id}')">+ Add Item</button>
              <button class="btn btn-secondary btn-sm" onclick="toggleOrderDetail('${order.order_id}')"><i class="fas fa-eye"></i> View</button>
              <button class="btn btn-secondary btn-sm" onclick="location.hash='#shipments'"><i class="fas fa-location-arrow"></i> Track</button>
            </div>
          </td>
        </tr>
        ${renderOrderDetailsRow(order)}
      `;
    })
    .join("");

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="orders-main-table" id="orders-main-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Farmer</th>
            <th>Product</th>
            <th>Status</th>
            <th>Temp Status</th>
            <th>Progress</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

function toggleOrderDetail(orderId) {
  const row = document.getElementById(`order-detail-${orderId}`);
  if (!row) return;
  row.style.display = row.style.display === "none" ? "table-row" : "none";
}

window.toggleOrderDetail = toggleOrderDetail;

async function loadOrders() {
  const list = document.getElementById("order-list");
  if (!list) return;

  list.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    orders = await api("/api/orders");
    initOrdersUi();
    populateOrdersDistrictFilter();
    renderOrdersTable();
  } catch (e) {
    list.innerHTML = `<p style="color:var(--red)">Error: ${e.message}</p>`;
  }
}

function openOrderModal() {
  document.getElementById("order-date").value = toLocalDT(new Date().toISOString());
  fillStatusSelect("order-status-new", ORDER_STATUSES, "PLACED");
  document.getElementById("order-notes").value = "";
  document.getElementById("modal-order").classList.add("open");
}

async function saveOrder() {
  const dateValue = document.getElementById("order-date").value;

  const body = {
    notes: document.getElementById("order-notes").value.trim(),
    order_status: document.getElementById("order-status-new").value,
    ordered_at: dateValue ? new Date(dateValue).toISOString() : new Date().toISOString()
  };

  try {
    await api("/api/orders", { method: "POST", body });
    toast("Order created! Now add food items.");
    closeModal("order");
    loadOrders();
  } catch (e) {
    toast(e.message, "error");
  }
}

function openOrderStatusModal(id, cur) {
  document.getElementById("order-status-id").value = id;
  fillStatusSelect("order-status-value", ORDER_STATUSES, cur);
  document.getElementById("modal-order-status").classList.add("open");
}

async function saveOrderStatus() {
  const id = document.getElementById("order-status-id").value;
  const order_status = document.getElementById("order-status-value").value;

  try {
    await api(`/api/orders/${id}/status`, {
      method: "PATCH",
      body: { order_status }
    });
    toast("Updated!");
    closeModal("order-status");
    loadOrders();
  } catch (e) {
    toast(e.message, "error");
  }
}

function openOrderItemModal(orderId) {
  document.getElementById("order-item-order-id").value = orderId;

  fillSelect(
    "order-item-product",
    products,
    "product_id",
    (p) => `${p.name} (${p.category})  -  ${bdt(p.current_price)}`,
    true
  );

  fillSelect(
    "order-item-farmer",
    farmers,
    "farmer_id",
    (f) => `${f.name}  -  ${f.district?.name || ""}`,
    true
  );

  document.getElementById("order-item-qty").value = "";
  document.getElementById("order-item-price").value = "";

  document.getElementById("order-item-product").onchange = function () {
    const p = products.find((x) => x.product_id === this.value);
    if (p) {
      document.getElementById("order-item-price").value =
        p.current_price || p.purchase_price || "";
    }
  };

  document.getElementById("modal-order-item").classList.add("open");
}

async function saveOrderItem() {
  const orderId = document.getElementById("order-item-order-id").value;
  const product_id = document.getElementById("order-item-product").value;
  const farmer_id = document.getElementById("order-item-farmer").value;

  const body = {
    product_id,
    farmer_id,
    quantity: +document.getElementById("order-item-qty").value,
    agreed_price_per_unit: +document.getElementById("order-item-price").value
  };

  if (!body.product_id || !body.farmer_id || !body.quantity || !body.agreed_price_per_unit) {
    toast("Product, farmer, quantity, and price required", "error");
    return;
  }

  try {
    await api(`/api/orders/${orderId}/items`, {
      method: "POST",
      body
    });

    toast("Item added! Now create a shipment for it.");
    closeModal("order-item");
    loadOrders();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteOrderItem(orderId, itemId) {
  if (!confirm("Remove this item?")) return;

  try {
    await api(`/api/orders/${orderId}/items/${itemId}`, {
      method: "DELETE"
    });
    toast("Removed!");
    loadOrders();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* Shipments */
async function loadShipments() {
  loadActiveShipments();

  const tbody = document.getElementById("shipment-tbody");
  tbody.innerHTML =
    '<tr><td colspan="9"><div class="loader"><div class="spinner"></div></div></td></tr>';

  const status = document.getElementById("shipment-status-filter")?.value || "";

  try {
    shipments = await api(`/api/shipments${status ? "?status=" + status : ""}`);

    tbody.innerHTML = !shipments.length
      ? `<tr><td colspan="9">${emptyState("fa-truck-fast", "No shipments")}</td></tr>`
      : shipments
          .map(
            (s) => `<tr>
              <td><strong>${s.product?.name || "?"}</strong><div class="td-muted">${s.product?.category || ""}</div></td>
              <td>${s.farmer?.name || "?"}<div class="td-muted">${s.farmer?.district?.name || ""}</div></td>
              <td>${faIcon("fa-location-dot")} ${formatRoute(s.source_district?.name || "?", s.dest_district?.name || "?")}</td>
              <td>${s.quantity} ${s.product?.unit || "kg"}</td>
              <td>
                <span style="cursor:pointer" onclick="openStatusModal('${s.shipment_id}','${s.status}','${(s.product?.name || "").replace(/'/g, "")} from ${(s.farmer?.name || "").replace(/'/g, "")}')">
                  ${badge(s.status)}
                </span>
              </td>
              <td>${s.vehicle?.plate_no || '<span class="td-muted"> - </span>'}</td>
              <td class="td-muted">${fmtDT(s.start_time)}</td>
              <td class="td-muted">${s.actual_arrival ? fmtDT(s.actual_arrival) : s.estimated_arrival ? "Est: " + fmtDT(s.estimated_arrival) : " - "}</td>
              <td>${bdt(s.total_cost || 0)}</td>
            </tr>`
          )
          .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" style="color:var(--red)">Error: ${e.message}</td></tr>`;
  }
}

async function loadActiveShipments() {
  const tbody = document.getElementById("active-shipment-tbody");

  try {
    const active = await api("/api/shipments/active");

    if (!active.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="padding:16px;text-align:center;color:var(--gray-500)">No active shipments right now.</td></tr>';
      return;
    }

    const now = Date.now();

    tbody.innerHTML = active
      .map((s) => {
        const overdue = s.estimated_arrival && new Date(s.estimated_arrival) < now;

        return `<tr style="${overdue ? "background:#fff7ed" : ""}">
          <td><strong>${s.product?.name || "?"}</strong></td>
          <td>${s.farmer?.name || "?"}</td>
          <td>${faIcon("fa-location-dot")} ${formatRoute(s.source_district?.name || "?", s.dest_district?.name || "?")}</td>
          <td>${s.quantity} ${s.product?.unit || "kg"}</td>
          <td>${badge(s.status)}</td>
          <td>${s.vehicle?.plate_no || " - "}</td>
          <td class="${overdue ? "" : "td-muted"}" style="${overdue ? "color:var(--red);font-weight:600" : ""}">
            ${s.estimated_arrival ? fmtDT(s.estimated_arrival) : " - "}${overdue ? ` ${faIcon("fa-triangle-exclamation")} OVERDUE` : ""}
          </td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="openStatusModal('${s.shipment_id}','${s.status}','${(s.product?.name || "").replace(/'/g, "")} from ${(s.farmer?.name || "").replace(/'/g, "")}')">
              Update ->
            </button>
          </td>
        </tr>`;
      })
      .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--red)">${e.message}</td></tr>`;
  }
}

function openStatusModal(id, cur, info) {
  document.getElementById("shipment-status-id").value = id;
  fillStatusSelect("shipment-status-value", SHIP_STATUSES, cur);
  document.getElementById("shipment-status-info").innerHTML = `<strong>${info}</strong>`;
  document.getElementById("shipment-actual-arrival").value = toLocalDT(new Date().toISOString());
  document.getElementById("modal-shipment-status").classList.add("open");
}

async function saveShipmentStatus() {
  const id = document.getElementById("shipment-status-id").value;
  const status = document.getElementById("shipment-status-value").value;
  const arr = document.getElementById("shipment-actual-arrival").value;

  try {
    await api(`/api/shipments/${id}/status`, {
      method: "PATCH",
      body: {
        status,
        actual_arrival: arr ? new Date(arr).toISOString() : undefined
      }
    });

    toast(status === "DELIVERED" ? " Delivered! Stock updated & profit recorded by DB trigger." : "Status updated!");
    closeModal("shipment-status");
    loadShipments();
    vehicles = await api("/api/vehicles");
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
}

function openShipmentModal() {
  fillSelect("shipment-product", products, "product_id", (p) => `${p.name} (${p.category})`, true);
  fillSelect("shipment-farmer", farmers, "farmer_id", (f) => `${f.name}  -  ${f.district?.name || ""}`, true);
  fillSelect("shipment-src-district", districts, "district_id", (d) => d.name, true);
  fillSelect("shipment-dest-district", districts, "district_id", (d) => d.name, true);

  const avail = vehicles.filter((v) => v.is_operational && !v._busy);
  const vEl = document.getElementById("shipment-vehicle");
  vEl.innerHTML = '<option value="">None</option>';

  avail.forEach((v) => {
    const o = document.createElement("option");
    o.value = v.vehicle_id;
    o.textContent = `${v.plate_no} (${v.vehicle_type || "Truck"}, ${v.capacity_kg}kg)`;
    vEl.appendChild(o);
  });

  const wEl = document.getElementById("shipment-warehouse");
  wEl.innerHTML = '<option value="">None</option>';

  warehouses
    .filter((w) => w.is_active)
    .forEach((w) => {
      const o = document.createElement("option");
      o.value = w.warehouse_id;
      o.textContent = w.name;
      wEl.appendChild(o);
    });

  document.getElementById("shipment-start").value = toLocalDT(new Date().toISOString());

  ["shipment-arrival", "shipment-actual-arrival-new", "shipment-qty", "shipment-notes"].forEach((id) => {
    document.getElementById(id).value = "";
  });

  document.getElementById("shipment-cost").value = "0";
  fillStatusSelect("shipment-status-new", SHIP_STATUSES, "PENDING");

  document.getElementById("shipment-farmer").onchange = function () {
    const f = farmers.find((x) => x.farmer_id === this.value);
    if (f?.district_id) document.getElementById("shipment-src-district").value = f.district_id;
  };

  document.getElementById("modal-shipment").classList.add("open");
}

async function saveShipment() {
  const status = document.getElementById("shipment-status-new").value;

  const body = {
    product_id: document.getElementById("shipment-product").value,
    farmer_id: document.getElementById("shipment-farmer").value,
    source_district_id: document.getElementById("shipment-src-district").value,
    dest_district_id: document.getElementById("shipment-dest-district").value,
    vehicle_id: document.getElementById("shipment-vehicle").value || null,
    warehouse_id: document.getElementById("shipment-warehouse").value || null,
    quantity: +document.getElementById("shipment-qty").value,
    transport_cost: +document.getElementById("shipment-cost").value || 0,
    start_time: new Date(document.getElementById("shipment-start").value).toISOString(),
    estimated_arrival: document.getElementById("shipment-arrival").value
      ? new Date(document.getElementById("shipment-arrival").value).toISOString()
      : null,
    actual_arrival: document.getElementById("shipment-actual-arrival-new").value
      ? new Date(document.getElementById("shipment-actual-arrival-new").value).toISOString()
      : null,
    status,
    notes: document.getElementById("shipment-notes").value.trim()
  };

  if (!body.product_id || !body.farmer_id || !body.quantity) {
    toast("Product, farmer and quantity are required", "error");
    return;
  }

  try {
    await api("/api/shipments", { method: "POST", body });
    toast("Shipment created!");
    closeModal("shipment");
    loadShipments();
    vehicles = await api("/api/vehicles");
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
}

/* Farmers */
async function loadFarmers() {
  const tbody = document.getElementById("farmer-tbody");
  tbody.innerHTML = '<tr><td colspan="8"><div class="loader"><div class="spinner"></div></div></td></tr>';

  try {
    farmers = await api("/api/farmers");

    tbody.innerHTML = !farmers.length
      ? `<tr><td colspan="8">${emptyState("fa-people-group", "No farmers")}</td></tr>`
      : farmers
          .map(
            (f) => `<tr>
              <td><strong>${f.name}</strong></td>
              <td>${f.phone || '<span class="td-muted"> - </span>'}</td>
              <td>${f.district?.name || f.district_id}</td>
              <td>${f.village || '<span class="td-muted"> - </span>'}</td>
              <td>${f.land_size_acre ? f.land_size_acre + " ac" : '<span class="td-muted"> - </span>'}</td>
              <td>${faIcon("fa-star")} ${Number(f.rating || 5).toFixed(1)}</td>
              <td>${badge(f.is_active ? "Active" : "Inactive")}</td>
              <td class="td-actions">
                <button class="btn btn-ghost btn-sm" onclick='editFarmer(${JSON.stringify(f).replace(/'/g, "&#39;")})'>${faIcon("fa-pen-to-square")}</button>
                <button class="btn btn-danger btn-sm" onclick="deleteFarmer('${f.farmer_id}')">${faIcon("fa-trash-can")}</button>
              </td>
            </tr>`
          )
          .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--red)">Error: ${e.message}</td></tr>`;
  }
}

function openFarmerModal(f = null) {
  document.getElementById("farmer-modal-title").textContent = f ? "Edit Farmer" : "Add Farmer";
  document.getElementById("farmer-id").value = f?.farmer_id || "";
  document.getElementById("farmer-name").value = f?.name || "";
  document.getElementById("farmer-phone").value = f?.phone || "";

  fillSelect("farmer-district", districts, "district_id", (d) => d.name, true);

  if (f) document.getElementById("farmer-district").value = f.district_id;

  document.getElementById("farmer-village").value = f?.village || "";
  document.getElementById("farmer-land").value = f?.land_size_acre || "";
  document.getElementById("farmer-active").checked = f ? f.is_active : true;
  document.getElementById("modal-farmer").classList.add("open");
}

function editFarmer(f) {
  openFarmerModal(f);
}

async function saveFarmer() {
  const id = document.getElementById("farmer-id").value;

  const body = {
    name: document.getElementById("farmer-name").value.trim(),
    phone: document.getElementById("farmer-phone").value.trim(),
    district_id: document.getElementById("farmer-district").value,
    village: document.getElementById("farmer-village").value.trim(),
    land_size_acre: document.getElementById("farmer-land").value || null,
    is_active: document.getElementById("farmer-active").checked
  };

  if (!body.name || !body.district_id) {
    toast("Name and district required", "error");
    return;
  }

  try {
    if (id) {
      await api(`/api/farmers/${id}`, { method: "PUT", body });
    } else {
      await api("/api/farmers", { method: "POST", body });
    }

    toast(id ? "Updated!" : "Added!");
    closeModal("farmer");
    loadFarmers();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteFarmer(id) {
  if (!confirm("Delete?")) return;

  try {
    await api(`/api/farmers/${id}`, { method: "DELETE" });
    toast("Deleted!");
    loadFarmers();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* Products */
function getProductHealthStatus(product) {
  const stock = Number(product?.stock_quantity || 0);
  if (stock <= 0) return "OUT";
  if (stock <= 50) return "LOW";
  return "HEALTHY";
}

function getProductUiFilters() {
  return {
    query: (document.getElementById("product-search")?.value || "").trim().toLowerCase(),
    filterQuery: (document.getElementById("product-filter-search")?.value || "").trim().toLowerCase(),
    category: document.getElementById("product-category-filter")?.value || "",
    stockStatus: document.getElementById("product-stock-status-filter")?.value || "",
    minPrice: Number(document.getElementById("product-min-price")?.value || 0),
    maxPrice: Number(document.getElementById("product-max-price")?.value || 0),
    minStock: Number(document.getElementById("product-min-stock")?.value || 0),
    maxStock: Number(document.getElementById("product-max-stock")?.value || 0),
    sortBy: document.getElementById("product-sort-by")?.value || "LATEST"
  };
}

function applyProductFilters(allProducts, filters) {
  const filtered = allProducts.filter((product) => {
    const name = String(product?.name || "").toLowerCase();
    const category = String(product?.category || "").toLowerCase();
    const idText = String(product?.product_id || "").toLowerCase();
    const searchText = `${name} ${category} ${idText}`;
    const stock = Number(product?.stock_quantity || 0);
    const sellPrice = Number(product?.current_price || 0);
    const health = getProductHealthStatus(product);

    if (filters.query && !searchText.includes(filters.query)) return false;
    if (filters.filterQuery && !searchText.includes(filters.filterQuery)) return false;
    if (filters.category && product.category !== filters.category) return false;
    if (filters.stockStatus && health !== filters.stockStatus) return false;

    if (filters.minPrice && sellPrice < filters.minPrice) return false;
    if (filters.maxPrice && filters.maxPrice > 0 && sellPrice > filters.maxPrice) return false;
    if (filters.minStock && stock < filters.minStock) return false;
    if (filters.maxStock && filters.maxStock > 0 && stock > filters.maxStock) return false;

    return true;
  });

  filtered.sort((a, b) => {
    const sellA = Number(a.current_price || 0);
    const sellB = Number(b.current_price || 0);
    const stockA = Number(a.stock_quantity || 0);
    const stockB = Number(b.stock_quantity || 0);

    if (filters.sortBy === "PRICE_ASC") return sellA - sellB;
    if (filters.sortBy === "PRICE_DESC") return sellB - sellA;
    if (filters.sortBy === "STOCK_ASC") return stockA - stockB;
    if (filters.sortBy === "STOCK_DESC") return stockB - stockA;

    const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
    const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
    if (dateA && dateB) return dateB - dateA;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  return filtered;
}

function renderProductInsights(allProducts, filteredProducts, selectedCategory = "") {
  const total = allProducts.length;
  const lowStock = allProducts.filter((p) => getProductHealthStatus(p) === "LOW").length;
  const outOfStock = allProducts.filter((p) => getProductHealthStatus(p) === "OUT").length;
  const healthyStock = allProducts.filter((p) => getProductHealthStatus(p) === "HEALTHY").length;

  const avgMargin = allProducts.length
    ? allProducts.reduce((sum, p) => {
        const buy = Number(p.purchase_price || 0);
        const sell = Number(p.current_price || 0);
        if (!buy) return sum;
        return sum + ((sell - buy) / buy) * 100;
      }, 0) / allProducts.length
    : 0;

  document.getElementById("products-kpi-total").textContent = String(total);
  document.getElementById("products-kpi-low").textContent = String(lowStock);
  document.getElementById("products-kpi-out").textContent = String(outOfStock);
  document.getElementById("products-kpi-margin").textContent = `${avgMargin.toFixed(2)}%`;

  const pct = (value) => (total ? ((value / total) * 100).toFixed(1) : "0.0");
  document.getElementById("products-health-healthy").textContent = String(healthyStock);
  document.getElementById("products-health-low").textContent = String(lowStock);
  document.getElementById("products-health-out").textContent = String(outOfStock);
  document.getElementById("products-health-healthy-pct").textContent = pct(healthyStock);
  document.getElementById("products-health-low-pct").textContent = pct(lowStock);
  document.getElementById("products-health-out-pct").textContent = pct(outOfStock);

  const categories = ["Vegetable", "Fruit", "Fish", "Meat", "Dairy", "Grain"];
  const counts = categories.reduce((acc, cat) => {
    acc[cat] = allProducts.filter((p) => p.category === cat).length;
    return acc;
  }, {});

  const chips = [
    { key: "", label: "All Products", count: total },
    ...categories.map((cat) => ({ key: cat, label: cat, count: counts[cat] || 0 }))
  ];

  const strip = document.getElementById("products-category-strip");
  strip.innerHTML = chips
    .map(
      (chip) => `
        <button class="products-category-item ${selectedCategory === chip.key ? "active" : ""}" type="button" onclick="setProductCategoryFilter('${chip.key}')">
          <strong>${chip.label}</strong>
          <span>${chip.count}</span>
        </button>
      `
    )
    .join("");

  document.getElementById("products-table-title").textContent = `All Products (${filteredProducts.length})`;
}

function setProductCategoryFilter(category) {
  const select = document.getElementById("product-category-filter");
  if (!select) return;
  select.value = category || "";
  loadProducts();
}

function resetProductFilters() {
  const ids = [
    "product-filter-search",
    "product-search",
    "product-min-price",
    "product-max-price",
    "product-min-stock",
    "product-max-stock"
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const selectDefaults = {
    "product-category-filter": "",
    "product-stock-status-filter": "",
    "product-sort-by": "LATEST"
  };

  Object.entries(selectDefaults).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });

  loadProducts();
}

window.setProductCategoryFilter = setProductCategoryFilter;
window.resetProductFilters = resetProductFilters;

async function loadProducts() {
  const tbody = document.getElementById("product-tbody");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8"><div class="loader"><div class="spinner"></div></div></td></tr>';

  try {
    const allProducts = await api("/api/products");
    const filters = getProductUiFilters();
    products = applyProductFilters(allProducts, filters);

    renderProductInsights(allProducts, products, filters.category);

    tbody.innerHTML = !products.length
      ? `<tr><td colspan="8">${emptyState("fa-box-open", "No products")}</td></tr>`
      : products
          .map((p) => {
            const stock = Number(p.stock_quantity || 0);
            const health = getProductHealthStatus(p);
            const stockClass = health === "OUT" ? "out" : health === "LOW" ? "low" : "healthy";
            const statusLabel = health === "OUT" ? "Out of Stock" : health === "LOW" ? "Low Stock" : "Healthy";

            return `<tr>
              <td><strong>${p.name}</strong><div class="td-muted">${String(p.product_id || "").slice(0, 8)}</div></td>
              <td><span class="badge badge-blue">${p.category}</span></td>
              <td>${p.unit}</td>
              <td><span class="products-stock-number ${stockClass}">${stock}</span> ${p.unit}</td>
              <td>${bdt(p.purchase_price)}</td>
              <td><strong style="color:${p.current_price > p.purchase_price ? "var(--red)" : "var(--green)"}">${bdt(p.current_price)}</strong></td>
              <td><span class="products-status-pill ${stockClass}">${statusLabel}</span></td>
              <td class="td-actions">
                <button class="btn btn-ghost btn-sm" onclick='editProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})'>${faIcon("fa-pen-to-square")}</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.product_id}')">${faIcon("fa-trash-can")}</button>
              </td>
            </tr>`;
          })
          .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--red)">Error: ${e.message}</td></tr>`;
  }
}

function openProductModal(p = null) {
  document.getElementById("product-modal-title").textContent = p ? "Edit Product" : "Add Product";
  document.getElementById("product-id").value = p?.product_id || "";
  document.getElementById("product-name").value = p?.name || "";
  document.getElementById("product-category").value = p?.category || "Vegetable";
  document.getElementById("product-unit").value = p?.unit || "KG";
  document.getElementById("product-purchase-price").value = p?.purchase_price || "";
  document.getElementById("product-current-price").value = p?.current_price || "";
  document.getElementById("product-stock").value = p?.stock_quantity ?? 0;
  document.getElementById("product-shelf").value = p?.max_shelf_hours || "";
  document.getElementById("product-temp-min").value = p?.ideal_temp_min || "";
  document.getElementById("product-temp-max").value = p?.ideal_temp_max || "";

  if (document.getElementById("product-specific-heat")) {
    document.getElementById("product-specific-heat").value = p?.specific_heat || "";
  }

  document.getElementById("product-seasonal").checked = p?.is_seasonal || false;
  document.getElementById("product-active").checked = p ? p.is_active : true;
  document.getElementById("modal-product").classList.add("open");
}

function editProduct(p) {
  openProductModal(p);
}

async function saveProduct() {
  const id = document.getElementById("product-id").value;

  const body = {
    name: document.getElementById("product-name").value.trim(),
    category: document.getElementById("product-category").value,
    unit: document.getElementById("product-unit").value,
    purchase_price: +document.getElementById("product-purchase-price").value,
    current_price: +document.getElementById("product-current-price").value,
    stock_quantity: +document.getElementById("product-stock").value,
    max_shelf_hours: document.getElementById("product-shelf").value || null,
    ideal_temp_min: document.getElementById("product-temp-min").value || null,
    ideal_temp_max: document.getElementById("product-temp-max").value || null,
    specific_heat: document.getElementById("product-specific-heat")?.value || null,
    is_seasonal: document.getElementById("product-seasonal").checked,
    is_active: document.getElementById("product-active").checked
  };

  if (!body.name || !body.purchase_price || !body.current_price) {
    toast("Name and prices required", "error");
    return;
  }

  try {
    if (id) {
      await api(`/api/products/${id}`, { method: "PUT", body });
    } else {
      await api("/api/products", { method: "POST", body });
    }

    toast(id ? "Updated!" : "Added!");
    closeModal("product");
    loadProducts();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete?")) return;

  try {
    await api(`/api/products/${id}`, { method: "DELETE" });
    toast("Deleted!");
    loadProducts();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* Warehouses */
async function loadWarehouses() {
  const g = document.getElementById("wh-grid");
  g.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    warehouses = await api("/api/warehouses");

    if (!warehouses.length) {
      g.innerHTML = emptyState("fa-warehouse", "No warehouses");
      return;
    }

    g.innerHTML = warehouses
      .map((w) => {
        const pct = w.capacity_kg ? Math.round((w.current_load_kg / w.capacity_kg) * 100) : 0;
        const bc = pct > 95 ? "red" : pct > 85 ? "yellow" : "";

        return `<div class="wh-card">
          <div class="wh-card-header">
            <div>
              <div class="wh-name">${faIcon("fa-warehouse")} ${w.name}</div>
              <div class="wh-district">${faIcon("fa-location-dot")} ${w.district?.name || ""}</div>
            </div>
            <div style="display:flex;gap:4px">
              ${badge(w.is_active ? "Active" : "Inactive")}
              <button class="btn btn-ghost btn-sm" onclick='editWarehouse(${JSON.stringify(w).replace(/'/g, "&#39;")})'>${faIcon("fa-pen-to-square")}</button>
            </div>
          </div>

          <div class="wh-util-label">
            <span>Utilization</span>
            <strong style="color:${pct > 95 ? "var(--red)" : pct > 85 ? "var(--yellow)" : "inherit"}">${pct}%</strong>
          </div>

          <div class="progress">
            <div class="progress-bar ${bc}" style="width:${Math.min(100, pct)}%"></div>
          </div>

          <div class="wh-util-label td-muted" style="font-size:11px">
            <span>${(w.current_load_kg || 0).toLocaleString()} kg</span>
            <span>${(w.capacity_kg || 0).toLocaleString()} kg total</span>
          </div>

          <div class="wh-meta">
            <div class="wh-meta-label">Temp</div>
            <div class="wh-meta-value">${w.temp_min != null ? `${w.temp_min}°C-${w.temp_max}°C` : "Ambient"}</div>
            <div class="wh-meta-label">Rent/Day</div>
            <div class="wh-meta-value">${bdt(w.rent_per_day)}</div>
            <div class="wh-meta-label">Manager</div>
            <div class="wh-meta-value">${w.manager_name || " - "}</div>
            <div class="wh-meta-label">Phone</div>
            <div class="wh-meta-value">${w.manager_phone || " - "}</div>
          </div>
        </div>`;
      })
      .join("");
  } catch (e) {
    g.innerHTML = `<p style="color:var(--red)">Error: ${e.message}</p>`;
  }
}

function openWarehouseModal(w = null) {
  document.getElementById("warehouse-modal-title").textContent = w ? "Edit Warehouse" : "Add Warehouse";
  document.getElementById("warehouse-id").value = w?.warehouse_id || "";
  document.getElementById("warehouse-name").value = w?.name || "";

  fillSelect("warehouse-district", districts, "district_id", (d) => d.name, true);

  if (w) document.getElementById("warehouse-district").value = w.district_id;

  document.getElementById("warehouse-capacity").value = w?.capacity_kg || "";
  document.getElementById("warehouse-rent").value = w?.rent_per_day || "";
  document.getElementById("warehouse-temp-min").value = w?.temp_min || "";
  document.getElementById("warehouse-temp-max").value = w?.temp_max || "";
  document.getElementById("warehouse-manager-name").value = w?.manager_name || "";
  document.getElementById("warehouse-manager-phone").value = w?.manager_phone || "";
  document.getElementById("warehouse-active").checked = w ? w.is_active : true;
  document.getElementById("modal-warehouse").classList.add("open");
}

function editWarehouse(w) {
  openWarehouseModal(w);
}

async function saveWarehouse() {
  const id = document.getElementById("warehouse-id").value;

  const body = {
    name: document.getElementById("warehouse-name").value.trim(),
    district_id: document.getElementById("warehouse-district").value,
    capacity_kg: +document.getElementById("warehouse-capacity").value,
    rent_per_day: +document.getElementById("warehouse-rent").value,
    temp_min: document.getElementById("warehouse-temp-min").value || null,
    temp_max: document.getElementById("warehouse-temp-max").value || null,
    manager_name: document.getElementById("warehouse-manager-name").value.trim(),
    manager_phone: document.getElementById("warehouse-manager-phone").value.trim(),
    is_active: document.getElementById("warehouse-active").checked
  };

  if (!body.name || !body.district_id) {
    toast("Name and district required", "error");
    return;
  }

  try {
    if (id) {
      await api(`/api/warehouses/${id}`, { method: "PUT", body });
    } else {
      await api("/api/warehouses", { method: "POST", body });
    }

    toast(id ? "Updated!" : "Added!");
    closeModal("warehouse");
    loadWarehouses();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* Vehicles */
async function loadVehicles() {
  const tbody = document.getElementById("vehicle-tbody");
  tbody.innerHTML = '<tr><td colspan="8"><div class="loader"><div class="spinner"></div></div></td></tr>';

  try {
    vehicles = await api("/api/vehicles");

    tbody.innerHTML = !vehicles.length
      ? `<tr><td colspan="8">${emptyState("fa-truck-moving", "No vehicles")}</td></tr>`
      : vehicles
          .map(
            (v) => `<tr style="${v._busy ? "background:#fffbeb" : ""}">
              <td><strong>${v.plate_no}</strong></td>
              <td>${v.vehicle_type || '<span class="td-muted"> - </span>'}</td>
              <td>${v.capacity_kg} kg</td>
              <td>
                ${v.cooling_unit || '<span class="td-muted"> - </span>'}
                ${v.cooling_capacity_btu ? `<div class="td-muted">${v.cooling_capacity_btu} BTU/hr</div>` : ""}
              </td>
              <td>
                ${v._busy
                  ? (v._busy.status === "DELAYED"
                      ? badge("DELAYED")
                      : v._busy.status === "IN_WAREHOUSE"
                      ? badge("IN_WAREHOUSE")
                      : badge("Busy"))
                  : badge(v.is_operational ? "Available" : "Inactive")}
              </td>
              <td>${v._busy
                ? `${faIcon("fa-truck-fast")} <strong>${v._busy.delivering}</strong> -> ${v._busy.to}
                   <div class="td-muted" style="font-size:11px">${v._busy.status.replace(/_/g," ")}</div>`
                : '<span class="td-muted"> - </span>'}</td>
              <td>${v.last_service_date ? fmtDate(v.last_service_date) : '<span class="td-muted"> - </span>'}</td>
              <td class="td-actions">
                <button class="btn btn-ghost btn-sm" onclick='editVehicle(${JSON.stringify(v).replace(/'/g, "&#39;")})'>${faIcon("fa-pen-to-square")}</button>
                <button class="btn btn-danger btn-sm" onclick="deleteVehicle('${v.vehicle_id}')">${faIcon("fa-trash-can")}</button>
              </td>
            </tr>`
          )
          .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--red)">Error: ${e.message}</td></tr>`;
  }
}

function openVehicleModal(v = null) {
  document.getElementById("vehicle-modal-title").textContent = v ? "Edit Vehicle" : "Add Vehicle";
  document.getElementById("vehicle-id").value = v?.vehicle_id || "";
  document.getElementById("vehicle-plate").value = v?.plate_no || "";
  document.getElementById("vehicle-type").value = v?.vehicle_type || "";
  document.getElementById("vehicle-cooling").value = v?.cooling_unit || "";
  document.getElementById("vehicle-capacity").value = v?.capacity_kg || "";
  document.getElementById("vehicle-min-temp").value = v?.min_temp_capacity || "";

  if (document.getElementById("vehicle-cooling-capacity-btu")) {
    document.getElementById("vehicle-cooling-capacity-btu").value = v?.cooling_capacity_btu || "";
  }

  document.getElementById("vehicle-service-date").value = v?.last_service_date?.slice(0, 10) || "";
  document.getElementById("vehicle-operational").checked = v ? v.is_operational : true;
  document.getElementById("modal-vehicle").classList.add("open");
}

function editVehicle(v) {
  openVehicleModal(v);
}

async function saveVehicle() {
  const id = document.getElementById("vehicle-id").value;

  const body = {
    plate_no: document.getElementById("vehicle-plate").value.trim(),
    vehicle_type: document.getElementById("vehicle-type").value.trim(),
    cooling_unit: document.getElementById("vehicle-cooling").value.trim(),
    capacity_kg: +document.getElementById("vehicle-capacity").value,
    min_temp_capacity: document.getElementById("vehicle-min-temp").value || null,
    cooling_capacity_btu: document.getElementById("vehicle-cooling-capacity-btu")?.value || null,
    last_service_date: document.getElementById("vehicle-service-date").value || null,
    is_operational: document.getElementById("vehicle-operational").checked
  };

  if (!body.plate_no || !body.capacity_kg) {
    toast("Plate and capacity required", "error");
    return;
  }

  try {
    if (id) {
      await api(`/api/vehicles/${id}`, { method: "PUT", body });
    } else {
      await api("/api/vehicles", { method: "POST", body });
    }

    toast(id ? "Updated!" : "Added!");
    closeModal("vehicle");
    loadVehicles();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteVehicle(id) {
  if (!confirm("Delete?")) return;

  try {
    await api(`/api/vehicles/${id}`, { method: "DELETE" });
    toast("Deleted!");
    loadVehicles();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
   HEAT MONITOR  -  FIXED for kW columns + load_ratio + humidity
   ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| */
async function loadMonitoring() {
  const tbody = document.getElementById("monitoring-tbody");
  if (!tbody) return;

  /* filter dropdown: "all" | "breach" | "overloaded" */
  const filter = document.getElementById("monitoring-filter")?.value || "";
  tbody.innerHTML = '<tr><td colspan="12"><div class="loader"><div class="spinner"></div></div></td></tr>';

  try {
    let url = "/api/monitoring";
    if (filter === "breach")     url += "?breach=true";
    if (filter === "overloaded") url += "?overloaded=true";

    monitoring = await api(url);

    tbody.innerHTML = !monitoring.length
      ? `<tr><td colspan="12">${emptyState("fa-temperature-half", "No sensor logs")}</td></tr>`
      : monitoring.map(m => {
          /* Support both flat (from v_heat_monitor view) and nested (joined) API responses */
          const product = m.product_name || m.shipment?.product?.name || "?";
          const farmer  = m.farmer_name  || m.shipment?.farmer?.name  || "?";
          const status  = m.shipment_status || m.shipment?.status || "?";

          /* kW columns  -  prefer the new _kw fields, fall back to legacy BTU-based fields */
          const heatKw    = m.calculated_heat_load_kw ?? m.heat_load_kw ?? null;
          const coolingKw = m.vehicle_cooling_cap_kw  ?? m.cooling_cap_kw  ?? null;
          const loadRatio = m.load_ratio ?? null;

          /* risk_level comes from v_heat_monitor view; calculate locally if missing */
          const riskLevel = m.risk_level
            ?? (loadRatio != null
                ? (loadRatio > 1.0 ? "HIGH RISK" : loadRatio > 0.8 ? "WARNING" : "SAFE")
                : (m.is_overloaded ? "HIGH RISK" : "SAFE"));

          /* Row highlight */
          const rowBg = riskLevel === "HIGH RISK" ? "background:#fff0f0"
                       : riskLevel === "WARNING"  ? "background:#fffbeb"
                       : "";

          const overloadBadge = m.is_overloaded
            ? `<span class="badge badge-red">${faIcon("fa-triangle-exclamation")} YES</span>`
            : '<span class="badge badge-green">NO</span>';

          const breachBadge = m.is_temp_breach
            ? `<span class="badge badge-yellow">${faIcon("fa-triangle-exclamation")} YES</span>`
            : '<span class="badge badge-green">NO</span>';

          const riskBadge = badge(riskLevel);

          /* DeltaT (temp_difference in monitoring_sensor / delta_t in v_heat_monitor view) */
          const deltaT = m.temp_difference ?? m.delta_t ?? null;

          return `<tr style="${rowBg}">
            <td>
              <strong>${product}</strong>
              <div class="td-muted" style="font-size:11px">${farmer}</div>
            </td>
            <td>
              <span style="font-family:monospace;font-size:11px">${String(m.shipment_id || "").slice(0,8)}...</span>
              <div class="td-muted" style="font-size:11px">${badge(status)}</div>
            </td>
            <td><strong>${m.ambient_temp ?? " - "}°C</strong></td>
            <td><strong>${m.internal_temp ?? " - "}°C</strong></td>
            <td>
              ${m.ideal_temp_max != null ? m.ideal_temp_max + "°C" : " - "}
              ${deltaT != null ? `<div class="td-muted" style="font-size:11px">DeltaT ${deltaT}°C</div>` : ""}
            </td>
            <td>${m.humidity != null ? m.humidity + "%" : " - "}</td>
            <td>
              ${heatKw != null ? `<strong>${Number(heatKw).toFixed(3)} kW</strong>` : " - "}
            </td>
            <td>
              ${coolingKw != null ? `${Number(coolingKw).toFixed(3)} kW` : " - "}
              ${loadRatio != null ? `<div class="td-muted" style="font-size:11px">ratio ${Number(loadRatio).toFixed(2)}</div>` : ""}
            </td>
            <td>${overloadBadge}</td>
            <td>${breachBadge}</td>
            <td>${riskBadge}</td>
            <td class="td-muted">${fmtDT(m.recorded_at)}</td>
          </tr>`;
        }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="12" style="color:var(--red);padding:16px">Error: ${e.message}</td></tr>`;
  }
}

function openSensorModal() {
  fillSelect(
    "sensor-shipment",
    shipments,
    "shipment_id",
    (s) => `${s.product?.name || "?"}  -  ${s.farmer?.name || "?"} (${s.status})`,
    true
  );

  // Clear all fields first
  ["sensor-ambient-temp", "sensor-internal-temp", "sensor-humidity", "sensor-gps-lat", "sensor-gps-lng"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // When shipment is selected -> auto-fill humidity + GPS from weather_cache
  document.getElementById("sensor-shipment").onchange = async function () {
    const shipmentId = this.value;
    if (!shipmentId) return;

    // Find the shipment in local cache
    const s = shipments.find(x => x.shipment_id === shipmentId);
    if (!s) return;

    // Auto-fill GPS from source district coordinates
    const srcDistrict = s.source_district || districts.find(d => d.district_id === s.source_district_id);
    if (srcDistrict?.latitude)  document.getElementById("sensor-gps-lat").value = srcDistrict.latitude;
    if (srcDistrict?.longitude) document.getElementById("sensor-gps-lng").value = srcDistrict.longitude;

    // Auto-fill humidity + ambient temp from weather_cache for source district
    try {
      const districtId = s.source_district_id || srcDistrict?.district_id;
      if (!districtId) return;

      const weatherRows = await api("/api/weather-cache");
      const cached = weatherRows.find(w => w.district_id === districtId);

      if (cached) {
        // Set humidity hint
        const humEl = document.getElementById("sensor-humidity");
        if (humEl && !humEl.value) {
          humEl.value = cached.humidity_pct ?? "";
          humEl.title = `Auto-filled from ${cached.district?.name} weather cache (${cached.condition_text ?? ""})`;
        }

        // Set ambient temp hint only if empty
        const ambEl = document.getElementById("sensor-ambient-temp");
        if (ambEl && !ambEl.value) {
          ambEl.value = cached.temp_celsius ?? "";
          ambEl.title = `Auto-filled from ${cached.district?.name} live weather`;
        }

        // Show hint label
        const hint = document.getElementById("sensor-weather-hint");
        if (hint && cached) {
          hint.style.display = "";
          hint.textContent = ` ${cached.district?.name}: ${cached.temp_celsius}°C, ${cached.humidity_pct}% humidity (${cached.condition_text ?? ""})  -  fetched ${new Date(cached.fetched_at).toLocaleTimeString()}`;
        }
      } else {
        const hint = document.getElementById("sensor-weather-hint");
        if (hint) {
          hint.style.display = "";
          hint.textContent = "Warning: No cached weather for this district - go to Weather Events -> Fetch Live first";
          hint.style.color = "var(--yellow)";
        }
      }
    } catch (_) { /* weather cache optional */ }
  };

  document.getElementById("modal-sensor")?.classList.add("open");
}

async function saveSensorLog() {
  const body = {
    shipment_id:   document.getElementById("sensor-shipment").value,
    ambient_temp:  +document.getElementById("sensor-ambient-temp").value,
    internal_temp: +document.getElementById("sensor-internal-temp").value,
    humidity:  document.getElementById("sensor-humidity").value  ? +document.getElementById("sensor-humidity").value  : null,
    gps_lat:   document.getElementById("sensor-gps-lat").value   ? +document.getElementById("sensor-gps-lat").value   : null,
    gps_lng:   document.getElementById("sensor-gps-lng").value   ? +document.getElementById("sensor-gps-lng").value   : null
  };

  if (!body.shipment_id || Number.isNaN(body.ambient_temp) || Number.isNaN(body.internal_temp)) {
    toast("Shipment, ambient temp, and internal temp required", "error");
    return;
  }

  try {
    await api("/api/monitoring", { method: "POST", body });
    toast("Sensor log saved! Heat load auto-calculated by DB trigger.");
    closeModal("sensor");
    loadMonitoring();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
   WEATHER  -  loads live cache cards + events table together
   ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| */

/* WMO code -> Font Awesome icon class */
function wmoIcon(code, isDay = true) {
  if (code === 0)               return isDay ? 'fa-sun'                : 'fa-moon';
  if (code === 1)               return isDay ? 'fa-sun'                : 'fa-moon';
  if (code === 2)               return isDay ? 'fa-cloud-sun'          : 'fa-cloud-moon';
  if (code === 3)               return 'fa-cloud';
  if ([45,48].includes(code))   return 'fa-smog';
  if (code >= 51 && code <= 57) return 'fa-cloud-rain';
  if (code >= 61 && code <= 67) return 'fa-cloud-showers-heavy';
  if (code >= 71 && code <= 77) return 'fa-snowflake';
  if (code >= 80 && code <= 82) return 'fa-cloud-showers-heavy';
  if (code >= 85 && code <= 86) return 'fa-snowflake';
  if (code >= 95)               return 'fa-cloud-bolt';
  return 'fa-cloud';
}

/* Wind degrees -> compass label */
function windDir(deg) {
  if (deg == null) return ' - ';
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

/* Colour-code temperature (Bangladesh context) */
function tempColor(t) {
  if (t == null) return 'var(--gray-500)';
  if (t >= 40)   return '#dc2626';
  if (t >= 35)   return '#ea580c';
  if (t >= 30)   return '#d97706';
  if (t >= 20)   return '#16a34a';
  if (t >= 10)   return '#2563eb';
  return '#7c3aed';
}

async function loadWeatherCache() {
  const grid    = document.getElementById('weather-cache-grid');
  const updEl   = document.getElementById('weather-cache-updated');
  const staleEl = document.getElementById('weather-cache-stale');
  if (!grid) return;

  grid.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    const rows = await api('/api/weather-cache');

    if (!rows.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--gray-500)">
          <i class="fas fa-satellite-dish" style="font-size:32px;margin-bottom:8px;display:block;opacity:.4"></i>
          No weather data yet. Click <strong>Fetch Live</strong> to pull from Open-Meteo.
        </div>`;
      return;
    }

    /* oldest fetch time to show staleness */
    const oldest = new Date(Math.min(...rows.map(r => new Date(r.fetched_at))));
    const minsOld = Math.round((Date.now() - oldest) / 60000);

    if (updEl) updEl.textContent = `Updated ${minsOld < 1 ? 'just now' : minsOld + 'm ago'}`;
    if (staleEl) staleEl.style.display = minsOld > 60 ? '' : 'none';

    grid.innerHTML = rows.map(w => {
      const icon      = wmoIcon(w.weather_code, w.is_day);
      const tColor    = tempColor(w.temp_celsius);
      const floodBadge = w.district?.flood_risk === 'HIGH'
        ? `<span class="badge badge-red" style="font-size:10px">High Flood</span>`
        : w.district?.flood_risk === 'MEDIUM'
        ? `<span class="badge badge-yellow" style="font-size:10px">Med Flood</span>`
        : '';

      const uvLevel = w.uv_index == null ? ' - '
        : w.uv_index >= 11 ? `<span style="color:#dc2626;font-weight:600">${w.uv_index} Extreme</span>`
        : w.uv_index >= 8  ? `<span style="color:#ea580c;font-weight:600">${w.uv_index} Very High</span>`
        : w.uv_index >= 6  ? `<span style="color:#d97706;font-weight:600">${w.uv_index} High</span>`
        : `<span>${w.uv_index} Low-Mod</span>`;

      return `
        <div style="
          background:var(--gray-50);
          border:1px solid var(--gray-200);
          border-radius:10px;
          padding:14px 16px;
          display:flex;flex-direction:column;gap:6px;
        ">
          <!-- header: district + icon -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-weight:700;font-size:14px">${w.district?.name ?? ' - '}</div>
              <div style="font-size:11px;color:var(--gray-500)">${w.district?.division ?? ''} ${floodBadge}</div>
            </div>
            <i class="fa-solid ${icon}" style="font-size:26px;color:${tColor};opacity:.85"></i>
          </div>

          <!-- temperature block -->
          <div style="display:flex;align-items:baseline;gap:6px;margin:4px 0">
            <span style="font-size:36px;font-weight:800;line-height:1;color:${tColor}">${w.temp_celsius ?? ' - '}°</span>
            <span style="color:var(--gray-500);font-size:12px">
              Feels ${w.feels_like_celsius != null ? w.feels_like_celsius + '°C' : ' - '}
            </span>
          </div>

          <!-- condition -->
          <div style="font-size:13px;font-weight:500;color:var(--gray-700)">${w.condition_text ?? ' - '}</div>

          <!-- detail grid -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;font-size:12px;margin-top:4px">
            <div style="color:var(--gray-500)"><i class="fas fa-droplet" style="width:12px"></i> Humidity</div>
            <div>${w.humidity_pct != null ? w.humidity_pct + '%' : ' - '}</div>

            <div style="color:var(--gray-500)"><i class="fas fa-wind" style="width:12px"></i> Wind</div>
            <div>${w.wind_speed_kmh != null ? w.wind_speed_kmh + ' km/h ' + windDir(w.wind_direction_deg) : ' - '}</div>

            <div style="color:var(--gray-500)"><i class="fas fa-cloud-rain" style="width:12px"></i> Rain</div>
            <div>${w.rain_mm != null ? w.rain_mm + ' mm' : ' - '}</div>

            <div style="color:var(--gray-500)"><i class="fas fa-cloud" style="width:12px"></i> Cloud</div>
            <div>${w.cloud_cover_pct != null ? w.cloud_cover_pct + '%' : ' - '}</div>

            <div style="color:var(--gray-500)"><i class="fas fa-sun" style="width:12px"></i> UV</div>
            <div>${uvLevel}</div>

            <div style="color:var(--gray-500)"><i class="fas fa-eye" style="width:12px"></i> Visibility</div>
            <div>${w.visibility_km != null ? w.visibility_km + ' km' : ' - '}</div>
          </div>

          <div style="font-size:10px;color:var(--gray-400);margin-top:4px;text-align:right">
            ${fmtDT(w.fetched_at)}
          </div>
        </div>`;
    }).join('');

  } catch (e) {
    grid.innerHTML = `<div style="grid-column:1/-1;color:var(--red);padding:12px">Error: ${e.message}</div>`;
  }
}

async function refreshWeatherCache() {
  const btn = document.getElementById('weather-refresh-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-rotate-right fa-spin"></i> Fetching...'; }

  try {
    const r = await api('/api/weather-cache/refresh', { method: 'POST' });
    toast(r.errors?.length
      ? `Fetched ${r.updated} district(s). Errors: ${r.errors.join(', ')}`
      : ` Live weather updated for ${r.updated} district(s)!`
    );
    await loadWeatherCache();
  } catch (e) {
    toast('Fetch failed: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rotate-right"></i> Fetch Live'; }
  }
}

async function loadWeather() {
  /* Load both panels in parallel */
  loadWeatherCache();

  const tbody = document.getElementById("weather-tbody");
  tbody.innerHTML = '<tr><td colspan="8"><div class="loader"><div class="spinner"></div></div></td></tr>';

  try {
    const ev = await api("/api/weather-events");

    tbody.innerHTML = !ev.length
      ? `<tr><td colspan="8">${emptyState("fa-cloud-bolt", "No events")}</td></tr>`
      : ev
          .map(
            (e) => `<tr>
              <td><strong>${e.event_type.replace(/_/g, " ")}</strong></td>
              <td>${e.district?.name || "?"}</td>
              <td>${badge(e.severity_level)}</td>
              <td>${e.delay_impact_hours}h</td>
              <td class="td-muted">${fmtDT(e.started_at)}</td>
              <td class="td-muted">${e.ended_at ? fmtDT(e.ended_at) : " - "}</td>
              <td>${badge(e.ended_at ? "Inactive" : "Active")}</td>
              <td><button class="btn btn-ghost btn-sm" onclick='editWeather(${JSON.stringify(e).replace(/'/g, "&#39;")})'>${faIcon("fa-pen-to-square")}</button></td>
            </tr>`
          )
          .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--red)">Error: ${e.message}</td></tr>`;
  }
}

function openWeatherModal(e = null) {
  document.getElementById("weather-modal-title").textContent = e ? "Edit Event" : "Log Weather Event";
  document.getElementById("weather-id").value = e?.event_id || "";

  fillSelect("weather-district", districts, "district_id", (d) => d.name, true);

  if (e) {
    document.getElementById("weather-district").value = e.district_id;
    document.getElementById("weather-type").value = e.event_type;
    document.getElementById("weather-severity").value = e.severity_level || "LOW";
    document.getElementById("weather-delay").value = e.delay_impact_hours;
    document.getElementById("weather-started").value = toLocalDT(e.started_at);
    document.getElementById("weather-ended").value = e.ended_at ? toLocalDT(e.ended_at) : "";
    document.getElementById("weather-description").value = e.description || "";
  } else {
    document.getElementById("weather-started").value = toLocalDT(new Date().toISOString());
    ["weather-ended", "weather-description"].forEach((id) => {
      document.getElementById(id).value = "";
    });
    document.getElementById("weather-delay").value = "4";
    document.getElementById("weather-severity").value = "LOW";
  }

  document.getElementById("modal-weather").classList.add("open");
}

function editWeather(e) {
  openWeatherModal(e);
}

async function saveWeather() {
  const id = document.getElementById("weather-id").value;

  const body = {
    district_id:        document.getElementById("weather-district").value,
    event_type:         document.getElementById("weather-type").value,
    severity_level:     document.getElementById("weather-severity").value,
    delay_impact_hours: +document.getElementById("weather-delay").value || 0,
    started_at: new Date(document.getElementById("weather-started").value).toISOString(),
    ended_at:   document.getElementById("weather-ended").value
      ? new Date(document.getElementById("weather-ended").value).toISOString()
      : null,
    description: document.getElementById("weather-description").value.trim()
  };

  if (!body.district_id || !body.started_at) {
    toast("District and start time required", "error");
    return;
  }

  try {
    if (id) {
      await api(`/api/weather-events/${id}`, { method: "PUT", body });
    } else {
      await api("/api/weather-events", { method: "POST", body });
    }

    toast(id ? "Updated!" : "Event logged! Active shipments in this district auto-marked DELAYED.");
    closeModal("weather");
    loadWeather();
  } catch (e) {
    toast("DB Error: " + e.message, "error");
  }
}

/* Spoilage */
async function loadSpoilage() {
  const tbody = document.getElementById("spoilage-tbody");
  tbody.innerHTML = '<tr><td colspan="9"><div class="loader"><div class="spinner"></div></div></td></tr>';

  try {
    const d = await api("/api/spoilage");

    tbody.innerHTML = !d.length
      ? `<tr><td colspan="9">${emptyState("fa-triangle-exclamation", "No records")}</td></tr>`
      : d
          .map(
            (s) => `<tr>
              <td><strong>${s.shipment?.product?.name || "?"}</strong></td>
              <td>${s.shipment?.farmer?.name || " - "}</td>
              <td>${s.qty_sent} kg</td>
              <td>${s.qty_received} kg</td>
              <td style="color:var(--red);font-weight:600">${s.qty_spoiled} kg</td>
              <td>${s.spoilage_pct != null ? s.spoilage_pct.toFixed(1) + "%" : " - "}</td>
              <td>${[s.caused_by_heat_overload ? `${faIcon("fa-fire")} Heat` : "", s.caused_by_delay ? `${faIcon("fa-clock")} Delay` : "", s.spoilage_reason || ""].filter(Boolean).join(", ") || " - "}</td>
              <td style="color:var(--red)">${s.loss_amount != null ? bdt(s.loss_amount) : " - "}</td>
              <td class="td-muted">${fmtDT(s.detected_at)}</td>
            </tr>`
          )
          .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" style="color:var(--red)">Error: ${e.message}</td></tr>`;
  }
}

function openSpoilageModal() {
  fillSelect(
    "spoilage-shipment",
    shipments,
    "shipment_id",
    (s) => `${s.product?.name || "?"}  -  ${s.farmer?.name || "?"} (${s.shipment_id.slice(0, 8)})`,
    true
  );

  ["spoilage-sent", "spoilage-received", "spoilage-spoiled", "spoilage-reason"].forEach((id) => {
    document.getElementById(id).value = "";
  });

  document.getElementById("spoilage-heat").checked = false;
  document.getElementById("spoilage-delay").checked = false;
  document.getElementById("modal-spoilage").classList.add("open");
}

async function saveSpoilage() {
  const body = {
    shipment_id:           document.getElementById("spoilage-shipment").value,
    qty_sent:              +document.getElementById("spoilage-sent").value,
    qty_received:          +document.getElementById("spoilage-received").value,
    qty_spoiled:           +document.getElementById("spoilage-spoiled").value,
    spoilage_reason:       document.getElementById("spoilage-reason").value.trim(),
    caused_by_heat_overload: document.getElementById("spoilage-heat").checked,
    caused_by_delay:       document.getElementById("spoilage-delay").checked
  };

  if (!body.shipment_id || !body.qty_sent || !body.qty_received) {
    toast("Required fields missing", "error");
    return;
  }

  try {
    await api("/api/spoilage", { method: "POST", body });
    toast("Reported!");
    closeModal("spoilage");
    loadSpoilage();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
   PROVENANCE FEED  -  shows ALL actions across all tables
   ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| */

/* Map event_type -> icon + colour */
function provIcon(type) {
  const map = {
    // Shipment lifecycle
    DEPARTURE:         { icon:"fa-truck-fast",           color:"var(--blue)"   },
    ARRIVAL:           { icon:"fa-flag-checkered",        color:"var(--green)"  },
    SHIPMENT_CREATED:  { icon:"fa-truck-loading",         color:"var(--blue)"   },
    WAREHOUSE_IN:      { icon:"fa-warehouse",             color:"var(--yellow)" },
    WAREHOUSE_OUT:     { icon:"fa-warehouse",             color:"var(--green)"  },
    DELAY:             { icon:"fa-clock",                 color:"var(--yellow)" },
    SPOILAGE:          { icon:"fa-skull-crossbones",      color:"var(--red)"    },
    SPOILAGE_CREATED:  { icon:"fa-triangle-exclamation",  color:"var(--red)"    },
    TEMP_RISE:         { icon:"fa-temperature-arrow-up",  color:"var(--red)"    },
    HEAT_OVERLOAD:     { icon:"fa-fire",                  color:"var(--red)"    },
    // Weather
    WEATHER_ALERT:     { icon:"fa-cloud-bolt",            color:"var(--red)"    },
    WEATHER_CREATED:   { icon:"fa-cloud-sun-rain",        color:"var(--yellow)" },
    WEATHER_UPDATED:   { icon:"fa-cloud",                 color:"var(--gray-500)"},
    // Price
    PRICE_CHANGE:      { icon:"fa-tags",                  color:"var(--blue)"   },
    // Sensor
    SENSOR_LOGGED:     { icon:"fa-temperature-half",      color:"var(--blue)"   },
    // Orders
    ORDER_CREATED:     { icon:"fa-cart-plus",             color:"var(--green)"  },
    ORDER_STATUS_CHANGE:{ icon:"fa-clipboard-check",      color:"var(--blue)"   },
    ORDER_ITEM_ADDED:  { icon:"fa-plus-circle",           color:"var(--green)"  },
    ORDER_ITEM_DELETED:{ icon:"fa-minus-circle",          color:"var(--yellow)" },
    // Farmers
    FARMER_CREATED:    { icon:"fa-user-plus",             color:"var(--green)"  },
    FARMER_UPDATED:    { icon:"fa-user-pen",              color:"var(--blue)"   },
    FARMER_DELETED:    { icon:"fa-user-minus",            color:"var(--red)"    },
    // Products
    PRODUCT_CREATED:   { icon:"fa-box-open",              color:"var(--green)"  },
    PRODUCT_UPDATED:   { icon:"fa-pen-to-square",         color:"var(--blue)"   },
    PRODUCT_DELETED:   { icon:"fa-trash-can",             color:"var(--red)"    },
    // Vehicles
    VEHICLE_CREATED:   { icon:"fa-truck-medical",         color:"var(--green)"  },
    VEHICLE_UPDATED:   { icon:"fa-screwdriver-wrench",    color:"var(--blue)"   },
    VEHICLE_DELETED:   { icon:"fa-truck",                 color:"var(--red)"    },
    // Warehouses
    WAREHOUSE_CREATED: { icon:"fa-warehouse",             color:"var(--green)"  },
    WAREHOUSE_UPDATED: { icon:"fa-pen-to-square",         color:"var(--blue)"   },
  };
  return map[type] || { icon:"fa-circle-info", color:"var(--gray-500)" };
}

/* Which "table" did this event come from? */
function provTable(type) {
  if (type.startsWith("FARMER"))    return "Farmer";
  if (type.startsWith("PRODUCT"))   return "Product";
  if (type.startsWith("VEHICLE"))   return "Vehicle";
  if (type.startsWith("WAREHOUSE")) return "Warehouse";
  if (type.startsWith("ORDER"))     return "Order";
  if (type.startsWith("WEATHER"))   return "Weather";
  if (type.startsWith("SENSOR"))    return "Sensor";
  if (type.startsWith("SPOILAGE"))  return "Spoilage";
  if (["DEPARTURE","ARRIVAL","SHIPMENT_CREATED","DELAY"].includes(type)) return "Shipment";
  if (["TEMP_RISE","HEAT_OVERLOAD"].includes(type))   return "Heat Monitor";
  if (type === "PRICE_CHANGE")      return "Price";
  return "";
}

async function loadProvenance() {
  const feed = document.getElementById("prov-feed");
  feed.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  const sev   = document.getElementById("prov-severity-filter")?.value || "";
  const table = document.getElementById("prov-table-filter")?.value || "";

  try {
    const ev = await api(`/api/provenance${sev ? "?severity=" + sev : ""}`);

    if (!ev.length) {
      feed.innerHTML = emptyState("fa-route", "No events yet  -  start adding data!");
      return;
    }

    // client-side table filter
    const filtered = table
      ? ev.filter(e => provTable(e.event_type) === table)
      : ev;

    if (!filtered.length) {
      feed.innerHTML = emptyState("fa-filter", `No ${table} events found`);
      return;
    }

    feed.innerHTML = filtered.map(e => {
      const { icon, color } = provIcon(e.event_type);
      const tbl = provTable(e.event_type);
      const label = e.event_type.replace(/_/g, " ");

      return `<div class="event-item" style="align-items:flex-start">
        <div style="
          width:36px;height:36px;border-radius:50%;
          background:${color}22;
          display:flex;align-items:center;justify-content:center;
          flex-shrink:0;margin-top:2px
        ">
          <i class="fa-solid ${icon}" style="color:${color};font-size:14px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div class="event-title" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <strong style="font-size:13px">${label}</strong>
            ${badge(e.severity)}
            ${tbl ? `<span style="
              background:var(--gray-100);color:var(--gray-500);
              font-size:10px;padding:1px 7px;border-radius:10px;font-weight:600;
              text-transform:uppercase;letter-spacing:.4px
            ">${tbl}</span>` : ""}
            ${e.shipment?.product?.name
              ? `<span class="td-muted" style="font-size:12px">${e.shipment.product.name}</span>`
              : ""}
          </div>
          <div class="event-meta" style="margin-top:3px;font-size:12px;color:var(--gray-500)">
            ${e.description
              ? `<span style="color:var(--gray-700)">${e.description}</span> &nbsp;·&nbsp; `
              : ""}
            <span>${fmtDT(e.event_time)}</span>
            ${e.shipment?.farmer?.name
              ? ` &nbsp;·&nbsp; <i class="fa-solid fa-user" style="font-size:10px"></i> ${e.shipment.farmer.name}`
              : ""}
          </div>
        </div>
      </div>`;
    }).join("");

  } catch (e) {
    feed.innerHTML = `<p style="color:var(--red)">Error: ${e.message}</p>`;
  }
}

/* |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
   PRICE AUDIT  -  FIXED for DELIVERY_PROFIT rows
   Now renders two distinct row styles:
     - Price-change rows  (WEATHER_ADJ, SPOILAGE_ADJ, etc.)
     - Delivery rows      (DELIVERY_PROFIT  -  profit/loss per shipment)
   ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| */
let priceAuditTab = "price";

function setPriceAuditTab(tab) {
  priceAuditTab = tab;
  loadPriceAudit();
}

function renderPriceAuditTabs() {
  const tabs = [
    { id: "audit-tab-price", key: "price" },
    { id: "audit-tab-info", key: "info" },
    { id: "audit-tab-stock", key: "stock" }
  ];

  tabs.forEach(({ id, key }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.className = key === priceAuditTab ? "btn btn-secondary btn-sm" : "btn btn-ghost btn-sm";
  });

  const help = document.getElementById("audit-tab-help");
  if (!help) return;
  if (priceAuditTab === "price") help.textContent = "Price increases/decreases with source (weather/manual/spoilage)";
  if (priceAuditTab === "info") help.textContent = "All edited product fields with previous and new values";
  if (priceAuditTab === "stock") help.textContent = "Stock quantity increase/decrease timeline";
}

function renderPriceHistoryTableHeader(thead) {
  thead.innerHTML = `<tr>
    <th>Product</th>
    <th>Old Price</th>
    <th>New Price / Delivery</th>
    <th>Change / Revenue</th>
    <th>Cost</th>
    <th>Profit / Change%</th>
    <th>Status / Type</th>
    <th>Context</th>
    <th>Source</th>
    <th>When</th>
  </tr>`;
}

function renderInfoChangesTableHeader(thead) {
  thead.innerHTML = `<tr>
    <th>Event</th>
    <th>Details</th>
    <th>When</th>
  </tr>`;
}

function renderStockLogTableHeader(thead) {
  thead.innerHTML = `<tr>
    <th>Product</th>
    <th>Stock Change</th>
    <th>When</th>
  </tr>`;
}

function parseAuditDesc(desc, key) {
  if (!desc) return "";
  const rx = new RegExp(`${key}:\\s*([^|]+)`);
  const m = desc.match(rx);
  return (m?.[1] || "").trim();
}

function renderPriceHistoryRows(rows, tbody) {
  tbody.innerHTML = !rows.length
    ? `<tr><td colspan="10">${emptyState("fa-chart-line", "No price changes")}</td></tr>`
    : rows.map((a) => {
        if (a.change_type === "DELIVERY_PROFIT") {
          const profitColor = a.profit_status === "PROFIT" ? "var(--green)"
                             : a.profit_status === "LOSS" ? "var(--red)"
                             : "var(--gray-500)";
          const profitSign = a.profit_status === "PROFIT" ? "+" : a.profit_status === "LOSS" ? "-" : "=";

          return `<tr style="background:#f0fdf4">
            <td>
              <strong>${a.product?.name || a.product_name || "?"}</strong>
              <div class="td-muted" style="font-size:11px">${a.category || ""}</div>
            </td>
            <td colspan="2">
              <span class="badge badge-green">DELIVERY</span>
              <div class="td-muted" style="font-size:11px">Qty: ${a.qty_delivered ?? "—"} units @ ${bdt(a.sell_price)}</div>
            </td>
            <td>
              <span style="font-weight:600">Revenue</span><br>
              <strong>${bdt(a.revenue)}</strong>
            </td>
            <td>
              <span style="color:var(--gray-500)">Cost: ${bdt(a.total_cost)}</span>
            </td>
            <td>
              <strong style="color:${profitColor}">${profitSign} ${bdt(Math.abs(a.gross_profit ?? 0))}</strong>
              <div class="td-muted" style="font-size:11px">${a.profit_margin_pct != null ? a.profit_margin_pct.toFixed(1) + "% margin" : ""}</div>
            </td>
            <td>${badge(a.profit_status ?? "BREAK_EVEN")}</td>
            <td class="td-muted" style="font-size:12px">
              ${a.farmer_name || a.product?.farmer?.name || "—"}
              ${a.source_district ? `<div>${faIcon("fa-location-dot")} ${a.source_district}</div>` : ""}
            </td>
            <td class="td-muted" style="font-size:11px">${a.price_source ?? "AUTO"}</td>
            <td class="td-muted">${fmtDT(a.changed_at)}</td>
          </tr>`;
        }

        const diff = Number(a.new_price ?? 0) - Number(a.old_price ?? 0);
        const pct = a.increase_pct != null
          ? Number(a.increase_pct).toFixed(1)
          : a.old_price ? ((diff / a.old_price) * 100).toFixed(1) : "0.0";
        const diffColor = diff > 0 ? "var(--red)" : diff < 0 ? "var(--green)" : "var(--gray-500)";
        const diffArrow = diff > 0 ? "+" : diff < 0 ? "-" : "=";

        return `<tr>
          <td>
            <strong>${a.product?.name || a.product_name || "?"}</strong>
            <div class="td-muted" style="font-size:11px">${a.category || a.product?.category || ""}</div>
          </td>
          <td>${bdt(a.old_price)}</td>
          <td><strong>${bdt(a.new_price)}</strong></td>
          <td style="color:${diffColor}">
            ${diffArrow} ${bdt(Math.abs(diff))}
            <div class="td-muted" style="font-size:11px">${Math.abs(pct)}%</div>
          </td>
          <td><span class="badge badge-blue">${(a.change_type || "").replace(/_/g, " ")}</span></td>
          <td>
            ${badge(a.profit_status ?? "INFO")}
            <div class="td-muted" style="font-size:11px">${a.price_source ?? "MANUAL"}</div>
          </td>
          <td class="td-muted" style="font-size:12px">${a.reason || a.market_note || "—"}</td>
          <td class="td-muted" style="font-size:12px">
            ${a.weather_cause ? `${faIcon("fa-cloud-bolt")} ${a.weather_cause} (${a.weather_severity || ""})` : ""}
            ${a.weather_district ? `<div>${faIcon("fa-location-dot")} ${a.weather_district}</div>` : ""}
            ${!a.weather_cause ? (a.farmer_name || "—") : ""}
          </td>
          <td class="td-muted" style="font-size:11px">${a.price_source ?? "MANUAL"}</td>
          <td class="td-muted">${fmtDT(a.changed_at)}</td>
        </tr>`;
      }).join("");
}

function renderInfoChangesRows(rows, tbody) {
  tbody.innerHTML = !rows.length
    ? `<tr><td colspan="3">${emptyState("fa-pen-to-square", "No info changes")}</td></tr>`
    : rows.map((r) => {
        // Parse format: "FIELD_CHANGED | Product: Oats | Current Price | 500 -> 510"
        let product = "Product";
        let field = "Field";
        let oldVal = "NULL";
        let newVal = "NULL";
        
        const desc = r.description || "";
        const parts = desc.split("|").map(p => p.trim());
        
        // parts[0] = "FIELD_CHANGED"
        // parts[1] = "Product: Oats"
        // parts[2] = "Current Price"
        // parts[3] = "500 -> 510"
        
        if (parts[1]) {
          const prodMatch = parts[1].match(/Product:\s*(.+)/);
          product = prodMatch ? prodMatch[1].trim() : "Product";
        }
        
        if (parts[2]) {
          field = parts[2];
        }
        
        if (parts[3]) {
          const vals = parts[3].split("->").map(v => v.trim());
          if (vals.length === 2) {
            oldVal = vals[0];
            newVal = vals[1];
          }
        }
        
        return `<tr>
          <td><strong>${product}</strong></td>
          <td class="td-muted" style="font-size:12px">
            <div><span class="badge badge-blue">${field}</span></div>
            <div style="margin-top:6px">Old: <strong>${oldVal}</strong></div>
            <div>New: <strong>${newVal}</strong></div>
          </td>
          <td class="td-muted">${fmtDT(r.event_time)}</td>
        </tr>`;
      }).join("");
}

function renderStockLogRows(rows, tbody) {
  tbody.innerHTML = !rows.length
    ? `<tr><td colspan="3">${emptyState("fa-boxes-stacked", "No stock changes")}</td></tr>`
    : rows.map((r) => {
        // Parse format: "STOCK_CHANGED | Product: Oats | Old: 176 -> New: 200 | Delta: +24"
        let product = "Product";
        let oldVal = "NULL";
        let newVal = "NULL";
        let delta = "0";
        
        const desc = r.description || "";
        const parts = desc.split("|").map(p => p.trim());
        
        // parts[0] = "STOCK_CHANGED"
        // parts[1] = "Product: Oats"
        // parts[2] = "Old: 176 -> New: 200"
        // parts[3] = "Delta: +24"
        
        if (parts[1]) {
          const prodMatch = parts[1].match(/Product:\s*(.+)/);
          product = prodMatch ? prodMatch[1].trim() : "Product";
        }
        
        if (parts[2]) {
          const stockPart = parts[2];
          const oldMatch = stockPart.match(/Old:\s*(.+?)\s*->/);
          const newMatch = stockPart.match(/New:\s*(.+)$/);
          if (oldMatch) oldVal = oldMatch[1].trim();
          if (newMatch) newVal = newMatch[1].trim();
        }
        
        if (parts[3]) {
          const deltaMatch = parts[3].match(/Delta:\s*(.+)$/);
          if (deltaMatch) delta = deltaMatch[1].trim();
        }
        
        const isUp = String(delta).startsWith("+");
        const isDown = String(delta).startsWith("-");
        const color = isUp ? "var(--green)" : isDown ? "var(--red)" : "var(--gray-600)";
        const arrow = isUp ? "+" : isDown ? "-" : "=";

        return `<tr>
          <td><strong>${product}</strong></td>
          <td class="td-muted" style="font-size:12px">
            <div>Old: <strong>${oldVal}</strong> -> New: <strong>${newVal}</strong></div>
            <div style="margin-top:4px;color:${color};font-weight:600">${arrow} ${delta}</div>
          </td>
          <td class="td-muted">${fmtDT(r.event_time)}</td>
        </tr>`;
      }).join("");
}

async function loadPriceAudit() {
  const thead = document.getElementById("audit-thead");
  const tbody = document.getElementById("audit-tbody");
  const cols = priceAuditTab === "price" ? 10 : 3;

  renderPriceAuditTabs();
  tbody.innerHTML = `<tr><td colspan="${cols}"><div class="loader"><div class="spinner"></div></div></td></tr>`;

  try {
    if (priceAuditTab === "info") {
      renderInfoChangesTableHeader(thead);
      const rows = await api("/api/product-info-changes");
      renderInfoChangesRows(rows, tbody);
      return;
    }

    if (priceAuditTab === "stock") {
      renderStockLogTableHeader(thead);
      const rows = await api("/api/stock-log");
      renderStockLogRows(rows, tbody);
      return;
    }

    renderPriceHistoryTableHeader(thead);
    const rows = await api("/api/price-audit");
    renderPriceHistoryRows(rows, tbody);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="${cols}" style="color:var(--red)">Error: ${e.message}</td></tr>`;
  }
}
/* Init */
async function init() {
  try {
    districts = await api("/api/districts");
    const el = document.getElementById("db-status");
    el.classList.add(districts.length ? "online" : "offline");
    document.getElementById("db-status-text").textContent = districts.length
      ? "Supabase Connected"
      : "No data  -  check /api/debug";
  } catch (e) {
    document.getElementById("db-status").classList.add("offline");
    document.getElementById("db-status-text").textContent = "Server error";
  }

  try { farmers    = await api("/api/farmers");    } catch {}
  try { products   = await api("/api/products");   } catch {}
  try { vehicles   = await api("/api/vehicles");   } catch {}
  try { warehouses = await api("/api/warehouses"); } catch {}
  try { shipments  = await api("/api/shipments");  } catch {}

  navigate(location.hash || "#dashboard");
}

init();



