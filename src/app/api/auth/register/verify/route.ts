import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";

import { db } from "@/lib/db";
import { users, passkeyCredentials } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { rpID, origin, uint8ArrayToBase64Url } from "@/lib/auth/webauthn";

export async function POST(request: Request) {
  const body = await request.json();
  const session = await getSession();

  if (!session.challenge || !session.registrationEmail) {
    return NextResponse.json(
      { error: "Registration session expired" },
      { status: 400 },
    );
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: session.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json(
      { error: "Registration verification failed" },
      { status: 400 },
    );
  }

  const { credential } = verification.registrationInfo;

  const user = db
    .insert(users)
    .values({
      name: session.registrationName!,
      email: session.registrationEmail,
    })
    .returning()
    .get();

  db.insert(passkeyCredentials)
    .values({
      id: credential.id,
      userId: user.id,
      publicKey: uint8ArrayToBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports
        ? JSON.stringify(credential.transports)
        : null,
    })
    .run();

  session.userId = user.id;
  session.email = user.email;
  session.challenge = undefined;
  session.registrationName = undefined;
  session.registrationEmail = undefined;
  await session.save();

  return NextResponse.json({
    verified: true,
    user: { id: user.id, name: user.name, email: user.email },
  });
}
