import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

import { db } from "@/lib/db";
import { users, passkeyCredentials } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { rpID } from "@/lib/auth/webauthn";

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email: string };

  if (!email?.trim()) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 },
    );
  }

  const user = db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();

  if (!user) {
    return NextResponse.json(
      { error: "No account found with this email" },
      { status: 404 },
    );
  }

  const credentials = db
    .select()
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, user.id))
    .all();

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((cred) => ({
      id: cred.id,
      transports: cred.transports
        ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[])
        : undefined,
    })),
  });

  const session = await getSession();
  session.challenge = options.challenge;
  await session.save();

  return NextResponse.json(options);
}
