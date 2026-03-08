import { NextRequest, NextResponse } from "next/server";
import { like, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const results = db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(or(like(users.name, `%${q}%`), like(users.email, `%${q}%`)))
    .limit(10)
    .all();

  return NextResponse.json({ users: results });
}
