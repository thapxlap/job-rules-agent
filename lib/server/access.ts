import type { DecodedIdToken } from "firebase-admin/auth";

export function visibilityKeysFor(token: DecodedIdToken): string[] {
  const keys = ["COMPANY"];
  if (typeof token.departmentId === "string" && token.departmentId.length > 0) {
    keys.push(`DEPARTMENT:${token.departmentId}`);
  }
  if (token.admin === true) keys.push("ADMIN");
  return keys;
}

export function canAccessVisibility(
  token: DecodedIdToken,
  visibilityKey: unknown,
): boolean {
  return (
    typeof visibilityKey === "string" &&
    visibilityKeysFor(token).includes(visibilityKey)
  );
}
