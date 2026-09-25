import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/household/reminders/run
 *
 * Invoked daily by the Vercel Cron job defined in vercel.json.
 * Selects household clients whose lastServiceDate is ≥ 6 months ago,
 * creates a HouseholdReminder row if one doesn't exist for the current
 * due-date window, and sends a reminder email via Resend.
 *
 * PENDING RESEND SETUP — returns 501 until RESEND_API_KEY is configured.
 * Once Primon provides the Resend account details, implement:
 *   1. Select clients overdue (lastServiceDate ≤ 6 months ago)
 *   2. Upsert HouseholdReminder (sentAt null guard for idempotency)
 *   3. Send email via Resend
 *   4. Set sentAt = now
 */
export async function POST(_req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      {
        error: "Not implemented",
        detail:
          "RESEND_API_KEY is not configured. Household reminder emails will be activated once the Resend account is set up.",
      },
      { status: 501 }
    );
  }

  // TODO (Phase 10.2): implement reminder logic once RESEND_API_KEY is available.
  return NextResponse.json({ ok: true, sent: 0 });
}
