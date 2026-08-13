import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/server/firebase-admin";

export async function requireUser(request: Request): Promise<DecodedIdToken> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new AuthError("인증 토큰이 없습니다.", 401);
  }

  try {
    return await adminAuth.verifyIdToken(authorization.slice(7));
  } catch {
    throw new AuthError("인증 토큰이 유효하지 않습니다.", 401);
  }
}

export function requireAdmin(token: DecodedIdToken) {
  if (token.admin !== true) {
    throw new AuthError("관리자 권한이 필요합니다.", 403);
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
