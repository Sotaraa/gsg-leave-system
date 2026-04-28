import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAJWhXL1H2F28ZQZjJc0MIi8DzWNRYWgwE",
  authDomain: "holiday-tracker-cccb5.firebaseapp.com",
  projectId: "holiday-tracker-cccb5",
  storageBucket: "holiday-tracker-cccb5.firebasestorage.app",
  messagingSenderId: "363462080910",
  appId: "1:363462080910:web:47e5b0cace9a5b3efa0cdf",
  measurementId: "G-VV5YY3HP3T"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable anonymous auth for Firestore read access
signInAnonymously(auth).catch((error) => {
  console.warn('Firebase anonymous auth failed (this is non-critical):', error);
});

export default app;
