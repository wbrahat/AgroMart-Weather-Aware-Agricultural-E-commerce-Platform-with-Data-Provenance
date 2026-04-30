require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

// Node < 18 fetch polyfill (CJS-safe)
if (!globalThis.fetch) {
  try { globalThis.fetch = require("node-fetch"); } catch (_) {
    console.warn("\u26a0\ufe0f  No fetch found. Run: npm install node-fetch  OR upgrade to Node 18+");
  }
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// â”€â”€ Page Routes First â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// localhost:3000 => login page
app.get("/", (req, res) => {
  res.redirect("/login");
});

// login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// dashboard page
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// direct /index.html access redirect to dashboard route
app.get("/index.html", (req, res) => {
  res.redirect("/dashboard");
});

// Serve static files, but do NOT auto serve index.html
app.use(express.static(path.join(__dirname, "public"), { index: false }));

let supabase = null;
let useMockDb = false;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_URL.trim()) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  } else {
    useMockDb = true;
    console.warn("[dev-mode] SUPABASE_URL not set — using in-memory mock DB for development");
  }
} catch (err) {
  useMockDb = true;
  console.warn("[dev-mode] Failed to initialize Supabase client — using mock DB", err?.message || err);
}

// Simple in-memory mock DB used when Supabase isn't configured (for local testing)
const mockDb = {
  products: [
    {
      product_id: "prod-1",
      name: "Tomato",
      category: "Vegetable",
      unit: "KG",
      purchase_price: 30,
      current_price: 50,
      stock_quantity: 100,
      ideal_temp_min: 10,
      ideal_temp_max: 25,
      max_shelf_hours: 72,
      specific_heat: null,
      loading_temp: null,
      respiration_heat_rate: null,
      is_seasonal: false,
      is_active: true
    }
  ],
  provenance: []
};

function send(res, data, error) {
  if (error) {
    console.error("[DB Error]", error.message);
    return res.status(400).json({ error: error.message });
  }
  res.json(data);
}

// â”€â”€ Universal provenance logger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Call after any successful CRUD to record it in provenance_event
async function logProvenance({
  event_type, description,
  severity      = "INFO",
  shipment_id   = null,
  order_id      = null,
  weather_event_id = null
}) {
  try {
    if (useMockDb) {
      mockDb.provenance.unshift({
        id: `evt-${Date.now()}`,
        event_type,
        description,
        severity,
        shipment_id,
        order_id,
        weather_event_id,
        event_time: new Date().toISOString()
      });
      return;
    } else {
      const { data, error } = await supabase.from("provenance_event").insert({
        event_type, description, severity,
        shipment_id, order_id, weather_event_id
      });
      if (error) {
        console.warn('[provenance-log][supabase-error]', error.message || error);
      }
      return data;
    }
  } catch (err) {
    console.warn("[provenance-log]", err?.message || err);
  }
}

function sameValue(a, b) {
  if (a == null && b == null) return true;
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
  return String(a) === String(b);
}

function fmtAuditValue(v) {
  return v == null || v === "" ? "NULL" : String(v);
}

// â”€â”€ Debug â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/debug", async (req, res) => {
  const tables = [
    "district",
    "farmer",
    "product",
    "warehouse",
    "vehicle",
    "shipment",
    "weather_event",
    "purchase_order",
    "order_item",
    "food_spoilage",
    "provenance_event",
    "audit_price_change"
  ];

  const results = {};

  for (const t of tables) {
    const { count, error } = await supabase
      .from(t)
      .select("*", { count: "exact", head: true });

    results[t] = error ? "ERROR: " + error.message : count + " rows";
  }

  const { data: s } = await supabase.from("shipment").select("status").limit(20);
  const { data: o } = await supabase.from("purchase_order").select("order_status").limit(5);

  res.json({
    ok: true,
    usingServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    tables: results,
    shipmentStatuses: [...new Set((s || []).map(r => r.status))],
    orderStatuses: [...new Set((o || []).map(r => r.order_status))]
  });
});

// â”€â”€ Auth providers probe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/auth/providers', async (req, res) => {
  // Requires SERVICE key set in env to probe provider status
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    return res.status(501).json({ ok: false, error: 'SUPABASE_SERVICE_KEY not configured on server' });
  }

  const base = process.env.SUPABASE_URL;
  if (!base) return res.status(500).json({ ok: false, error: 'SUPABASE_URL not configured' });

  const providers = ['google', 'facebook', 'apple'];
  const results = {};

  for (const p of providers) {
    try {
      // Call the authorize endpoint without following redirects; enabled providers will respond with redirect
      const url = new URL('/auth/v1/authorize', base);
      url.searchParams.set('provider', p);
      url.searchParams.set('redirect_to', 'http://localhost');

      const r = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`
        },
        redirect: 'manual'
      });

      // If Supabase returns a redirect (302/307), provider is enabled. If 400 with unsupported, it's disabled.
      results[p] = r.status === 302 || r.status === 307 || r.status === 200;
    } catch (err) {
      results[p] = false;
    }
  }

  res.json({ ok: true, providers: results });
});

// â”€â”€ Districts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/districts", async (req, res) => {
  const { data, error } = await supabase
    .from("district")
    .select("*")
    .order("name");

  send(res, data, error);
});

// â”€â”€ Farmers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/farmers", async (req, res) => {
  const { data, error } = await supabase
    .from("farmer")
    .select("*, district:district_id(name, flood_risk)")
    .order("name");

  send(res, data, error);
});

app.post("/api/farmers", async (req, res) => {
  const { name, phone, district_id, village, land_size_acre, is_active } = req.body;

  const { data, error } = await supabase
    .from("farmer")
    .insert({
      name,
      phone: phone || null,
      district_id,
      village: village || null,
      land_size_acre: land_size_acre || null,
      is_active: is_active !== false
    })
    .select()
    .single();

  if (error) return send(res, null, error);
  await logProvenance({ event_type:"FARMER_CREATED", severity:"INFO",
    description:`Farmer created: ${data.name} | District ID: ${data.district_id} | Village: ${data.village||"â€”"}` });
  res.status(201).json(data);
});

app.put("/api/farmers/:id", async (req, res) => {
  const { name, phone, district_id, village, land_size_acre, is_active, rating } = req.body;

  const { data, error } = await supabase
    .from("farmer")
    .update({
      name,
      phone: phone || null,
      district_id,
      village: village || null,
      land_size_acre: land_size_acre || null,
      is_active,
      rating
    })
    .eq("farmer_id", req.params.id)
    .select()
    .single();

  if (!error && data) await logProvenance({ event_type:"FARMER_UPDATED", severity:"INFO",
    description:`Farmer updated: ${data.name} | Active: ${data.is_active} | Land: ${data.land_size_acre||"â€”"} acres` });
  send(res, data, error);
});

app.delete("/api/farmers/:id", async (req, res) => {
  const { error } = await supabase
    .from("farmer")
    .delete()
    .eq("farmer_id", req.params.id);

  if (error) return send(res, null, error);
  await logProvenance({ event_type:"FARMER_DELETED", severity:"WARNING",
    description:`Farmer deleted: ID ${req.params.id}` });
  res.json({ success: true });
});

// â”€â”€ Products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/products", async (req, res) => {
  try {
    if (useMockDb) {
      let data = mockDb.products.slice();
      if (req.query.category) data = data.filter(p => String(p.category) === String(req.query.category));
      data.sort((a,b) => (a.category||"").localeCompare(b.category||"") || (a.name||"").localeCompare(b.name||""));
      send(res, data, null);
      return;
    }

    let q = supabase
      .from("product")
      .select("*")
      .order("category")
      .order("name");

    if (req.query.category) q = q.eq("category", req.query.category);

    const { data, error } = await q;
    send(res, data, error);
  } catch (e) { send(res, null, e); }
});

app.post("/api/products", async (req, res) => {
  const b = req.body;
  try {
    if (useMockDb) {
      const id = `prod-${Date.now()}`;
      const data = {
        product_id: id,
        name: b.name,
        category: b.category,
        unit: b.unit || "KG",
        purchase_price: b.purchase_price,
        current_price: b.current_price,
        stock_quantity: b.stock_quantity || 0,
        ideal_temp_min: b.ideal_temp_min || null,
        ideal_temp_max: b.ideal_temp_max || null,
        max_shelf_hours: b.max_shelf_hours || null,
        is_seasonal: !!b.is_seasonal,
        is_active: b.is_active !== false
      };
      mockDb.products.push(data);
      await logProvenance({ event_type:"PRODUCT_CREATED", severity:"INFO",
        description:`Product created: ${data.name} (${data.category}) | Price: ${data.current_price}/${data.unit} | Stock: ${data.stock_quantity}` });
      res.status(201).json(data);
      return;
    }

    const { data, error } = await supabase
      .from("product")
      .insert({
        name: b.name,
        category: b.category,
        unit: b.unit || "KG",
        purchase_price: b.purchase_price,
        current_price: b.current_price,
        stock_quantity: b.stock_quantity || 0,
        ideal_temp_min: b.ideal_temp_min || null,
        ideal_temp_max: b.ideal_temp_max || null,
        max_shelf_hours: b.max_shelf_hours || null,
        is_seasonal: b.is_seasonal || false,
        is_active: b.is_active !== false
      })
      .select()
      .single();

    if (error) return send(res, null, error);
    await logProvenance({ event_type:"PRODUCT_CREATED", severity:"INFO",
      description:`Product created: ${data.name} (${data.category}) | Price: à§³${data.current_price}/${data.unit} | Stock: ${data.stock_quantity}` });
    res.status(201).json(data);
  } catch (e) { send(res, null, e); }
});

app.put("/api/products/:id", async (req, res) => {
  const b = req.body;
  const productId = req.params.id;

  if (useMockDb) {
    try {
      const toNumOr = (v, fallback) => {
        if (v === undefined || v === null || v === "") return fallback;
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      };
      const toNullableNum = (v, fallback) => {
        if (v === undefined) return fallback;
        if (v === null || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      };

      const idx = mockDb.products.findIndex(p => String(p.product_id) === String(productId));
      if (idx === -1) return send(res, null, new Error("product not found"));
      const oldProduct = mockDb.products[idx];

      const nextProduct = {
        name: b.name === undefined ? oldProduct.name : String(b.name || "").trim(),
        category: b.category === undefined ? oldProduct.category : b.category,
        unit: b.unit === undefined ? oldProduct.unit : b.unit,
        purchase_price: toNumOr(b.purchase_price, oldProduct.purchase_price),
        current_price: toNumOr(b.current_price, oldProduct.current_price),
        stock_quantity: Math.max(0, toNumOr(b.stock_quantity, oldProduct.stock_quantity)),
        ideal_temp_min: toNullableNum(b.ideal_temp_min, oldProduct.ideal_temp_min),
        ideal_temp_max: toNullableNum(b.ideal_temp_max, oldProduct.ideal_temp_max),
        max_shelf_hours: toNullableNum(b.max_shelf_hours, oldProduct.max_shelf_hours),
        specific_heat: toNullableNum(b.specific_heat, oldProduct.specific_heat),
        loading_temp: toNullableNum(b.loading_temp, oldProduct.loading_temp),
        respiration_heat_rate: toNullableNum(b.respiration_heat_rate, oldProduct.respiration_heat_rate),
        is_seasonal: b.is_seasonal === undefined ? oldProduct.is_seasonal : Boolean(b.is_seasonal),
        is_active: b.is_active === undefined ? oldProduct.is_active : Boolean(b.is_active)
      };

      if (!Number.isFinite(nextProduct.purchase_price) || nextProduct.purchase_price <= 0) {
        nextProduct.purchase_price = Number(oldProduct.purchase_price || 1);
      }
      if (!Number.isFinite(nextProduct.current_price) || nextProduct.current_price <= 0) {
        nextProduct.current_price = Number(oldProduct.current_price || nextProduct.purchase_price);
      }
      if (nextProduct.current_price < nextProduct.purchase_price) {
        nextProduct.current_price = nextProduct.purchase_price;
      }
      const allowedCategories = new Set(["Vegetable", "Fruit", "Fish", "Meat", "Dairy", "Grain"]);
      if (!allowedCategories.has(String(nextProduct.category || ""))) {
        nextProduct.category = allowedCategories.has(String(oldProduct.category || "")) ? oldProduct.category : "Vegetable";
      }
      const allowedUnits = new Set(["KG", "LITRE", "PCS"]);
      if (!allowedUnits.has(String(nextProduct.unit || ""))) {
        nextProduct.unit = allowedUnits.has(String(oldProduct.unit || "")) ? oldProduct.unit : "KG";
      }
      if (!String(nextProduct.name || "").trim()) {
        nextProduct.name = String(oldProduct.name || "Product");
      }
      if (nextProduct.max_shelf_hours != null && Number(nextProduct.max_shelf_hours) <= 0) {
        nextProduct.max_shelf_hours = oldProduct.max_shelf_hours ?? null;
      }
      if (nextProduct.specific_heat != null && Number(nextProduct.specific_heat) <= 0) {
        nextProduct.specific_heat = oldProduct.specific_heat && Number(oldProduct.specific_heat) > 0
          ? Number(oldProduct.specific_heat)
          : null;
      }
      if (nextProduct.respiration_heat_rate != null && Number(nextProduct.respiration_heat_rate) <= 0) {
        nextProduct.respiration_heat_rate =
          oldProduct.respiration_heat_rate && Number(oldProduct.respiration_heat_rate) > 0
            ? Number(oldProduct.respiration_heat_rate)
            : 0.01;
      }
      if (
        nextProduct.ideal_temp_min != null &&
        nextProduct.ideal_temp_max != null &&
        Number(nextProduct.ideal_temp_min) > Number(nextProduct.ideal_temp_max)
      ) {
        nextProduct.ideal_temp_min = oldProduct.ideal_temp_min ?? nextProduct.ideal_temp_max;
        nextProduct.ideal_temp_max = oldProduct.ideal_temp_max ?? nextProduct.ideal_temp_min;
      }
      if (
        nextProduct.loading_temp != null &&
        nextProduct.ideal_temp_min != null &&
        nextProduct.ideal_temp_max != null
      ) {
        const lo = Number(nextProduct.ideal_temp_min);
        const hi = Number(nextProduct.ideal_temp_max);
        const lt = Number(nextProduct.loading_temp);
        if (Number.isFinite(lo) && Number.isFinite(hi) && Number.isFinite(lt)) {
          nextProduct.loading_temp = Math.min(hi, Math.max(lo, lt));
        }
      }

      // perform update
      const merged = Object.assign({}, oldProduct, nextProduct);
      mockDb.products[idx] = merged;

      const data = merged;

      const trackedFields = [
        { key: "name", label: "Name", type: "text" },
        { key: "category", label: "Category", type: "text" },
        { key: "unit", label: "Unit", type: "text" },
        { key: "purchase_price", label: "Purchase Price", type: "number" },
        { key: "current_price", label: "Current Price", type: "number" },
        { key: "max_shelf_hours", label: "Shelf Life (Hours)", type: "number" },
        { key: "ideal_temp_min", label: "Temp Min (C)", type: "number" },
        { key: "ideal_temp_max", label: "Temp Max (C)", type: "number" },
        { key: "is_seasonal", label: "Seasonal", type: "bool" },
        { key: "is_active", label: "Active", type: "bool" }
      ];

      const infoEvents = [];
      for (const f of trackedFields) {
        let before = oldProduct[f.key];
        let after = data[f.key];
        if (f.type === "number") {
          before = before == null || before === "" ? null : Number(before);
          after = after == null || after === "" ? null : Number(after);
        } else if (f.type === "bool") {
          before = Boolean(before);
          after = Boolean(after);
        }
        if (!sameValue(before, after)) {
          infoEvents.push({
            event_type: "PRODUCT_UPDATED",
            severity: "INFO",
            description: `FIELD_CHANGED | Product: ${data.name} | ${f.label} | ${fmtAuditValue(before)} -> ${fmtAuditValue(after)}`
          });
        }
      }
      if (infoEvents.length) {
        await Promise.all(infoEvents.map(ev => logProvenance(ev)));
      }

      const oldStock = oldProduct.stock_quantity == null ? null : Number(oldProduct.stock_quantity);
      const newStock = data.stock_quantity == null ? null : Number(data.stock_quantity);
      if (!sameValue(oldStock, newStock)) {
        const delta = (newStock ?? 0) - (oldStock ?? 0);
        const sign = delta > 0 ? "+" : "";
        await logProvenance({
          event_type: "PRODUCT_UPDATED",
          severity: "INFO",
          description: `STOCK_CHANGED | Product: ${data.name} | Old: ${fmtAuditValue(oldStock)} -> New: ${fmtAuditValue(newStock)} | Delta: ${sign}${delta}`
        });
      }

      return send(res, data, null);
    } catch (e) { return send(res, null, e); }
  }

  const { data: oldProduct, error: oldError } = await supabase
    .from("product")
    .select("*")
    .eq("product_id", productId)
    .single();

  if (oldError) return send(res, null, oldError);

  const toNumOr = (v, fallback) => {
    if (v === undefined || v === null || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const toNullableNum = (v, fallback) => {
    if (v === undefined) return fallback;
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const nextProduct = {
    name: b.name === undefined ? oldProduct.name : String(b.name || "").trim(),
    category: b.category === undefined ? oldProduct.category : b.category,
    unit: b.unit === undefined ? oldProduct.unit : b.unit,
    purchase_price: toNumOr(b.purchase_price, oldProduct.purchase_price),
    current_price: toNumOr(b.current_price, oldProduct.current_price),
    stock_quantity: Math.max(0, toNumOr(b.stock_quantity, oldProduct.stock_quantity)),
    ideal_temp_min: toNullableNum(b.ideal_temp_min, oldProduct.ideal_temp_min),
    ideal_temp_max: toNullableNum(b.ideal_temp_max, oldProduct.ideal_temp_max),
    max_shelf_hours: toNullableNum(b.max_shelf_hours, oldProduct.max_shelf_hours),
    specific_heat: toNullableNum(b.specific_heat, oldProduct.specific_heat),
    loading_temp: toNullableNum(b.loading_temp, oldProduct.loading_temp),
    respiration_heat_rate: toNullableNum(b.respiration_heat_rate, oldProduct.respiration_heat_rate),
    is_seasonal: b.is_seasonal === undefined ? oldProduct.is_seasonal : Boolean(b.is_seasonal),
    is_active: b.is_active === undefined ? oldProduct.is_active : Boolean(b.is_active)
  };

  // Keep values inside common product CHECK boundaries so stock-only edits do not fail.
  if (!Number.isFinite(nextProduct.purchase_price) || nextProduct.purchase_price <= 0) {
    nextProduct.purchase_price = Number(oldProduct.purchase_price || 1);
  }
  if (!Number.isFinite(nextProduct.current_price) || nextProduct.current_price <= 0) {
    nextProduct.current_price = Number(oldProduct.current_price || nextProduct.purchase_price);
  }
  if (nextProduct.current_price < nextProduct.purchase_price) {
    nextProduct.current_price = nextProduct.purchase_price;
  }
  const allowedCategories = new Set(["Vegetable", "Fruit", "Fish", "Meat", "Dairy", "Grain"]);
  if (!allowedCategories.has(String(nextProduct.category || ""))) {
    nextProduct.category = allowedCategories.has(String(oldProduct.category || "")) ? oldProduct.category : "Vegetable";
  }
  const allowedUnits = new Set(["KG", "LITRE", "PCS"]);
  if (!allowedUnits.has(String(nextProduct.unit || ""))) {
    nextProduct.unit = allowedUnits.has(String(oldProduct.unit || "")) ? oldProduct.unit : "KG";
  }
  if (!String(nextProduct.name || "").trim()) {
    nextProduct.name = String(oldProduct.name || "Product");
  }
  if (nextProduct.max_shelf_hours != null && Number(nextProduct.max_shelf_hours) <= 0) {
    nextProduct.max_shelf_hours = oldProduct.max_shelf_hours ?? null;
  }
  if (nextProduct.specific_heat != null && Number(nextProduct.specific_heat) <= 0) {
    nextProduct.specific_heat = oldProduct.specific_heat && Number(oldProduct.specific_heat) > 0
      ? Number(oldProduct.specific_heat)
      : null;
  }
  if (nextProduct.respiration_heat_rate != null && Number(nextProduct.respiration_heat_rate) <= 0) {
    nextProduct.respiration_heat_rate =
      oldProduct.respiration_heat_rate && Number(oldProduct.respiration_heat_rate) > 0
        ? Number(oldProduct.respiration_heat_rate)
        : 0.01;
  }
  if (
    nextProduct.ideal_temp_min != null &&
    nextProduct.ideal_temp_max != null &&
    Number(nextProduct.ideal_temp_min) > Number(nextProduct.ideal_temp_max)
  ) {
    nextProduct.ideal_temp_min = oldProduct.ideal_temp_min ?? nextProduct.ideal_temp_max;
    nextProduct.ideal_temp_max = oldProduct.ideal_temp_max ?? nextProduct.ideal_temp_min;
  }
  if (
    nextProduct.loading_temp != null &&
    nextProduct.ideal_temp_min != null &&
    nextProduct.ideal_temp_max != null
  ) {
    const lo = Number(nextProduct.ideal_temp_min);
    const hi = Number(nextProduct.ideal_temp_max);
    const lt = Number(nextProduct.loading_temp);
    if (Number.isFinite(lo) && Number.isFinite(hi) && Number.isFinite(lt)) {
      nextProduct.loading_temp = Math.min(hi, Math.max(lo, lt));
    }
  }

  const { data, error } = await supabase
    .from("product")
    .update(nextProduct)
    .eq("product_id", productId)
    .select()
    .single();

  if (!error && data) {
      try { console.log(`[audit] Product updated handler: product=${data.name} id=${data.product_id}`); } catch(_){}
    const trackedFields = [
      { key: "name", label: "Name", type: "text" },
      { key: "category", label: "Category", type: "text" },
      { key: "unit", label: "Unit", type: "text" },
      { key: "purchase_price", label: "Purchase Price", type: "number" },
      { key: "current_price", label: "Current Price", type: "number" },
      { key: "max_shelf_hours", label: "Shelf Life (Hours)", type: "number" },
      { key: "ideal_temp_min", label: "Temp Min (C)", type: "number" },
      { key: "ideal_temp_max", label: "Temp Max (C)", type: "number" },
      { key: "is_seasonal", label: "Seasonal", type: "bool" },
      { key: "is_active", label: "Active", type: "bool" }
    ];

    const infoEvents = [];

    for (const f of trackedFields) {
      let before = oldProduct[f.key];
      let after = data[f.key];

      if (f.type === "number") {
        before = before == null || before === "" ? null : Number(before);
        after = after == null || after === "" ? null : Number(after);
      } else if (f.type === "bool") {
        before = Boolean(before);
        after = Boolean(after);
      }

      if (!sameValue(before, after)) {
        infoEvents.push({
          event_type: "PRODUCT_UPDATED",
          severity: "INFO",
          description: `FIELD_CHANGED | Product: ${data.name} | ${f.label} | ${fmtAuditValue(before)} -> ${fmtAuditValue(after)}`
        });
      }
    }

    if (infoEvents.length) {
      try {
        console.log(`[audit] Detected ${infoEvents.length} info changes for ${data.name}:`, infoEvents.map(e=>e.description));
      } catch(_){}
      try {
        await Promise.all(infoEvents.map(async (ev) => {
          try {
            await logProvenance(ev);
          } catch (le) {
            console.warn('[audit][logProvenance][err]', le?.message || le);
          }
        }));
      } catch (e) {
        console.warn('[audit][infoEvents][promiseAllErr]', e?.message || e);
      }
    } else {
      try { console.log(`[audit] No info field changes detected for ${data.name}`); } catch(_){}
    }

    const oldStock = oldProduct.stock_quantity == null ? null : Number(oldProduct.stock_quantity);
    const newStock = data.stock_quantity == null ? null : Number(data.stock_quantity);
    if (!sameValue(oldStock, newStock)) {
      const delta = (newStock ?? 0) - (oldStock ?? 0);
      const sign = delta > 0 ? "+" : "";
      await logProvenance({
        event_type: "PRODUCT_UPDATED",
        severity: "INFO",
        description: `STOCK_CHANGED | Product: ${data.name} | Old: ${fmtAuditValue(oldStock)} -> New: ${fmtAuditValue(newStock)} | Delta: ${sign}${delta}`
      });
    }
  }

  send(res, data, error);
});
app.delete("/api/products/:id", async (req, res) => {
  const productId = req.params.id;
  let productName = productId;

  const { data: productRow, error: productError } = await supabase
    .from("product")
    .select("name")
    .eq("product_id", productId)
    .single();

  if (!productError && productRow?.name) {
    productName = productRow.name;
  } else if (productError) {
    console.warn("[product-delete][name-fetch]", productError.message);
  }

  let adjustmentNotes = [];
  let hasWarehouseStock = false;

  const { data: shipmentRows, error: shipmentError } = await supabase
    .from("shipment")
    .select("shipment_id, warehouse_id, quantity, status")
    .eq("product_id", productId)
    .order("shipment_id", { ascending: true });

  if (shipmentError) {
    console.warn("[product-delete][shipment-fetch]", shipmentError.message);
  } else {
    const grouped = new Map();
    const shipmentIds = [];

    for (const row of shipmentRows || []) {
      shipmentIds.push(row.shipment_id);

      if (row.status !== "IN_WAREHOUSE" || !row.warehouse_id) {
        continue;
      }

      const wid = row.warehouse_id;
      const qty = Number(row.quantity || 0);
      grouped.set(wid, (grouped.get(wid) || 0) + qty);
    }

    hasWarehouseStock = grouped.size > 0;

    for (const [warehouseId, totalQty] of grouped.entries()) {
      const { data: wh, error: whError } = await supabase
        .from("warehouse")
        .select("name, current_load_kg")
        .eq("warehouse_id", warehouseId)
        .single();

      if (whError || !wh) {
        console.warn("[product-delete][warehouse-fetch]", warehouseId, whError?.message || "Warehouse not found");
        continue;
      }

      const currentLoad = Number(wh.current_load_kg || 0);
      const newLoad = Math.max(0, currentLoad - Number(totalQty || 0));

      const { error: updateError } = await supabase
        .from("warehouse")
        .update({ current_load_kg: newLoad })
        .eq("warehouse_id", warehouseId);

      if (updateError) {
        console.warn("[product-delete][warehouse-update]", warehouseId, updateError.message);
        continue;
      }

      adjustmentNotes.push(`${wh.name || warehouseId} -${Number(totalQty || 0)}kg`);
    }

    if (shipmentIds.length) {
      const { error: spoilageDeleteError } = await supabase
        .from("food_spoilage")
        .delete()
        .in("shipment_id", shipmentIds);

      if (spoilageDeleteError) {
        console.warn("[product-delete][spoilage-delete]", spoilageDeleteError.message);
      }

      const { error: shipmentDeleteError } = await supabase
        .from("shipment")
        .delete()
        .in("shipment_id", shipmentIds);

      if (shipmentDeleteError) {
        console.warn("[product-delete][shipment-delete]", shipmentDeleteError.message);
      }
    }
  }

  const { error: auditDeleteError } = await supabase
    .from("audit_price_change")
    .delete()
    .eq("product_id", productId);

  if (auditDeleteError) {
    console.warn("[product-delete][audit-price-delete]", auditDeleteError.message);
  }

  const { error } = await supabase
    .from("product")
    .delete()
    .eq("product_id", productId);

  if (error) return send(res, null, error);

  const adjustmentText = !hasWarehouseStock
    ? "No warehouse stock found"
    : adjustmentNotes.length
      ? `Warehouse load adjusted: ${adjustmentNotes.join(", ")}`
      : "Warehouse stock found; adjustment attempted with warnings";

  await logProvenance({ event_type:"PRODUCT_DELETED", severity:"WARNING",
    description:`Product deleted: ${productName} | ${adjustmentText}` });
  res.json({ success: true });
});

// â”€â”€ Warehouses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/warehouses", async (req, res) => {
  const { data, error } = await supabase
    .from("warehouse")
    .select("*, district:district_id(name)")
    .order("name");

  send(res, data, error);
});

app.post("/api/warehouses", async (req, res) => {
  const b = req.body;

  const { data, error } = await supabase
    .from("warehouse")
    .insert({
      name: b.name,
      district_id: b.district_id,
      capacity_kg: b.capacity_kg,
      rent_per_day: b.rent_per_day,
      temp_min: b.temp_min || null,
      temp_max: b.temp_max || null,
      manager_name: b.manager_name || null,
      manager_phone: b.manager_phone || null,
      is_active: b.is_active !== false
    })
    .select()
    .single();

  if (error) return send(res, null, error);
  await logProvenance({ event_type:"WAREHOUSE_CREATED", severity:"INFO",
    description:`Warehouse created: ${data.name} | Capacity: ${data.capacity_kg}kg | Rent: à§³${data.rent_per_day}/day | Temp: ${data.temp_min??'â€”'}Â°Câ€“${data.temp_max??'â€”'}Â°C` });
  res.status(201).json(data);
});

app.put("/api/warehouses/:id", async (req, res) => {
  const b = req.body;

  const { data, error } = await supabase
    .from("warehouse")
    .update({
      name: b.name,
      district_id: b.district_id,
      capacity_kg: b.capacity_kg,
      rent_per_day: b.rent_per_day,
      temp_min: b.temp_min || null,
      temp_max: b.temp_max || null,
      manager_name: b.manager_name || null,
      manager_phone: b.manager_phone || null,
      is_active: b.is_active
    })
    .eq("warehouse_id", req.params.id)
    .select()
    .single();

  if (!error && data) await logProvenance({ event_type:"WAREHOUSE_UPDATED", severity:"INFO",
    description:`Warehouse updated: ${data.name} | Load: ${data.current_load_kg||0}kg / ${data.capacity_kg}kg | Active: ${data.is_active}` });
  send(res, data, error);
});

// â”€â”€ Vehicles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/vehicles", async (req, res) => {
  const { data: vehicles, error } = await supabase
    .from("vehicle")
    .select("*")
    .order("plate_no");

  if (error) return send(res, null, error);

  const { data: active } = await supabase
    .from("shipment")
    .select("vehicle_id, shipment_id, status, product:product_id(name), dest_district:dest_district_id(name)")
    .in("status", ["PENDING", "IN_TRANSIT", "IN_WAREHOUSE", "DELAYED"])
    .not("vehicle_id", "is", null);

  const busyMap = {};
  const statusPriority = { IN_TRANSIT: 4, PENDING: 3, DELAYED: 2, IN_WAREHOUSE: 1 };

  (active || []).forEach(s => {
    const existing = busyMap[s.vehicle_id];
    if (!existing || (statusPriority[s.status] || 0) > (statusPriority[existing.status] || 0)) {
      busyMap[s.vehicle_id] = {
        delivering: s.product?.name || "?",
        to:         s.dest_district?.name || "?",
        status:     s.status
      };
    }
  });

  res.json(
    vehicles.map(v => ({
      ...v,
      _busy: busyMap[v.vehicle_id] || null
    }))
  );
});

app.post("/api/vehicles", async (req, res) => {
  const b = req.body;

  const { data, error } = await supabase
    .from("vehicle")
    .insert({
      plate_no: b.plate_no,
      vehicle_type: b.vehicle_type || null,
      cooling_unit: b.cooling_unit || null,
      capacity_kg: b.capacity_kg,
      min_temp_capacity: b.min_temp_capacity || null,
      cooling_capacity_btu: b.cooling_capacity_btu || null,
      last_service_date: b.last_service_date || null,
      is_operational: b.is_operational !== false
    })
    .select()
    .single();

  if (error) return send(res, null, error);
  await logProvenance({ event_type:"VEHICLE_CREATED", severity:"INFO",
    description:`Vehicle created: ${data.plate_no} (${data.vehicle_type||'â€”'}) | Capacity: ${data.capacity_kg}kg | BTU: ${data.cooling_capacity_btu}` });
  res.status(201).json(data);
});

app.put("/api/vehicles/:id", async (req, res) => {
  const b = req.body;

  const { data, error } = await supabase
    .from("vehicle")
    .update({
      plate_no: b.plate_no,
      vehicle_type: b.vehicle_type || null,
      cooling_unit: b.cooling_unit || null,
      capacity_kg: b.capacity_kg,
      min_temp_capacity: b.min_temp_capacity || null,
      cooling_capacity_btu: b.cooling_capacity_btu || null,
      last_service_date: b.last_service_date || null,
      is_operational: b.is_operational
    })
    .eq("vehicle_id", req.params.id)
    .select()
    .single();

  if (!error && data) await logProvenance({ event_type:"VEHICLE_UPDATED", severity:"INFO",
    description:`Vehicle updated: ${data.plate_no} | Operational: ${data.is_operational} | Last service: ${data.last_service_date||'â€”'}` });
  send(res, data, error);
});

app.delete("/api/vehicles/:id", async (req, res) => {
  const { error } = await supabase
    .from("vehicle")
    .delete()
    .eq("vehicle_id", req.params.id);

  if (error) return send(res, null, error);
  await logProvenance({ event_type:"VEHICLE_DELETED", severity:"WARNING",
    description:`Vehicle deleted: ID ${req.params.id}` });
  res.json({ success: true });
});

// â”€â”€ Shipments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SHIP_SEL = `*, product:product_id(name,category,unit,stock_quantity),
  farmer:farmer_id(name, district:district_id(name)),
  vehicle:vehicle_id(plate_no,vehicle_type),
  warehouse:warehouse_id(name),
  source_district:source_district_id(name),
  dest_district:dest_district_id(name)`;

app.get("/api/shipments", async (req, res) => {
  let q = supabase
    .from("shipment")
    .select(SHIP_SEL)
    .order("start_time", { ascending: false })
    .limit(300);

  if (req.query.status) q = q.eq("status", req.query.status);

  const { data, error } = await q;
  send(res, data, error);
});

app.get("/api/shipments/active", async (req, res) => {
  const { data, error } = await supabase
    .from("shipment")
    .select(SHIP_SEL)
    .in("status", ["PENDING", "IN_TRANSIT", "IN_WAREHOUSE", "DELAYED"])
    .order("estimated_arrival", { ascending: true, nullsFirst: false });

  send(res, data, error);
});

app.post("/api/shipments", async (req, res) => {
  const b = req.body;

  // source_district_id and dest_district_id are auto-filled by DB triggers
  // (source from farmer, dest from warehouse). Only pass if explicitly provided.
  const insert = {
    product_id:   b.product_id,
    farmer_id:    b.farmer_id,
    vehicle_id:   b.vehicle_id   || null,
    warehouse_id: b.warehouse_id || null,
    quantity:     b.quantity,
    start_time:   b.start_time   || new Date().toISOString(),
    estimated_arrival: b.estimated_arrival || null,
    transport_cost:    b.transport_cost    || 0,
    notes:             b.notes             || null
  };

  // Only include district IDs if the caller explicitly sent them
  if (b.source_district_id) insert.source_district_id = b.source_district_id;
  if (b.dest_district_id)   insert.dest_district_id   = b.dest_district_id;
  if (b.order_id)           insert.order_id            = b.order_id;
  if (b.status)             insert.status              = b.status;
  if (b.actual_arrival)     insert.actual_arrival      = b.actual_arrival;

  const { data, error } = await supabase
    .from("shipment")
    .insert(insert)
    .select()
    .single();

  if (error) return send(res, null, error);
  await logProvenance({ event_type:"SHIPMENT_CREATED", severity:"INFO",
    shipment_id: data.shipment_id,
    description:`Shipment created: product ${data.product_id} | Qty: ${data.quantity} | ${data.source_district_id}â†’${data.dest_district_id} | Status: ${data.status}` });
  res.status(201).json(data);
});

app.patch("/api/shipments/:id/status", async (req, res) => {
  const { status, actual_arrival, days_in_warehouse } = req.body;

  const { data: current } = await supabase
    .from("shipment")
    .select("status, warehouse_id, quantity")
    .eq("shipment_id", req.params.id)
    .single();

  const update = { status };

  if (actual_arrival) update.actual_arrival = actual_arrival;
  if (days_in_warehouse) update.days_in_warehouse = days_in_warehouse;

  const { data, error } = await supabase
    .from("shipment")
    .update(update)
    .eq("shipment_id", req.params.id)
    .select()
    .single();

  if (error) return send(res, null, error);

  if (current && current.warehouse_id) {
    const oldStatus = current.status;
    const qty = Number(current.quantity);
    const warehouseId = current.warehouse_id;

    const { data: wh } = await supabase
      .from("warehouse")
      .select("current_load_kg, capacity_kg")
      .eq("warehouse_id", warehouseId)
      .single();

    if (wh) {
      let newLoad = null;

      if (status === "IN_WAREHOUSE" && oldStatus !== "IN_WAREHOUSE") {
        newLoad = (wh.current_load_kg || 0) + qty;
      } else if (["DELIVERED", "PARTIALLY_DELIVERED"].includes(status)) {
        if (oldStatus === "IN_WAREHOUSE") {
          newLoad = Math.max(0, (wh.current_load_kg || 0) - qty);
        } else {
          newLoad = (wh.current_load_kg || 0) + qty;
        }
      } else if (["SPOILED", "CANCELLED"].includes(status) && oldStatus === "IN_WAREHOUSE") {
        newLoad = Math.max(0, (wh.current_load_kg || 0) - qty);
      }

      if (newLoad !== null) {
        const cap = wh.capacity_kg;

        await supabase
          .from("warehouse")
          .update({
            current_load_kg: cap ? Math.min(newLoad, cap) : newLoad
          })
          .eq("warehouse_id", warehouseId);
      }
    }
  }

  // â”€â”€ AUTO-SYNC ORDER STATUS based on all shipments in the order â”€â”€
  try {
    // Get order_id for this shipment
    const { data: shipInfo } = await supabase
      .from("shipment")
      .select("order_id")
      .eq("shipment_id", req.params.id)
      .single();

    if (shipInfo?.order_id) {
      // Get statuses of ALL shipments linked to this order
      const { data: siblings } = await supabase
        .from("shipment")
        .select("status")
        .eq("order_id", shipInfo.order_id);

      const statuses = (siblings || []).map(s => s.status);
      let newOrderStatus = null;

      if (statuses.length === 0) {
        // no shipments
      } else if (statuses.every(s => s === "DELIVERED")) {
        newOrderStatus = "DELIVERED";
      } else if (statuses.every(s => s === "CANCELLED")) {
        newOrderStatus = "CANCELLED";
      } else if (statuses.every(s => ["DELIVERED","CANCELLED","SPOILED"].includes(s))) {
        newOrderStatus = "PARTIALLY_DELIVERED";
      } else if (statuses.some(s => s === "PARTIALLY_DELIVERED")) {
        newOrderStatus = "PARTIALLY_DELIVERED";
      } else if (statuses.some(s => s === "DELAYED")) {
        newOrderStatus = "DELAYED";
      } else if (statuses.some(s => s === "IN_WAREHOUSE")) {
        newOrderStatus = "IN_TRANSIT";
      } else if (statuses.some(s => s === "IN_TRANSIT")) {
        newOrderStatus = "IN_TRANSIT";
      } else if (statuses.some(s => s === "PENDING")) {
        newOrderStatus = "CONFIRMED";
      }

      if (newOrderStatus) {
        await supabase
          .from("purchase_order")
          .update({ order_status: newOrderStatus })
          .eq("order_id", shipInfo.order_id);
      }
    }
  } catch (syncErr) {
    console.warn("[order-sync]", syncErr.message);
  }

  res.json(data);
});

// â”€â”€ Weather Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/weather-events", async (req, res) => {
  const { data, error } = await supabase
    .from("weather_event")
    .select("*, district:district_id(name)")
    .order("started_at", { ascending: false })
    .limit(200);

  send(res, data, error);
});

app.post("/api/weather-events", async (req, res) => {
  const b = req.body;

  const insert = {
    district_id: b.district_id,
    event_type: b.event_type,
    severity_level: b.severity_level,
    delay_impact_hours: Number(b.delay_impact_hours) || 0,
    started_at: b.started_at
  };

  if (b.description) insert.description = b.description;
  if (b.ended_at) insert.ended_at = b.ended_at;

  const { data, error } = await supabase
    .from("weather_event")
    .insert(insert)
    .select()
    .single();

  if (!error && data) await logProvenance({ event_type:"WEATHER_CREATED", severity: data.severity_level==="HIGH"?"CRITICAL":data.severity_level==="MEDIUM"?"WARNING":"INFO",
    weather_event_id: data.event_id,
    description:`Weather event logged: ${data.event_type} in district ${data.district_id} | Severity: ${data.severity_level} | Delay: ${data.delay_impact_hours}h` });
  send(res, data, error);
});

app.put("/api/weather-events/:id", async (req, res) => {
  const b = req.body;

  const update = {
    district_id: b.district_id,
    event_type: b.event_type,
    severity_level: b.severity_level,
    delay_impact_hours: b.delay_impact_hours,
    description: b.description || null,
    ended_at: b.ended_at || null
  };

  const { data, error } = await supabase
    .from("weather_event")
    .update(update)
    .eq("event_id", req.params.id)
    .select()
    .single();

  send(res, data, error);
});

// â”€â”€ Weather Cache (live conditions from Open-Meteo) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/* WMO weather code â†’ human text */
function wmoText(code) {
  const map = {
    0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
    45:'Fog', 48:'Icy fog',
    51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle',
    56:'Freezing drizzle', 57:'Heavy freezing drizzle',
    61:'Light rain', 63:'Rain', 65:'Heavy rain',
    66:'Freezing rain', 67:'Heavy freezing rain',
    71:'Light snow', 73:'Snow', 75:'Heavy snow', 77:'Snow grains',
    80:'Light showers', 81:'Showers', 82:'Heavy showers',
    85:'Snow showers', 86:'Heavy snow showers',
    95:'Thunderstorm', 96:'Thunderstorm & hail', 99:'Heavy thunderstorm & hail'
  };
  return map[code] ?? `Code ${code}`;
}

/* GET cached weather for all districts */
app.get("/api/weather-cache", async (req, res) => {
  const { data, error } = await supabase
    .from("weather_cache")
    .select("*, district:district_id(name, division, flood_risk, latitude, longitude)")
    .order("fetched_at", { ascending: false });
  send(res, data, error);
});

/* POST /api/weather-cache/refresh
   Fetches live weather from Open-Meteo for every district that has coordinates,
   then upserts into weather_cache (one row per district).                       */
app.post("/api/weather-cache/refresh", async (req, res) => {
  // Load all districts that have coordinates
  const { data: districts, error: dErr } = await supabase
    .from("district")
    .select("district_id, name, latitude, longitude")
    .not("latitude",  "is", null)
    .not("longitude", "is", null);

  if (dErr) return send(res, null, dErr);
  if (!districts || !districts.length)
    return res.json({ ok: true, updated: 0, message: "No districts with coordinates" });

  const results = [];
  const errors  = [];

  for (const d of districts) {
    try {
      const params = new URLSearchParams({
        latitude:  d.latitude,
        longitude: d.longitude,
        current: [
          "temperature_2m","apparent_temperature","relative_humidity_2m",
          "precipitation","rain","cloud_cover","wind_speed_10m",
          "wind_direction_10m","uv_index","visibility","weather_code","is_day"
        ].join(","),
        timezone: "auto",
        wind_speed_unit: "kmh"
      });

      const r   = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      const json = await r.json();
      const c   = json.current;

      if (!c) { errors.push(`${d.name}: no current data`); continue; }

      const row = {
        district_id:        d.district_id,
        temp_celsius:       c.temperature_2m,
        feels_like_celsius: c.apparent_temperature,
        humidity_pct:       c.relative_humidity_2m,
        precipitation_mm:   c.precipitation   ?? 0,
        rain_mm:            c.rain            ?? 0,
        cloud_cover_pct:    c.cloud_cover,
        wind_speed_kmh:     c.wind_speed_10m,
        wind_direction_deg: c.wind_direction_10m,
        uv_index:           c.uv_index,
        visibility_km:      c.visibility != null ? +(c.visibility / 1000).toFixed(1) : null,
        weather_code:       c.weather_code,
        condition_text:     wmoText(c.weather_code),
        is_day:             c.is_day === 1,
        fetched_at:         new Date().toISOString()
      };

      const { error: uErr } = await supabase
        .from("weather_cache")
        .upsert(row, { onConflict: "district_id" });

      if (uErr) errors.push(`${d.name}: ${uErr.message}`);
      else      results.push(d.name);

    } catch (err) {
      errors.push(`${d.name}: ${err.message}`);
    }
  }

  res.json({
    ok:      errors.length === 0,
    updated: results.length,
    districts: results,
    errors
  });
});

// â”€â”€ Orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/orders", async (req, res) => {
  const { data, error } = await supabase
    .from("purchase_order")
    .select(`
      *,
      order_item(
        item_id, quantity, agreed_price_per_unit, total_price, shipment_id,
        product:product_id(name, category, unit),
        farmer:farmer_id(name, phone),
        source_district:source_district_id(name),
        shipment:shipment_id(
          shipment_id, status, estimated_arrival, actual_arrival, quantity,
          dest_district:dest_district_id(name),
          vehicle:vehicle_id(plate_no)
        )
      )
    `)
    .order("ordered_at", { ascending: false })
    .limit(200);

  send(res, data, error);
});

app.post("/api/orders", async (req, res) => {
  const b = req.body;

  const insert = {
    agreed_total: 0,
    notes: b.notes || null
  };

  if (b.ordered_at) insert.ordered_at = b.ordered_at;
  if (b.order_status) insert.order_status = b.order_status;

  const { data, error } = await supabase
    .from("purchase_order")
    .insert(insert)
    .select()
    .single();

  if (error) return send(res, null, error);
  await logProvenance({ event_type:"ORDER_CREATED", severity:"INFO",
    order_id: data.order_id,
    description:`Order created: ${data.order_status} | Notes: ${data.notes||'â€”'} | Total: à§³${data.agreed_total||0}` });
  res.status(201).json(data);
});

app.patch("/api/orders/:id/status", async (req, res) => {
  const { order_status } = req.body;

  const { data, error } = await supabase
    .from("purchase_order")
    .update({ order_status })
    .eq("order_id", req.params.id)
    .select()
    .single();

  send(res, data, error);
});

app.post("/api/orders/:id/items", async (req, res) => {
  const b = req.body;

  // source_district_id is auto-filled by trigger from farmer's district
  const insert = {
    order_id:              req.params.id,
    product_id:            b.product_id,
    farmer_id:             b.farmer_id,
    quantity:              b.quantity,
    agreed_price_per_unit: b.agreed_price_per_unit
  };

  // Only pass source_district_id if caller explicitly sends it
  if (b.source_district_id) insert.source_district_id = b.source_district_id;
  if (b.shipment_id)        insert.shipment_id        = b.shipment_id;

  const { data, error } = await supabase
    .from("order_item")
    .insert(insert)
    .select()
    .single();

  if (error) return send(res, null, error);
  await logProvenance({ event_type:"ORDER_ITEM_ADDED", severity:"INFO",
    order_id: req.params.id,
    description:`Order item added: product ${data.product_id} | Farmer ${data.farmer_id} | Qty: ${data.quantity} | Price: à§³${data.agreed_price_per_unit}/unit | Total: à§³${data.total_price}` });
  res.status(201).json(data);
});

app.patch("/api/orders/items/:itemId/link-shipment", async (req, res) => {
  const { shipment_id } = req.body;

  const { data, error } = await supabase
    .from("order_item")
    .update({ shipment_id })
    .eq("item_id", req.params.itemId)
    .select()
    .single();

  send(res, data, error);
});

app.delete("/api/orders/:id/items/:itemId", async (req, res) => {
  const { error } = await supabase
    .from("order_item")
    .delete()
    .eq("item_id", req.params.itemId);

  if (error) return send(res, null, error);
  await logProvenance({ event_type:"ORDER_ITEM_DELETED", severity:"WARNING",
    order_id: req.params.id,
    description:`Order item removed: item ID ${req.params.itemId} from order ${req.params.id}` });
  res.json({ success: true });
});

// â”€â”€ Monitoring Sensor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/monitoring", async (req, res) => {
  let q = supabase
    .from("monitoring_sensor")
    .select(`
      *,
      shipment:shipment_id(
        shipment_id, status, quantity,
        product:product_id(name, category, ideal_temp_max, specific_heat),
        farmer:farmer_id(name),
        vehicle:vehicle_id(plate_no, cooling_capacity_btu)
      )
    `)
    .order("recorded_at", { ascending: false })
    .limit(300);

  if (req.query.shipment_id) q = q.eq("shipment_id", req.query.shipment_id);
  if (req.query.breach === "true") q = q.eq("is_temp_breach", true);
  if (req.query.overloaded === "true") q = q.eq("is_overloaded", true);

  const { data, error } = await q;
  send(res, data, error);
});

app.post("/api/monitoring", async (req, res) => {
  const b = req.body;

  if (!b.shipment_id || b.ambient_temp == null || b.internal_temp == null) {
    return res.status(400).json({
      error: "shipment_id, ambient_temp and internal_temp are required"
    });
  }

  const { data, error } = await supabase
    .from("monitoring_sensor")
    .insert({
      shipment_id: b.shipment_id,
      ambient_temp: Number(b.ambient_temp),
      internal_temp: Number(b.internal_temp),
      humidity: b.humidity != null ? Number(b.humidity) : null,
      gps_lat: b.gps_lat != null ? Number(b.gps_lat) : null,
      gps_lng: b.gps_lng != null ? Number(b.gps_lng) : null
    })
    .select(`
      *,
      shipment:shipment_id(
        status,
        product:product_id(name, ideal_temp_max),
        farmer:farmer_id(name)
      )
    `)
    .single();

  if (error) return send(res, null, error);
  await logProvenance({ event_type:"SENSOR_LOGGED", severity: data.is_temp_breach?"WARNING":"INFO",
    shipment_id: data.shipment_id,
    description:`Sensor log: Ambient ${data.ambient_temp}Â°C | Internal ${data.internal_temp}Â°C | Humidity ${data.humidity??'â€”'}% | Heat: ${data.calculated_heat_load_kw??'â€”'}kW | Breach: ${data.is_temp_breach?'YES':'NO'} | Overload: ${data.is_overloaded?'YES':'NO'}` });
  res.status(201).json(data);
});

app.get("/api/monitoring/stats/:shipmentId", async (req, res) => {
  const id = req.params.shipmentId;

  const { data, error } = await supabase
    .from("monitoring_sensor")
    .select("ambient_temp, internal_temp, calculated_heat_load_kw, load_ratio, is_temp_breach, is_overloaded")
    .eq("shipment_id", id);

  if (error) return send(res, null, error);

  const rows = data || [];
  const breaches  = rows.filter(r => r.is_temp_breach).length;
  const overloads = rows.filter(r => r.is_overloaded).length;

  const avgAmbient = rows.length
    ? (rows.reduce((s, r) => s + Number(r.ambient_temp), 0) / rows.length).toFixed(1)
    : null;

  const avgInternal = rows.length
    ? (rows.reduce((s, r) => s + Number(r.internal_temp), 0) / rows.length).toFixed(1)
    : null;

  const maxHeatLoadKw = rows.length
    ? Math.max(...rows.map(r => Number(r.calculated_heat_load_kw || 0)))
    : null;

  const maxLoadRatio = rows.length
    ? Math.max(...rows.map(r => Number(r.load_ratio || 0)))
    : null;

  res.json({
    total_readings:    rows.length,
    temp_breaches:     breaches,
    overloads,
    avg_ambient_temp:  avgAmbient,
    avg_internal_temp: avgInternal,
    max_heat_load_kw:  maxHeatLoadKw,
    max_load_ratio:    maxLoadRatio
  });
});

// â”€â”€ Spoilage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/spoilage", async (req, res) => {
  const { data, error } = await supabase
    .from("food_spoilage")
    .select("*, shipment:shipment_id(product:product_id(name), farmer:farmer_id(name))")
    .order("detected_at", { ascending: false })
    .limit(200);

  send(res, data, error);
});

app.post("/api/spoilage", async (req, res) => {
  const b = req.body;

  const { data, error } = await supabase
    .from("food_spoilage")
    .insert({
      shipment_id: b.shipment_id,
      qty_sent: b.qty_sent,
      qty_received: b.qty_received,
      qty_spoiled: b.qty_spoiled,
      spoilage_reason: b.spoilage_reason || null,
      caused_by_heat_overload: b.caused_by_heat_overload || false,
      caused_by_delay: b.caused_by_delay || false
    })
    .select()
    .single();

  if (error) return send(res, null, error);
  await logProvenance({ event_type:"SPOILAGE_CREATED", severity: data.spoilage_pct>30?"CRITICAL":data.spoilage_pct>10?"WARNING":"INFO",
    shipment_id: data.shipment_id,
    description:`Spoilage reported: ${data.qty_spoiled}kg spoiled of ${data.qty_sent}kg sent (${data.spoilage_pct??'?'}%) | Loss: à§³${data.loss_amount??'?'} | Reason: ${data.spoilage_reason||'â€”'}` });
  res.status(201).json(data);
});

// â”€â”€ Provenance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/provenance", async (req, res) => {
  if (useMockDb) {
    let data = mockDb.provenance.slice();
    if (req.query.severity) data = data.filter(d => String(d.severity) === String(req.query.severity));
    data = data.slice(0, 300);
    return send(res, data, null);
  }

  let q = supabase
    .from("provenance_event")
    .select("*, shipment:shipment_id(product:product_id(name), farmer:farmer_id(name)), weather_event:weather_event_id(event_type, district:district_id(name))")
    .order("event_time", { ascending: false })
    .limit(300);

  if (req.query.severity) q = q.eq("severity", req.query.severity);

  const { data, error } = await q;
  send(res, data, error);
});

// â”€â”€ Price Audit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Uses v_price_history view â€” already joins product, farmer, district,
// weather context, AND all DELIVERY_PROFIT profit/loss columns.
app.get("/api/price-audit", async (req, res) => {
  let q = supabase
    .from("v_price_history")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(200);

  // Optional filters
  if (req.query.change_type)  q = q.eq("change_type",  req.query.change_type);
  if (req.query.price_source) q = q.eq("price_source", req.query.price_source);
  if (req.query.product_name) q = q.ilike("product_name", `%${req.query.product_name}%`);

  const { data, error } = await q;
  send(res, data, error);
});

app.get("/api/product-info-changes", async (req, res) => {
  if (useMockDb) {
    let data = (mockDb.provenance || []).filter(e => 
      e.event_type === "PRODUCT_UPDATED" && e.description && e.description.includes("FIELD_CHANGED")
    );
    if (req.query.product_name) data = data.filter(d => String(d.description || "").toLowerCase().includes(String(req.query.product_name || "").toLowerCase()));
    data = data.slice(0, 300);
    return send(res, data, null);
  }

  let q = supabase
    .from("provenance_event")
    .select("*")
    .eq("event_type", "PRODUCT_UPDATED")
    .ilike("description", "%FIELD_CHANGED%")
    .order("event_time", { ascending: false })
    .limit(300);

  if (req.query.product_name) q = q.ilike("description", `%${req.query.product_name}%`);

  const { data, error } = await q;
  send(res, data, error);
});

app.get("/api/stock-log", async (req, res) => {
  if (useMockDb) {
    let data = (mockDb.provenance || []).filter(e => 
      e.event_type === "PRODUCT_UPDATED" && e.description && e.description.includes("STOCK_CHANGED")
    );
    if (req.query.product_name) data = data.filter(d => String(d.description || "").toLowerCase().includes(String(req.query.product_name || "").toLowerCase()));
    data = data.slice(0, 300);
    return send(res, data, null);
  }

  let q = supabase
    .from("provenance_event")
    .select("*")
    .eq("event_type", "PRODUCT_UPDATED")
    .ilike("description", "%STOCK_CHANGED%")
    .order("event_time", { ascending: false })
    .limit(300);

  if (req.query.product_name) q = q.ilike("description", `%${req.query.product_name}%`);

  const { data, error } = await q;
  send(res, data, error);
});

// â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/dashboard", async (req, res) => {
  const [
    { data: shipments },
    { count: activeWeather },
    { count: criticalEvents },
    { data: spoilData },
    { count: lowStock }
  ] = await Promise.all([
    supabase.from("shipment").select("status, delay_hours"),
    supabase
      .from("weather_event")
      .select("event_id", { count: "exact", head: true })
      .is("ended_at", null),
    supabase
      .from("provenance_event")
      .select("event_id", { count: "exact", head: true })
      .eq("severity", "CRITICAL")
      .gte("event_time", new Date(Date.now() - 86400000).toISOString()),
    supabase.from("food_spoilage").select("loss_amount"),
    supabase
      .from("product")
      .select("product_id", { count: "exact", head: true })
      .lt("stock_quantity", 50)
      .eq("is_active", true)
  ]);

  const all = shipments || [];

  res.json({
    total_shipments: all.length,
    active_shipments: all.filter(s =>
      ["PENDING", "IN_TRANSIT", "IN_WAREHOUSE", "DELAYED"].includes(s.status)
    ).length,
    delayed_shipments: all.filter(s =>
      Number(s.delay_hours || 0) > 0 || s.status === "DELAYED"
    ).length,
    delivered_shipments: all.filter(s => s.status === "DELIVERED").length,
    spoiled_shipments: all.filter(s => s.status === "SPOILED").length,
    active_weather: activeWeather || 0,
    critical_events_24h: criticalEvents || 0,
    total_loss: (spoilData || []).reduce((s, r) => s + Number(r.loss_amount || 0), 0),
    low_stock: lowStock || 0
  });
});

// â”€â”€ Final Fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// API unknown route
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// Any other unknown page => login
app.use((req, res) => {
  res.redirect("/login");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`âœ… AgroMart http://localhost:${PORT}`));

