import firebase from "firebase/";
import 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

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
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
let userName: string | null = null;
let userId: string | null = null;

function lineAuth() {
  if (userId == null) return;

  const stateToken = uuidv4();
  db.collection('users').doc(userId).set({
    oauthStateToken: stateToken,
  }).then(() => {
    const state = `${userId}:${stateToken}`;
    const lineClientId = process.env.LINE_NOTIFY_OAUTH_CLIENT_ID;
    const redirectUri = process.env.LINE_NOTIFY_OAUTH_CALLBACK_URL;
    const lineAuthUrl = `https://notify-bot.line.me/oauth/authorize?response_type=code&client_id=${lineClientId}&redirect_uri=${redirectUri}&scope=notify&state=${state}`;
    window.location.href = lineAuthUrl;
  });
}

function onAuthorizeFinished(user: firebase.User) {
  console.log(`user: ${user}`);
  console.log(`uid: ${user.uid}`);
  userId = user.uid;
  userName = user.displayName;

  const loadElem = document.getElementById('load');
  if (loadElem) {
    loadElem.textContent = `${userName}さんこんにちは`;
  }
  const button = document.getElementById('line-notify-auth');
  if (button) {
    button.style.display = 'inline-block';
    button.addEventListener('click', (e) => {
      e.preventDefault();
      lineAuth();
    });
  }
}

function onAuthorizeRequired() {
  const loadElem = document.getElementById('load');
  if (loadElem) {
    loadElem.textContent = `ログインしてください`;
  }

  const button = document.getElementById('google-auth-button');
  if (button) {
    button.style.display = 'inline-block';
    button.addEventListener('click', (e) => {
      e.preventDefault();
      googleAuth();
    });
  }
}

function googleAuth() {
  firebase.auth()
  .signInWithPopup(provider)
  .then((result) => {
    const credential = result.credential;
    if (credential == null ) {
      console.log('credential == null');
      return;
    }

    // This gives you a Google Access Token. You can use it to access the Google API.
    // const token = credential.accessToken;
    // The signed-in user info.
    const user = result.user;
    if (user == null)  {
      console.log('user == null');
      return;
    }

    console.log('auth finished');
    onAuthorizeFinished(user);
  }).catch((error) => {
    // Handle Errors here.
    console.log(error);
    // const errorCode = error.code;
    // const errorMessage = error.message;
    // // The email of the user's account used.
    // const email = error.email;
    // // The firebase.auth.AuthCredential type that was used.
    // const credential = error.credential;
    // // ...
  });
}

const timeBegin = Date.now();
firebase.auth().onAuthStateChanged(function(user) {
  const timeAuthChanged = Date.now();
  console.log(`auth check time: ${(timeAuthChanged - timeBegin) / 1000}sec`);
  if (user) {
    console.log('already authorized');
    onAuthorizeFinished(user);
  } else {
    console.log('not authorized');
    onAuthorizeRequired();
  }
});
