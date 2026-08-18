import { createHash, timingSafeEqual } from "node:crypto";

const passwordHash = process.env.MANAGEMENT_PASSWORD_SHA256;

export function requireManagementPassword(request: Request) {
  const password = request.headers.get("x-management-password");
  if (!passwordHash || !password) throw new ManagementAuthError();

  const received = createHash("sha256").update(password, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(passwordHash.trim(), "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new ManagementAuthError();
  }
}

export class ManagementAuthError extends Error {
  constructor() { super("관리 비밀번호가 올바르지 않습니다."); }
}
