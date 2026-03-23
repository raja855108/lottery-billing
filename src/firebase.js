import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyBOatkz_djqXG-7trnv8h9AhIlUH8co0RE",
  authDomain: "lottery-billing-v3.firebaseapp.com",
  projectId: "lottery-billing-v3",
  storageBucket: "lottery-billing-v3.firebasestorage.app",
  messagingSenderId: "884586953988",
  appId: "1:884586953988:web:0a83f22609758a7ca3e451"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
