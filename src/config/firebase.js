// Import Firebase functions
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDrORq3mZHx1tf5qbH-fdt0ScysupK10e0",
  authDomain: "gorwth.firebaseapp.com",
  projectId: "gorwth",
  storageBucket: "gorwth.firebasestorage.app",
  messagingSenderId: "36209213488",
  appId: "1:36209213488:web:a0441fe55e2c771aaaedf5",
  measurementId: "G-ZE7SY6VLVD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Export for use in other modules
export { app, analytics, db };
