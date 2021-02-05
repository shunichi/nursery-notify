import 'core-js/stable';
import 'regenerator-runtime/runtime';
import firebase from "firebase/";
import 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import Cookies from 'js-cookie';
import axios, { AxiosResponse, AxiosError } from 'axios';

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
  // firebase.auth().useEmulator('http://localhost:9099/');
}

type TokenStatus = "valid" | "noToken" | "unknown";
type TargetType = "USER" | "GROUP";
type OAuthStatus = {
  tokenStatus: TokenStatus;
  targetType?: TargetType;
  target?: string;
};
type GlobalState = {
  userName: string | null;
  userId: string | null;
  oauthStatus: OAuthStatus;
};
const globalState: GlobalState = {
  userName: null,
  userId: null,
  oauthStatus: { tokenStatus: "unknown" },
};

function initUI() {
  initAuthButtons();
  initMessageInput();
  initOAuthButton();
  initRevokeButton();
}

function updateUI() {
  console.log('updateUI:', globalState);
  const signInedButtonIds = ['signout-button'];
  const signOutedButtonIds = ['google-auth-button'];
  const oauthableButtonIds = ['line-notify-auth'];
  const withTokenButtonIds = ['message-wrapper', 'line-notify-revoke'];
  const signedIn = (globalState.userId !== null);
  const withToken = (globalState.oauthStatus.tokenStatus === "valid");
  const target = document.getElementById('line-notify-target')
  if (target) {
    if (globalState.oauthStatus.target) {
      target.classList.remove('d-none');
      target.innerText = `メッセージ送信先: ${globalState.oauthStatus.target}`;
    } else {
      target.classList.add('d-none');
    }
  }
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
  oauthableButtonIds.forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.classList.toggle('d-none', globalState.oauthStatus.tokenStatus !== "noToken");
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

function initRevokeButton() {
  const button = document.getElementById('line-notify-revoke');
  if (button) {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!window.confirm('LINE通知を解除してよろしいですか？')) return;
      const tokenStatus = await revokeToken();
      globalState.oauthStatus = { tokenStatus };
      updateUI();
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

async function getApi<T>(path: string): Promise<AxiosResponse<T> | null> {
  const apiUrl = `${process.env.APP_BASE_URL}${path}`;
  const user = firebase.auth().currentUser;
  if (user == null) return null;
  const idToken = await user.getIdToken();
  if (idToken == null) return null;
  const headers = { 'Authorization': `Bearer ${idToken}` }
  try {
    return await axios.get<T>(apiUrl, { headers });
  } catch(error) {
    return null;
  }
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

type StatusApiResponse = OAuthStatus;
async function getTokenStatus(): Promise<OAuthStatus> {
  const response = await getApi<StatusApiResponse>("/api/line/status");
  if (response && response.data)
    return response.data;
  else
    return { tokenStatus: "unknown" };
}

async function revokeToken(): Promise<TokenStatus> {
  const response = await postApi<StatusApiResponse>("/api/line/revoke", {});
  if (response && response.data && response.data.tokenStatus)
    return response.data.tokenStatus;
  else
    return "unknown";
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
  if (globalState.oauthStatus.tokenStatus !== "valid") {
    return;
  }
  const button = document.getElementById('send-message-button');
  const input = document.getElementById('message-text-input') as HTMLInputElement | null;
  if (button) { button.classList.add('disabled'); }
  if (input) { input.disabled = true; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try {
    const response = await postApi<any>('/api/line/notify', { message });
    if (response) {
      console.log(response.data);
      if (input) { input.value = ''; }
    }
    else {
      console.log('/api/line/notify no response');
    }
  } catch {
    console.log('/api/line/notify caught exception');
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
    if (await storeLineNotifyAccessToken()) {
      globalState.oauthStatus = await getTokenStatus();
    }
    history.replaceState(null, '', '/');
  } else {
    globalState.oauthStatus = await getTokenStatus();
    console.log("tokenStatus:", globalState.oauthStatus);
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
    globalState.oauthStatus = { tokenStatus: "unknown" };
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
