// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  inMemoryPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
} from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCYxbcZkLS4dKk2mdSM7SwiTYJE3BiRWZ8",
  authDomain: "toeicpractice-1445a.firebaseapp.com",
  projectId: "toeicpractice-1445a",
  storageBucket: "toeicpractice-1445a.firebasestorage.app",
  messagingSenderId: "358534709708",
  appId: "1:358534709708:web:4b1d421a01f944fca41d69",
  measurementId: "G-LGJTJ3E1TW",
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const createAuth = () => {
  try {
    return initializeAuth(app, {
      persistence: inMemoryPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (error) {
    if (error.code === "auth/already-initialized") {
      return getAuth(app);
    }

    throw error;
  }
};

export const auth = createAuth();
