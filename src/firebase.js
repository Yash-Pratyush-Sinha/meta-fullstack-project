// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// REPLACE WITH YOUR KEYS FROM FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyDYqtZeIjaLUrKvM37G09CRQg6sibSqwdw",
  authDomain: "meta-fullstack-project.firebaseapp.com",
  projectId: "meta-fullstack-project",
  storageBucket: "meta-fullstack-project.firebasestorage.app",
  messagingSenderId: "1040524069059",
  appId: "1:1040524069059:web:c890f50ba04bf5d7013a76",
  measurementId: "G-B00XQYXET5"
};

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Login Function
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Firebase Error:", error);
    alert("Firebase Error: " + error.message);
    return null;
  }
};

export const logoutUser = () => signOut(auth);
export { auth };
