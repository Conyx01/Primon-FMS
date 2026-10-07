import { Resend } from "resend";
import { getPublicOrigin } from "@/lib/verify-url";

const DEFAULT_FROM = "Primon FMS <noreply@mail.primonenterprises.com>";

export type InviteEmailKind = "invite" | "reset";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inviteCopy(kind: InviteEmailKind, name: string) {
  if (kind === "reset") {
    return {
      subject: "Reset your Primon FMS password",
      heading: "Reset your password",
      intro: `Hello ${name},`,
      body: "We received a request to reset the password for your Primon FMS account. Use the button below to choose a new password. If you did not request this, you can ignore this email.",
      cta: "Set a new password",
    };
  }
  return {
    subject: "You are invited to Primon FMS",
    heading: "Set up your access",
    intro: `Hello ${name},`,
    body: "You have been invited to Primon Enterprises’ Fumigation Management System. Use the button below to set your own password and sign in. This link expires in 7 days.",
    cta: "Set your password",
  };
}

function brandedInviteHtml(args: {
  kind: InviteEmailKind;
  name: string;
  inviteUrl: string;
  origin: string;
}): string {
  const copy = inviteCopy(args.kind, args.name);
  const safeName = escapeHtml(args.name);
  const safeUrl = escapeHtml(args.inviteUrl);
  const logoSrc = `${args.origin}/logo-no-bg.png`;
  const intro = `Hello ${safeName},`;
  const body =
    args.kind === "reset"
      ? "We received a request to reset the password for your Primon FMS account. Use the button below to choose a new password. If you did not request this, you can ignore this email."
      : "You have been invited to Primon Enterprises&rsquo; Fumigation Management System. Use the button below to set your own password and sign in. This link expires in 7 days.";
  const heading = copy.heading;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(copy.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F7F8FB;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FB;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #E3E7F0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#090F24;padding:28px 36px 24px;border-bottom:3px solid #B08D57;">
                <img src="${escapeHtml(logoSrc)}" alt="Primon Enterprises" width="168" style="display:block;height:auto;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px 36px 8px;font-family:Georgia,'Times New Roman',serif;color:#090F24;font-size:22px;line-height:1.3;">
                ${escapeHtml(heading)}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 36px 0;font-family:Arial,Helvetica,sans-serif;color:#101A33;font-size:15px;line-height:1.6;">
                ${intro}
              </td>
            </tr>
            <tr>
              <td style="padding:12px 36px 0;font-family:Arial,Helvetica,sans-serif;color:#667085;font-size:14px;line-height:1.65;">
                ${body}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 36px 8px;">
                <a href="${safeUrl}" style="display:inline-block;background:#16224A;color:#F5F7FC;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
                  ${escapeHtml(copy.cta)}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px 8px;font-family:Arial,Helvetica,sans-serif;color:#667085;font-size:12px;line-height:1.55;">
                If the button does not work, copy this link into your browser:<br />
                <a href="${safeUrl}" style="color:#2A3E7D;word-break:break-all;">${safeUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 36px 32px;font-family:Arial,Helvetica,sans-serif;color:#667085;font-size:11px;line-height:1.5;border-top:1px solid #E3E7F0;">
                Primon Enterprises Limited · Fumigation Management System<br />
                This message was sent from a no-reply address.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function brandedInviteText(args: {
  kind: InviteEmailKind;
  name: string;
  inviteUrl: string;
}): string {
  const copy = inviteCopy(args.kind, args.name);
  return [
    copy.intro,
    "",
    copy.body,
    "",
    `${copy.cta}: ${args.inviteUrl}`,
    "",
    "Primon Enterprises Limited · Fumigation Management System",
  ].join("\n");
}

/**
 * Invite / password-reset email via Resend.
 * Callers always keep the invite URL to copy in the UI if send fails.
 */
export async function sendInviteEmail(args: {
  to: string;
  name: string;
  inviteUrl: string;
  kind?: InviteEmailKind;
}): Promise<{ sent: boolean; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, reason: "resend_not_configured" };
  }

  const from = process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
  const kind = args.kind ?? "invite";
  const origin = getPublicOrigin();
  const copy = inviteCopy(kind, args.name);
  const displayName = args.name.trim() || "there";

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: args.to,
      subject: copy.subject,
      html: brandedInviteHtml({
        kind,
        name: displayName,
        inviteUrl: args.inviteUrl,
        origin,
      }),
      text: brandedInviteText({
        kind,
        name: displayName,
        inviteUrl: args.inviteUrl,
      }),
    });

    if (result.error) {
      console.error("Resend send error:", result.error);
      return { sent: false, reason: result.error.message || "resend_error" };
    }

    return { sent: true, reason: "sent" };
  } catch (error: unknown) {
    console.error("Resend send error:", error);
    return { sent: false, reason: "resend_error" };
  }
}
