/**
 * Invite email — Resend when RESEND_API_KEY is set; otherwise a no-op.
 * Callers always get the invite URL to copy in the UI.
 */
export async function sendInviteEmail(_args: {
  to: string;
  name: string;
  inviteUrl: string;
}): Promise<{ sent: boolean; reason: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: "resend_not_configured" };
  }
  // Plug in Resend here when the Primon sending domain is live.
  return { sent: false, reason: "resend_not_configured" };
}
