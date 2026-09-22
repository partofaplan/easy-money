/**
 * Firebase is optional. With the VITE_FIREBASE_* variables set at build time the
 * app runs in cloud mode: email sign-in and per-account storage in Firestore.
 * Without them it runs in local mode: device profiles in localStorage, which is
 * what `npm run dev` and the tests use.
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const cloudEnabled = Boolean(config.apiKey && config.projectId && config.appId);

function app(): FirebaseApp {
  return getApps()[0] ?? initializeApp(config);
}

export function firebaseAuth(): Auth {
  return getAuth(app());
}

export function firestore(): Firestore {
  return getFirestore(app());
}
