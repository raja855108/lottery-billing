import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if config is valid (at least API Key must exist)
export const isConfigValid = !!firebaseConfig.apiKey;

if (!isConfigValid) {
  console.error("❌ Firebase Configuration is missing! Check your .env file or Netlify environment variables.");
}

// Initialize Firebase safely
const app = isConfigValid ? initializeApp(firebaseConfig) : null;

// Initialize Services safely
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export default app;
