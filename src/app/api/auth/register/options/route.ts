import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { rpID, rpName } from "@/lib/auth/webauthn";

export async function POST(request: Request) {
  const { name, email } = (await request.json()) as {
    name: string;
    email: string;
  };

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json(
      { error: "Name and email are required" },
      { status: 400 },
    );
  }

  const existing = db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();

  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: email.toLowerCase(),
    userDisplayName: name.trim(),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
  });

  const session = await getSession();
  session.challenge = options.challenge;
  session.registrationName = name.trim();
  session.registrationEmail = email.toLowerCase();
  await session.save();

  return NextResponse.json(options);
}
