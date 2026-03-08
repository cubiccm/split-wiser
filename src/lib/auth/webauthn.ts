export const rpName = "Split Wiser";
export const rpID = process.env.WEBAUTHN_RP_ID!;
export const origin = process.env.WEBAUTHN_ORIGIN!;

if (!rpID || !origin) {
  throw new Error("WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN must be set");
}

export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function base64UrlToUint8Array(base64url: string) {
  return new Uint8Array(Buffer.from(base64url, "base64url"));
}
