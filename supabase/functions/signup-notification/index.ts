import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

serve(async (req) => {
  try {
    // 1. Parse the incoming webhook payload from Supabase
    const { record } = await req.json();
    const userEmail = record.email;
    const userId = record.id;
    const createdAt = record.created_at;

    // 2. Load secure secrets from Supabase Environment Secrets
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const smtpUsername = Deno.env.get("SMTP_USERNAME"); // Your primary Google Workspace email
    const smtpPassword = Deno.env.get("SMTP_PASSWORD"); // Generated Google App Password
    const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL") || "admin@ustats.pro"; // The recipient

    if (!smtpUsername || !smtpPassword) {
      throw new Error("Missing SMTP authentication environment variables.");
    }

    // 3. Initialize secure SMTP Connection
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpUsername,
          password: smtpPassword,
        },
      },
    });

    // 4. Send the notification email to admin@ustats.pro
    await client.send({
      from: `ustats.pro Alert <${smtpUsername}>`,
      to: adminEmail,
      subject: "🚀 New ustats.pro Coach Signup!",
      content: `A new coach signed up: ${userEmail}. Workspace created at ${new Date(createdAt).toLocaleString()}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #f8fafc; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://ustats.pro/logo_icon.png" alt="ustats.pro" style="width: 48px; height: 48px; border-radius: 50%;" onerror="this.style.display='none'" />
            <h2 style="color: #4f46e5; margin-top: 10px; margin-bottom: 5px; font-weight: 900; letter-spacing: -0.025em;">New Coach Signup!</h2>
            <p style="color: #64748b; font-size: 14px; margin-top: 0;">A new team workspace has been successfully created.</p>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #64748b; width: 140px;">Coach Email:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${userEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #64748b;">User ID:</td>
              <td style="padding: 8px 0; font-family: monospace; font-size: 12px; color: #334155;">${userId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Registration Time:</td>
              <td style="padding: 8px 0; color: #334155;">${new Date(createdAt).toLocaleString('en-GB')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Initial Plan:</td>
              <td style="padding: 8px 0; color: #10b981; font-weight: bold;">7-Day Coach Pro Free Trial</td>
            </tr>
          </table>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          
          <div style="text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">This notification was automatically sent to the admin alias ${adminEmail}.</p>
          </div>
        </div>
      `,
    });

    // 5. Close SMTP session
    await client.close();

    return new Response(JSON.stringify({ success: true, message: "Alert sent successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("SMTP Notification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
