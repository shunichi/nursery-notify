import firebase from "firebase";
import 'firebase/firestore';

declare global {
  interface Window {
    db: firebase.firestore.Firestore;
  }
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBSSE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

firebase.initializeApp(firebaseConfig);

export default firebase;
export const db = firebase.firestore();

if (location.hostname === "localhost") {
  window.db = db;
  db.useEmulator("localhost", 8080);
  // firebase.auth().useEmulator('http://localhost:9099/');
}

