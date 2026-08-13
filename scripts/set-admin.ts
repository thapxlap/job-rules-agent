import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const email = process.argv[2];
const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!email || !projectId) {
  console.error("사용법: GOOGLE_CLOUD_PROJECT=<project-id> pnpm admin:set admin@company.com");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true });
console.log(`${email} 계정에 admin=true 권한을 설정했습니다. 다시 로그인하면 적용됩니다.`);
