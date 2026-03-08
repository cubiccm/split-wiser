import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, session.userId))
    .get();

  if (!user) {
    session.destroy();
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}
