export const rpName = "SplitWiser";
export const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";
export const origin = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function base64UrlToUint8Array(
  base64url: string,
): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(base64url, "base64url");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
