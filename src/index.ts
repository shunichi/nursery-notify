import 'core-js/stable';
import 'regenerator-runtime/runtime';
import firebase from "firebase/";
import 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import Cookies from 'js-cookie';
import axios, { AxiosResponse } from 'axios';

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
if (location.hostname === "localhost") {
  db.useEmulator("localhost", 8080);
  firebase.auth().useEmulator('http://localhost:9099/');
}
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

function initUI() {
  initAuthButtons();
  initMessageInput();
  initOAuthButton();
}

function updateUI() {
  console.log('updateUI');
  const signInedButtonIds = ['line-notify-auth', 'signout-button'];
  const signOutedButtonIds = ['google-auth-button'];
  const withTokenButtonIds = ['message-wrapper'];
  const signedIn = (globalState.userId !== null);
  const withToken = (globalState.accessToken !== null);
  signInedButtonIds.forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.classList.toggle('d-none', !signedIn);
    }
  });
  signOutedButtonIds.forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.classList.toggle('d-none', signedIn);
    }
  });
  withTokenButtonIds.forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.classList.toggle('d-none', !withToken);
    }
  });
}


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

function initAuthButtons() {
  const signInbutton = document.getElementById('google-auth-button');
  if (signInbutton) {
    signInbutton.addEventListener('click', (e) => {
      e.preventDefault();
      googleAuth();
    });
  }
  const signOutbutton = document.getElementById('signout-button');
  if (signOutbutton) {
    signOutbutton.addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
    });
  }
}
function initOAuthButton() {
  const button = document.getElementById('line-notify-auth');
  if (button) {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      lineAuth();
    });
  }
}

function initMessageInput() {
  const wrapper = document.getElementById('message-wrapper');
  if(wrapper) {
    const button = document.getElementById('send-message-button');
    const input = document.getElementById('message-text-input') as HTMLInputElement | null;
    if (button && input) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        sendLineMessage(input.value);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendLineMessage(input.value);
        }
      });
    }
  }
}

function parseQueryString(query: string): { state?: string, code?: string } {
  const searchParams = new URLSearchParams(query);
  return [...searchParams.entries()].reduce((obj, e) => ({...obj, [e[0]]: e[1]}), {});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function postApi<T>(path: string, data: any): Promise<AxiosResponse<T> | null> {
  const apiUrl = `${process.env.APP_BASE_URL}${path}`;
  const user = firebase.auth().currentUser;
  if (user == null) return null;
  const idToken = await user.getIdToken();
  if (idToken == null) return null;
  const headers = { 'Authorization': `Bearer ${idToken}` }
  return await axios.post<T>(apiUrl, data, { headers });
}

async function storeLineNotifyAccessToken(): Promise<string | null> {
  const params = parseQueryString(window.location.search);
  const oauthState = Cookies.get('oauthState');
  if (params.state !== oauthState ) {
    console.log('oauth state mismatch!');
    return null;
  }
  const response = await postApi<{ accessToken: string }>('/api/oauth/callback', { code: params.code });
  if (response == null) return null;
  const token = response.data.accessToken
  console.log(`token: ${token}`);
  return token;
}

async function getLineNotifyAccessToken(): Promise<string | null> {
  if (globalState.userId == null) return null;
  const docRef = db.collection('users').doc(globalState.userId);
  const doc = await docRef.get();
  if (doc.exists) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = doc.data();
    if (data.lineNotifyToken) {
      console.log(`lineNotifyToken: ${data.lineNotifyToken}`);
      return data.lineNotifyToken;
    }
  }
  console.log(`lineNotifyToken not found`);
  return null;
}

async function sendLineMessage(message: string): Promise<void> {
  if (globalState.accessToken == null) {
    return;
  }
  const button = document.getElementById('send-message-button');
  const input = document.getElementById('message-text-input') as HTMLInputElement | null;
  if (button) { button.classList.add('disabled'); }
  if (input) { input.disabled = true; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try {
    const response = await postApi<any>('/api/notify', { message });
    if (response) {
      console.log(response.data);
      if (input) { input.value = ''; }
    }
    else {
      console.log('/api/notify no response');
    }
  } catch {
    console.log('/api/notify caught exception');
  } finally {
    if (button) { button.classList.remove('disabled'); }
    if (input) { input.disabled = false; }
  }
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
  updateUI();
}

function onAuthorizeRequired() {
  const loadElem = document.getElementById('load');
  if (loadElem) {
    loadElem.textContent = `ログインしてください`;
  }
  updateUI();
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

function signOut() {
  firebase.auth().signOut().then(() => {
    globalState.userId = null;
    globalState.userName = null;
    globalState.accessToken = null;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initUI();
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
});
