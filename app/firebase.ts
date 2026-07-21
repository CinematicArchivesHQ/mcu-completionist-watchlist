import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD7GFSk6jJZ2dyPgwZJH9gbKv6aPZ7UMZ4",
  authDomain: "cinematic-archives-hq.firebaseapp.com",
  projectId: "cinematic-archives-hq",
  storageBucket: "cinematic-archives-hq.firebasestorage.app",
  messagingSenderId: "568480330615",
  appId: "1:568480330615:web:b459185116196807912772",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function signInWithGoogle() {
  await setPersistence(auth, browserLocalPersistence);
  return signInWithPopup(auth, googleProvider);
}

export function signOutGoogle() {
  return signOut(auth);
}

export function archiveDocument(user: User) {
  return doc(db, "users", user.uid, "archives", "infinity-archive");
}
