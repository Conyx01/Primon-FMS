import { NextRequest, NextResponse } from "next/server";
import { findValidInvite } from "@/lib/invite";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invite = await findValidInvite(decodeURIComponent(token));
  if (!invite) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }
  return NextResponse.json({
    valid: true,
    name: invite.user.name,
    email: invite.user.email,
  });
}
