import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export function validatePassword(password: string) {
  if (password.length < 12) return "密码至少需要 12 个字符";
  if (password.length > 128) return "密码长度不能超过 128 个字符";
  return null;
}

export async function hashPassword(password: string) {
  const invalid = validatePassword(password);
  if (invalid) throw new Error(invalid);

  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, encodedHash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !encodedHash) return false;

  const expected = Buffer.from(encodedHash, "base64url");
  const actual = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
