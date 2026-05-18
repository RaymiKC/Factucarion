import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── OpenAPI spec ──────────────────────────────────────────────────────────────
const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "FacturaPro API",
    version: "1.0.0",
    description: "REST API for the FacturaPro billing system. Use your Supabase anon key as the Bearer token.",
  },
  servers: [{ url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/api`, description: "Supabase Edge Function" }],
  components: {
    securitySchemes: {
      BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Supabase anon key or user JWT" },
    },
    parameters: {
      company_id: { name: "company_id", in: "query", required: false, schema: { type: "string", format: "uuid" }, description: "Filter by company UUID" },
      id: { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      limit: { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
      offset: { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    "/companies": {
      get: {
        tags: ["Companies"], summary: "List companies",
        parameters: [{ $ref: "#/components/parameters/limit" }, { $ref: "#/components/parameters/offset" }],
        responses: { "200": { description: "Array of companies" } },
      },
      post: {
        tags: ["Companies"], summary: "Create company",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, rnc: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, address: { type: "string" }, logo_url: { type: "string" } } } } } },
        responses: { "201": { description: "Created company" } },
      },
    },
    "/companies/{id}": {
      get: { tags: ["Companies"], summary: "Get company by ID", parameters: [{ $ref: "#/components/parameters/id" }], responses: { "200": { description: "Company object" } } },
      put: { tags: ["Companies"], summary: "Update company", parameters: [{ $ref: "#/components/parameters/id" }], requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { "200": { description: "Updated company" } } },
      delete: { tags: ["Companies"], summary: "Delete company", parameters: [{ $ref: "#/components/parameters/id" }], responses: { "200": { description: "Deleted" } } },
    },
    "/clients": {
      get: {
        tags: ["Clients"], summary: "List clients",
        parameters: [{ $ref: "#/components/parameters/company_id" }, { $ref: "#/components/parameters/limit" }, { $ref: "#/components/parameters/offset" }, { name: "search", in: "query", schema: { type: "string" }, description: "Search by name, email or RNC" }],
        responses: { "200": { description: "Array of clients" } },
      },
      post: {
        tags: ["Clients"], summary: "Create client",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["company_id", "name"], properties: { company_id: { type: "string", format: "uuid" }, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, rnc: { type: "string" }, address: { type: "string" }, client_type: { type: "string", enum: ["individual", "business"] } } } } } },
        responses: { "201": { description: "Created client" } },
      },
    },
    "/clients/{id}": {
      get: { tags: ["Clients"], summary: "Get client", parameters: [{ $ref: "#/components/parameters/id" }], responses: { "200": { description: "Client object" } } },
      put: { tags: ["Clients"], summary: "Update client", parameters: [{ $ref: "#/components/parameters/id" }], requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { "200": { description: "Updated client" } } },
      delete: { tags: ["Clients"], summary: "Deactivate client", parameters: [{ $ref: "#/components/parameters/id" }], responses: { "200": { description: "Deactivated" } } },
    },
    "/invoices": {
      get: {
        tags: ["Invoices"], summary: "List invoices",
        parameters: [{ $ref: "#/components/parameters/company_id" }, { $ref: "#/components/parameters/limit" }, { $ref: "#/components/parameters/offset" }, { name: "status", in: "query", schema: { type: "string", enum: ["draft", "sent", "paid", "partial", "overdue", "cancelled"] } }, { name: "client_id", in: "query", schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Array of invoices" } },
      },
      post: {
        tags: ["Invoices"], summary: "Create invoice",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["company_id", "client_id"], properties: { company_id: { type: "string", format: "uuid" }, client_id: { type: "string", format: "uuid" }, invoice_number: { type: "string" }, ncf: { type: "string" }, ncf_type: { type: "string" }, status: { type: "string", default: "draft" }, issue_date: { type: "string", format: "date" }, due_date: { type: "string", format: "date" }, subtotal: { type: "number" }, tax_amount: { type: "number" }, discount_amount: { type: "number" }, total: { type: "number" }, currency: { type: "string", default: "DOP" }, notes: { type: "string" }, items: { type: "array", items: { type: "object" } } } } } } },
        responses: { "201": { description: "Created invoice" } },
      },
    },
    "/invoices/{id}": {
      get: { tags: ["Invoices"], summary: "Get invoice", parameters: [{ $ref: "#/components/parameters/id" }], responses: { "200": { description: "Invoice with line items" } } },
      put: { tags: ["Invoices"], summary: "Update invoice", parameters: [{ $ref: "#/components/parameters/id" }], requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { "200": { description: "Updated invoice" } } },
      delete: { tags: ["Invoices"], summary: "Cancel invoice", parameters: [{ $ref: "#/components/parameters/id" }], responses: { "200": { description: "Cancelled" } } },
    },
    "/products": {
      get: {
        tags: ["Products"], summary: "List products/services",
        parameters: [{ $ref: "#/components/parameters/company_id" }, { $ref: "#/components/parameters/limit" }, { $ref: "#/components/parameters/offset" }, { name: "type", in: "query", schema: { type: "string", enum: ["product", "service"] } }],
        responses: { "200": { description: "Array of products" } },
      },
      post: {
        tags: ["Products"], summary: "Create product",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["company_id", "name", "unit_price"], properties: { company_id: { type: "string", format: "uuid" }, name: { type: "string" }, description: { type: "string" }, sku: { type: "string" }, type: { type: "string", enum: ["product", "service"] }, unit_price: { type: "number" }, tax_rate_id: { type: "string", format: "uuid" }, unit: { type: "string" } } } } } },
        responses: { "201": { description: "Created product" } },
      },
    },
    "/products/{id}": {
      get: { tags: ["Products"], summary: "Get product", parameters: [{ $ref: "#/components/parameters/id" }], responses: { "200": { description: "Product object" } } },
      put: { tags: ["Products"], summary: "Update product", parameters: [{ $ref: "#/components/parameters/id" }], requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { "200": { description: "Updated product" } } },
      delete: { tags: ["Products"], summary: "Deactivate product", parameters: [{ $ref: "#/components/parameters/id" }], responses: { "200": { description: "Deactivated" } } },
    },
    "/payments": {
      get: {
        tags: ["Payments"], summary: "List payment records",
        parameters: [{ $ref: "#/components/parameters/company_id" }, { $ref: "#/components/parameters/limit" }, { $ref: "#/components/parameters/offset" }, { name: "invoice_id", in: "query", schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Array of payment records" } },
      },
      post: {
        tags: ["Payments"], summary: "Record a payment",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["invoice_id", "amount", "payment_method", "payment_date"], properties: { invoice_id: { type: "string", format: "uuid" }, amount: { type: "number" }, payment_method: { type: "string", enum: ["cash", "transfer", "card", "cheque"] }, payment_date: { type: "string", format: "date" }, reference: { type: "string" }, notes: { type: "string" } } } } } },
        responses: { "201": { description: "Recorded payment" } },
      },
    },
    "/tax-rates": {
      get: {
        tags: ["Tax Rates"], summary: "List tax rates",
        parameters: [{ $ref: "#/components/parameters/company_id" }],
        responses: { "200": { description: "Array of tax rates" } },
      },
      post: {
        tags: ["Tax Rates"], summary: "Create tax rate",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["company_id", "name", "rate"], properties: { company_id: { type: "string", format: "uuid" }, name: { type: "string" }, rate: { type: "number" }, is_default: { type: "boolean" } } } } } },
        responses: { "201": { description: "Created tax rate" } },
      },
    },
    "/notifications": {
      get: {
        tags: ["Notifications"], summary: "List notifications",
        parameters: [{ $ref: "#/components/parameters/company_id" }, { $ref: "#/components/parameters/limit" }, { name: "unread_only", in: "query", schema: { type: "boolean" } }],
        responses: { "200": { description: "Array of notifications" } },
      },
    },
    "/notifications/{id}/read": {
      put: { tags: ["Notifications"], summary: "Mark notification as read", parameters: [{ $ref: "#/components/parameters/id" }], responses: { "200": { description: "Marked as read" } } },
    },
    "/settings": {
      get: {
        tags: ["Settings"], summary: "Get company settings",
        parameters: [{ $ref: "#/components/parameters/company_id" }],
        responses: { "200": { description: "Key-value settings map" } },
      },
      post: {
        tags: ["Settings"], summary: "Upsert a setting",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["company_id", "key", "value"], properties: { company_id: { type: "string", format: "uuid" }, key: { type: "string" }, value: { type: "string" } } } } } },
        responses: { "200": { description: "Upserted setting" } },
      },
    },
    "/ncf-sequences": {
      get: {
        tags: ["NCF"], summary: "List NCF sequences",
        parameters: [{ $ref: "#/components/parameters/company_id" }],
        responses: { "200": { description: "Array of NCF sequences" } },
      },
      post: {
        tags: ["NCF"], summary: "Create NCF sequence",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["company_id", "ncf_type", "prefix", "from_seq", "to_seq"], properties: { company_id: { type: "string", format: "uuid" }, ncf_type: { type: "string" }, prefix: { type: "string" }, from_seq: { type: "integer" }, to_seq: { type: "integer" }, dgii_auth: { type: "string" }, expires_at: { type: "string", format: "date" } } } } } },
        responses: { "201": { description: "Created NCF sequence" } },
      },
    },
    "/email-log": {
      get: {
        tags: ["Email"], summary: "List email log entries",
        parameters: [{ $ref: "#/components/parameters/company_id" }, { $ref: "#/components/parameters/limit" }, { $ref: "#/components/parameters/offset" }],
        responses: { "200": { description: "Array of email log entries" } },
      },
    },
  },
};

// ── Supabase client factory ───────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseQP(url: URL) {
  return {
    company_id: url.searchParams.get("company_id"),
    id: url.searchParams.get("id"),
    limit: parseInt(url.searchParams.get("limit") ?? "50", 10),
    offset: parseInt(url.searchParams.get("offset") ?? "0", 10),
    search: url.searchParams.get("search"),
    status: url.searchParams.get("status"),
    client_id: url.searchParams.get("client_id"),
    invoice_id: url.searchParams.get("invoice_id"),
    type: url.searchParams.get("type"),
    unread_only: url.searchParams.get("unread_only") === "true",
  };
}

// ── Router ────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // path after /api  e.g. /companies or /companies/uuid
    const pathParts = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "").split("/");
    const resource = pathParts[0];
    const pathId = pathParts[1] ?? null;
    const subAction = pathParts[2] ?? null;
    const qp = parseQP(url);
    const method = req.method.toUpperCase();
    const sb = getSupabase();

    // ── OpenAPI spec ────────────────────────────────────────────────────────
    if (resource === "openapi.json" || resource === "spec") {
      return json(openApiSpec);
    }

    // ── Companies ──────────────────────────────────────────────────────────
    if (resource === "companies") {
      if (method === "GET" && !pathId) {
        const { data, error } = await sb.from("companies").select("*").order("name").range(qp.offset, qp.offset + qp.limit - 1);
        if (error) return json({ error: error.message }, 500);
        return json(data);
      }
      if (method === "GET" && pathId) {
        const { data, error } = await sb.from("companies").select("*").eq("id", pathId).maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Not found" }, 404);
        return json(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await sb.from("companies").insert(body).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
      if (method === "PUT" && pathId) {
        const body = await req.json();
        const { data, error } = await sb.from("companies").update({ ...body, updated_at: new Date().toISOString() }).eq("id", pathId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "DELETE" && pathId) {
        const { error } = await sb.from("companies").delete().eq("id", pathId);
        if (error) return json({ error: error.message }, 400);
        return json({ deleted: true });
      }
    }

    // ── Clients ────────────────────────────────────────────────────────────
    if (resource === "clients") {
      if (method === "GET" && !pathId) {
        let q = sb.from("clients").select("*").order("name").range(qp.offset, qp.offset + qp.limit - 1);
        if (qp.company_id) q = q.eq("company_id", qp.company_id);
        if (qp.search) q = q.or(`name.ilike.%${qp.search}%,email.ilike.%${qp.search}%,rnc.ilike.%${qp.search}%`);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json(data);
      }
      if (method === "GET" && pathId) {
        const { data, error } = await sb.from("clients").select("*").eq("id", pathId).maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Not found" }, 404);
        return json(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await sb.from("clients").insert(body).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
      if (method === "PUT" && pathId) {
        const body = await req.json();
        const { data, error } = await sb.from("clients").update({ ...body, updated_at: new Date().toISOString() }).eq("id", pathId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "DELETE" && pathId) {
        const { data, error } = await sb.from("clients").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", pathId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
    }

    // ── Invoices ───────────────────────────────────────────────────────────
    if (resource === "invoices") {
      if (method === "GET" && !pathId) {
        let q = sb.from("invoices").select("*, clients(id,name,email,rnc), invoice_items(*)").order("created_at", { ascending: false }).range(qp.offset, qp.offset + qp.limit - 1);
        if (qp.company_id) q = q.eq("company_id", qp.company_id);
        if (qp.status) q = q.eq("status", qp.status);
        if (qp.client_id) q = q.eq("client_id", qp.client_id);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json(data);
      }
      if (method === "GET" && pathId) {
        const { data, error } = await sb.from("invoices").select("*, clients(id,name,email,rnc,phone,address), invoice_items(*)").eq("id", pathId).maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Not found" }, 404);
        return json(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { items, ...invoiceData } = body;
        const { data: inv, error } = await sb.from("invoices").insert(invoiceData).select().single();
        if (error) return json({ error: error.message }, 400);
        if (items?.length) {
          const rows = items.map((it: Record<string, unknown>) => ({ ...it, invoice_id: inv.id }));
          await sb.from("invoice_items").insert(rows);
        }
        return json(inv, 201);
      }
      if (method === "PUT" && pathId) {
        const body = await req.json();
        const { items, ...invoiceData } = body;
        const { data, error } = await sb.from("invoices").update({ ...invoiceData, updated_at: new Date().toISOString() }).eq("id", pathId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "DELETE" && pathId) {
        const { data, error } = await sb.from("invoices").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", pathId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
    }

    // ── Products ───────────────────────────────────────────────────────────
    if (resource === "products") {
      if (method === "GET" && !pathId) {
        let q = sb.from("products").select("*, tax_rates(id,name,rate)").order("name").range(qp.offset, qp.offset + qp.limit - 1);
        if (qp.company_id) q = q.eq("company_id", qp.company_id);
        if (qp.type) q = q.eq("type", qp.type);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json(data);
      }
      if (method === "GET" && pathId) {
        const { data, error } = await sb.from("products").select("*, tax_rates(id,name,rate)").eq("id", pathId).maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Not found" }, 404);
        return json(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await sb.from("products").insert(body).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
      if (method === "PUT" && pathId) {
        const body = await req.json();
        const { data, error } = await sb.from("products").update({ ...body, updated_at: new Date().toISOString() }).eq("id", pathId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "DELETE" && pathId) {
        const { data, error } = await sb.from("products").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", pathId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
    }

    // ── Payments ───────────────────────────────────────────────────────────
    if (resource === "payments") {
      if (method === "GET") {
        let q = sb.from("payment_records").select("*, invoices(id,invoice_number,total,client_id)").order("payment_date", { ascending: false }).range(qp.offset, qp.offset + qp.limit - 1);
        if (qp.company_id) q = q.eq("company_id", qp.company_id);
        if (qp.invoice_id) q = q.eq("invoice_id", qp.invoice_id);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await sb.from("payment_records").insert(body).select().single();
        if (error) return json({ error: error.message }, 400);
        // Update invoice amount_paid
        if (data) {
          const { data: inv } = await sb.from("invoices").select("total, amount_paid").eq("id", data.invoice_id).maybeSingle();
          if (inv) {
            const newPaid = Number(inv.amount_paid) + Number(data.amount);
            const newStatus = newPaid >= Number(inv.total) ? "paid" : "partial";
            await sb.from("invoices").update({ amount_paid: newPaid, status: newStatus, updated_at: new Date().toISOString() }).eq("id", data.invoice_id);
          }
        }
        return json(data, 201);
      }
    }

    // ── Tax Rates ──────────────────────────────────────────────────────────
    if (resource === "tax-rates") {
      if (method === "GET") {
        let q = sb.from("tax_rates").select("*").order("rate");
        if (qp.company_id) q = q.eq("company_id", qp.company_id);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await sb.from("tax_rates").insert(body).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
      if (method === "PUT" && pathId) {
        const body = await req.json();
        const { data, error } = await sb.from("tax_rates").update(body).eq("id", pathId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "DELETE" && pathId) {
        const { error } = await sb.from("tax_rates").delete().eq("id", pathId);
        if (error) return json({ error: error.message }, 400);
        return json({ deleted: true });
      }
    }

    // ── Notifications ──────────────────────────────────────────────────────
    if (resource === "notifications") {
      if (method === "GET" && !pathId) {
        let q = sb.from("notifications").select("*").order("created_at", { ascending: false }).range(qp.offset, qp.offset + qp.limit - 1);
        if (qp.company_id) q = q.eq("company_id", qp.company_id);
        if (qp.unread_only) q = q.eq("is_read", false);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json(data);
      }
      if (method === "PUT" && pathId && subAction === "read") {
        const { data, error } = await sb.from("notifications").update({ is_read: true }).eq("id", pathId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
    }

    // ── Settings ───────────────────────────────────────────────────────────
    if (resource === "settings") {
      if (method === "GET") {
        let q = sb.from("settings").select("key, value");
        if (qp.company_id) q = q.eq("company_id", qp.company_id);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        const map: Record<string, string> = {};
        (data ?? []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
        return json(map);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await sb.from("settings").upsert({ ...body, updated_at: new Date().toISOString() }, { onConflict: "company_id,key" }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
    }

    // ── NCF Sequences ──────────────────────────────────────────────────────
    if (resource === "ncf-sequences") {
      if (method === "GET") {
        let q = sb.from("ncf_sequences").select("*").order("ncf_type");
        if (qp.company_id) q = q.eq("company_id", qp.company_id);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await sb.from("ncf_sequences").insert({ ...body, current_seq: body.from_seq }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
      if (method === "PUT" && pathId) {
        const body = await req.json();
        const { data, error } = await sb.from("ncf_sequences").update({ ...body, updated_at: new Date().toISOString() }).eq("id", pathId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
    }

    // ── Email Log ──────────────────────────────────────────────────────────
    if (resource === "email-log") {
      if (method === "GET") {
        let q = sb.from("email_log").select("*").order("created_at", { ascending: false }).range(qp.offset, qp.offset + qp.limit - 1);
        if (qp.company_id) q = q.eq("company_id", qp.company_id);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json(data);
      }
    }

    return json({ error: `Unknown resource: ${resource}` }, 404);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
