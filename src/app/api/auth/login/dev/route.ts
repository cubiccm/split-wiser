import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { isLocalDev } from "@/lib/auth/dev";

// Local-dev only: sign in with just an email, skipping the passkey check.
// Gated by isLocalDev() so it is inert in any production build.
export async function POST(request: Request) {
  if (!isLocalDev()) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const { email } = (await request.json()) as { email?: string };

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()));

  if (!user) {
    return NextResponse.json(
      { error: "No account found with this email" },
      { status: 404 },
    );
  }

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.challenge = undefined;
  await session.save();

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email },
  });
}
