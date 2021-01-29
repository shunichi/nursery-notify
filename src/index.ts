import 'core-js/stable';
import 'regenerator-runtime/runtime';
import firebase from "firebase/";
import 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import Cookies from 'js-cookie';
import axios from 'axios';

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
type GlobalState = {
  userName: string | null;
  userId: string | null;
  accessToken: string | null;
};
const globalState: GlobalState = {
  userName: null,
  userId: null,
  accessToken: null,
};

function lineAuth() {
  if (globalState.userId == null) return;

  const oauthState = uuidv4();
  Cookies.set('oauthState', oauthState);
  const lineClientId = process.env.LINE_NOTIFY_OAUTH_CLIENT_ID;
  const redirectUri = process.env.LINE_NOTIFY_OAUTH_CALLBACK_URL;
  const lineAuthUrl = `https://notify-bot.line.me/oauth/authorize?response_type=code&client_id=${lineClientId}&redirect_uri=${redirectUri}&scope=notify&state=${oauthState}`;
  window.location.href = lineAuthUrl;
}

function showGreeting() {
  const loadElem = document.getElementById('load');
  if (loadElem) {
    loadElem.textContent = `${globalState.userName}さんこんにちは`;
  }
}

function showOAuthButton() {
  const button = document.getElementById('line-notify-auth');
  if (button) {
    button.style.display = 'inline-block';
    button.addEventListener('click', (e) => {
      e.preventDefault();
      lineAuth();
    });
  }
}

function showMessageInput() {
  const wrapper = document.getElementById('message-wrapper');
  if(wrapper) {
    wrapper.style.display = 'flex';
    const button = document.getElementById('send-message-button');
    const input = document.getElementById('message-text-input') as HTMLInputElement | null;
    if (button && input) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        // sendLineMessage(input.value);
      })
    }
  }
}


function parseQueryString(query: string): { state?: string, code?: string } {
  const searchParams = new URLSearchParams(query);
  return [...searchParams.entries()].reduce((obj, e) => ({...obj, [e[0]]: e[1]}), {});
}

async function storeLineNotifyAccessToken(): Promise<string | null> {
  const params = parseQueryString(window.location.search);
  const oauthState = Cookies.get('oauthState');
  if (params.state !== oauthState ) {
    console.log('oauth state mismatch!');
    return null;
  }

  const user = firebase.auth().currentUser;
  if (user == null) return null;
  const idToken = await user.getIdToken();
  const url = process.env.STORE_TOKEN_FUNCTION_URL;
  if (url == null) return null;

  const headers = { 'Authorization': `Bearer ${idToken}` }
  const response = await axios.post<{ accessToken: string }>(url, {code: params.code}, { headers });
  const token = response.data.accessToken
  console.log(`token: ${token}`);
  return token;
}

async function getLineNotifyAccessToken(): Promise<string | null> {
  if (globalState.userId == null) return null;
  const docRef = db.collection('users').doc(globalState.userId);
  const doc = await docRef.get();
  if (doc.exists) {
    const data: any = doc.data();
    if (data.lineNotifyToken) {
      console.log(`lineNotifyToken: ${data.lineNotifyToken}`);
      return data.lineNotifyToken;
    }
  }
  console.log(`lineNotifyToken not found`);
  return null;
}

// CORSでダメだった
async function sendLineMessage(message: string): Promise<void> {
  if (globalState.accessToken == null) {
    return;
  }
  const apiUrl = 'https://notify-api.line.me/api/notify';
  const headers = { 'Authorization': `Bearer ${globalState.accessToken}` }
  const response = await axios.post<{ status: number, message: string }>(apiUrl, { message }, { headers });
  console.log(response.data);
}

async function onAuthorizeFinished(user: firebase.User): Promise<void> {
  globalState.userId = user.uid;
  globalState.userName = user.displayName;

  showGreeting();

  if (window.location.pathname === '/oauth/callback') {
    globalState.accessToken = await storeLineNotifyAccessToken();
    history.replaceState(null, '', '/');
  } else {
    globalState.accessToken = await getLineNotifyAccessToken();
  }
  if (globalState.accessToken) {
    showMessageInput();
  }
  showOAuthButton();
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
  const provider = new firebase.auth.GoogleAuthProvider();
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
