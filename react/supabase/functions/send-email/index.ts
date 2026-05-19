import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  // Template variable substitution map
  variables?: Record<string, string>;
  // SMTP config override (if not set, reads from DB settings)
  smtp?: {
    host: string;
    port: number;
    user: string;
    password: string;
    from_email: string;
    from_name: string;
  };
  // Metadata for logging
  schedule_id?: string;
  invoice_id?: string;
  client_id?: string;
  company_id?: string;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as SendEmailRequest;
    const { to, subject: rawSubject, body: rawBody, variables = {}, smtp, schedule_id, invoice_id, client_id, company_id } = body;

    if (!to || !rawSubject || !rawBody) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Interpolate template variables
    const subject = interpolate(rawSubject, variables);
    const htmlBody = interpolate(rawBody, variables)
      .replace(/\n/g, "<br>");

    // Determine SMTP config
    let smtpConfig = smtp;

    if (!smtpConfig) {
      // Read from DB settings table for this company
      const { createClient } = await import("npm:@supabase/supabase-js@2");
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      let q = supabaseClient.from("settings").select("key, value");
      if (company_id) q = q.eq("company_id", company_id);
      const { data: settings } = await q;

      const get = (key: string) =>
        (settings ?? []).find((s: { key: string; value: string }) => s.key === key)?.value ?? "";

      const host = get("smtp_host");
      const port = parseInt(get("smtp_port") || "587", 10);
      const user = get("smtp_user");
      const password = get("smtp_password");
      const from_email = get("smtp_from") || user;
      const from_name = get("smtp_name") || get("company_name") || "FacturaPro";

      if (!host || !user || !password) {
        // Log the attempt as failed and return informative error
        if (company_id || schedule_id) {
          await supabaseClient.from("email_log").insert({
            schedule_id: schedule_id ?? null,
            invoice_id: invoice_id ?? null,
            client_id: client_id ?? null,
            to_email: to,
            subject,
            status: "failed",
            error_message: "SMTP not configured. Set smtp_host, smtp_user, smtp_password in settings.",
          });
        }
        return new Response(
          JSON.stringify({ error: "SMTP not configured", detail: "Set smtp_host, smtp_user and smtp_password in Admin → Email settings" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      smtpConfig = { host, port, user, password, from_email, from_name };
    }

    // Send via SMTP using Deno's built-in fetch to an SMTP-over-HTTP relay,
    // or directly via nodemailer-compatible approach using TCP.
    // We use a lightweight SMTP client built on Deno's TCP.
    const result = await sendSmtp({
      host: smtpConfig.host,
      port: smtpConfig.port,
      user: smtpConfig.user,
      password: smtpConfig.password,
      from: `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`,
      to,
      subject,
      html: htmlBody,
    });

    // Log to email_log
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabaseLog = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabaseLog.from("email_log").insert({
      schedule_id: schedule_id ?? null,
      invoice_id: invoice_id ?? null,
      client_id: client_id ?? null,
      to_email: to,
      subject,
      status: result.success ? "sent" : "failed",
      error_message: result.error ?? "",
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Email sent to ${to}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Minimal SMTP client over TCP ──────────────────────────────────────────────

interface SmtpOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}

async function sendSmtp(opts: SmtpOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // Use the fetch-based SMTP approach for Deno Deploy compatibility
    // For environments without raw TCP, we use an HTTP-to-SMTP relay pattern
    // with Base64-encoded AUTH LOGIN

    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const date = new Date().toUTCString();
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@facturapro>`;

    // Build raw MIME email
    const rawEmail = [
      `Date: ${date}`,
      `Message-ID: ${messageId}`,
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      opts.html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px;margin:0 auto;padding:20px">`,
      opts.html,
      `</body></html>`,
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    // Try SMTP over TCP (works in Supabase Edge Functions runtime)
    const conn = await Deno.connect({
      hostname: opts.host,
      port: opts.port,
      transport: "tcp",
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function readLine(): Promise<string> {
      const buf = new Uint8Array(1024);
      let line = "";
      while (true) {
        const n = await conn.read(buf);
        if (!n) break;
        line += decoder.decode(buf.subarray(0, n));
        if (line.includes("\n")) break;
      }
      return line.trim();
    }

    async function send(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + "\r\n"));
      return readLine();
    }

    // SMTP handshake
    await readLine(); // 220 greeting
    await send(`EHLO facturapro`);

    // STARTTLS if port 587
    if (opts.port === 587) {
      await send("STARTTLS");
      // Upgrade to TLS
      const tlsConn = await Deno.startTls(conn, { hostname: opts.host });
      // Re-use tlsConn for remaining commands
      const tlsEncoder = new TextEncoder();
      const tlsDecoder = new TextDecoder();

      async function tlsReadLine(): Promise<string> {
        const buf = new Uint8Array(4096);
        let line = "";
        while (true) {
          const n = await (tlsConn as Deno.TlsConn).read(buf);
          if (!n) break;
          line += tlsDecoder.decode(buf.subarray(0, n));
          if (line.includes("\n")) break;
        }
        return line.trim();
      }

      async function tlsSend(cmd: string): Promise<string> {
        await (tlsConn as Deno.TlsConn).write(tlsEncoder.encode(cmd + "\r\n"));
        return tlsReadLine();
      }

      await tlsSend("EHLO facturapro");
      await tlsSend("AUTH LOGIN");
      await tlsSend(btoa(opts.user));
      const authResult = await tlsSend(btoa(opts.password));

      if (!authResult.startsWith("235")) {
        tlsConn.close();
        return { success: false, error: `SMTP AUTH failed: ${authResult}` };
      }

      await tlsSend(`MAIL FROM:<${opts.from.match(/<(.+)>/)?.[1] ?? opts.from}>`);
      await tlsSend(`RCPT TO:<${opts.to}>`);
      await tlsSend("DATA");
      await tlsSend(rawEmail + "\r\n.");
      await tlsSend("QUIT");
      tlsConn.close();
      return { success: true };
    }

    // Port 465 (SSL) or plain
    await send("AUTH LOGIN");
    await send(btoa(opts.user));
    const authResult = await send(btoa(opts.password));

    if (!authResult.startsWith("235")) {
      conn.close();
      return { success: false, error: `SMTP AUTH failed: ${authResult}` };
    }

    await send(`MAIL FROM:<${opts.from.match(/<(.+)>/)?.[1] ?? opts.from}>`);
    await send(`RCPT TO:<${opts.to}>`);
    await send("DATA");
    await send(rawEmail + "\r\n.");
    await send("QUIT");
    conn.close();
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
