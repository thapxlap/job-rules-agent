import { Firestore } from "@google-cloud/firestore";
import {
  applicationDefault,
  getApp,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!projectId) {
  throw new Error("GOOGLE_CLOUD_PROJECT 환경변수가 필요합니다.");
}

const adminApp = getApps().length
  ? getApp()
  : initializeApp({
      credential: applicationDefault(),
      projectId,
      storageBucket,
    });

export const adminAuth = getAuth(adminApp);
export const adminStorage = getStorage(adminApp);
export const serverDb = new Firestore({
  projectId,
  ignoreUndefinedProperties: true,
});
