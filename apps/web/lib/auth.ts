/**
 * Authentication: PBKDF2 password hashing (Web Crypto, no native deps) and
 * stateless JWTs via `jose`. The owner email is always minted as a super-admin.
 */
import { SignJWT, jwtVerify } from "jose";
import { JWT_SECRET, TOKEN_TTL_SECONDS } from "./config";

const PBKDF2_ITERATIONS = 100_000;
const enc = new TextEncoder();

/** Copy into a fresh ArrayBuffer-backed view so Web Crypto's BufferSource types are satisfied. */
function bs(bytes: Uint8Array): BufferSource {
  return bytes.slice() as unknown as BufferSource;
}

function toB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
function fromB64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    bs(enc.encode(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: bs(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = fromB64(parts[2]);
  const expected = parts[3];
  const key = await crypto.subtle.importKey(
    "raw",
    bs(enc.encode(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: bs(salt), iterations, hash: "SHA-256" },
    key,
    256,
  );
  return toB64(new Uint8Array(bits)) === expected;
}

const secretKey = enc.encode(JWT_SECRET);

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}
