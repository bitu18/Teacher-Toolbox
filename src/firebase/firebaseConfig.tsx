import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_API_KEY,
    authDomain: process.env.REACT_APP_AUTH_DOMAIN,
    databaseURL: process.env.REACT_APP_DATABASE_URL,
    projectId: process.env.REACT_APP_PROJECT_ID,
    storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_APP_ID,
    measurementId: process.env.REACT_APP_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// --- Auth (anonymous) ---
export async function ensureAnon(): Promise<string> {
    if (!auth.currentUser) await signInAnonymously(auth);
    return auth.currentUser!.uid;
}

export const analytics = (() => {
    try {
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            return getAnalytics(app);
        }
    } catch (e) {
        console.warn('Firebase analytics not initialized:', e);
    }
    return null as ReturnType<typeof getAnalytics> | null;
})();

export default app;
