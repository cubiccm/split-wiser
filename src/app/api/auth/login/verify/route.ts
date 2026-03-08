import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

import { db } from "@/lib/db";
import { users, passkeyCredentials } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { rpID, origin, base64UrlToUint8Array } from "@/lib/auth/webauthn";

export async function POST(request: Request) {
  const body = await request.json();
  const session = await getSession();

  if (!session.challenge) {
    return NextResponse.json(
      { error: "Login session expired" },
      { status: 400 },
    );
  }

  const credential = db
    .select()
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.id, body.id))
    .get();

  if (!credential) {
    return NextResponse.json(
      { error: "Credential not found" },
      { status: 400 },
    );
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: session.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: base64UrlToUint8Array(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports
          ? (JSON.parse(credential.transports) as AuthenticatorTransportFuture[])
          : undefined,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 400 },
    );
  }

  db.update(passkeyCredentials)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(passkeyCredentials.id, credential.id))
    .run();

  const user = db
    .select()
    .from(users)
    .where(eq(users.id, credential.userId))
    .get();

  session.userId = user!.id;
  session.email = user!.email;
  session.challenge = undefined;
  await session.save();

  return NextResponse.json({
    verified: true,
    user: { id: user!.id, name: user!.name, email: user!.email },
  });
}
