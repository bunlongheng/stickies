/**
 * Send a one-time welcome email when a new user signs up.
 * Uses Resend — set RESEND_API_KEY in env vars.
 * Fire-and-forget: errors are logged but never thrown.
 */

export async function sendWelcomeEmail(to: string, name?: string) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return; // silently skip if not configured

    const displayName = name?.split(" ")[0] ?? to.split("@")[0];

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Welcome to Stickies</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:48px 16px;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

        <!-- Logo -->
        <tr>
          <td align="center" style="padding-bottom:32px;">
            <div style="width:56px;height:56px;background:#FFCC00;border-radius:12px 12px 12px 28px;display:inline-flex;align-items:center;justify-content:center;font-size:26px;line-height:56px;text-align:center;">
              📝
            </div>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#18181b;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 36px;">

            <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
              Hey ${displayName} 👋
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#71717a;line-height:1.6;">
              Welcome to Stickies — your personal note board is ready.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              ${[
                ["📌", "Capture anything", "Notes, lists, ideas — all in one place."],
                ["📁", "Organize with folders", "Color-code and group your notes your way."],
                ["🔗", "Share in one click", "Burn-after-read links for quick sharing."],
              ].map(([icon, title, desc]) => `
              <tr>
                <td style="padding:10px 0;vertical-align:top;width:32px;font-size:18px;">${icon}</td>
                <td style="padding:10px 0 10px 12px;">
                  <p style="margin:0;font-size:14px;font-weight:600;color:#e4e4e7;">${title}</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#71717a;">${desc}</p>
                </td>
              </tr>`).join("")}
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${process.env.NEXT_PUBLIC_APP_BASE_URL ?? "https://stickies-bheng.vercel.app"}/tools/stickies"
                     style="display:inline-block;background:linear-gradient(135deg,#4285F4,#1a6ef5);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 32px;border-radius:12px;letter-spacing:0.1px;">
                    Open Stickies →
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding-top:24px;">
            <p style="margin:0;font-size:12px;color:#3f3f46;">
              You're receiving this because you signed up with Google.<br/>
              No more emails after this one.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    try {
        await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "Stickies <hello@stickies-bheng.vercel.app>",
                to: [to],
                subject: "Welcome to Stickies 📝",
                html,
            }),
        });
    } catch (err) {
        console.error("[welcome-email] send failed:", err);
    }
}
