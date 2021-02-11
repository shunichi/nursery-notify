import 'core-js/stable';
import 'regenerator-runtime/runtime';
import firebase from "firebase";
import 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import Cookies from 'js-cookie';
import axios, { AxiosResponse } from 'axios';
import { initAuth, signIn, signOut } from "./lib/Auth";
import { getApi, postApi } from "./lib/Api";
import React from "react";
import ReactDOM from "react-dom";
import { App } from "./components/containers/App";
import { parseQueryString } from "./lib/QueryString";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBSSE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

declare global {
  interface Window {
    db: firebase.firestore.Firestore;
  }
}

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
if (location.hostname === "localhost") {
  window.db = db;
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
type StatusApiResponse = {
  oauthStatus: OAuthStatus;
  activated: boolean;
};

type NotifyApiResponse = {
  status: number;
  message: string;
};

type GlobalState = {
  userName: string | null;
  userId: string | null;
  status: StatusApiResponse;
};

const defaultStatus = (): StatusApiResponse => ({ oauthStatus: { tokenStatus: "unknown" }, activated: false });
const globalState: GlobalState = {
  userName: null,
  userId: null,
  status: defaultStatus(),
};

// function processInvitationCode() {
//   const params = parseQueryString(window.location.search);
//   if (params.invitation) {
//     Cookies.set('invitation', params.invitation);
//   }

//   const input = document.getElementById('invitation-code-input') as HTMLInputElement | null;
//   if (input) {
//     const invitationCode = Cookies.get('invitation');
//     if (invitationCode) {
//       input.value = invitationCode;
//     }
//   }
// }

// function initUI() {
//   initAuthButtons();
//   initInvitationInput();
//   initMessageInput();
//   initOAuthButton();
//   initRevokeButton();
// }

// function updateUI() {
//   console.log('updateUI:', globalState);
//   const signInedButtonIds = ['signout-button'];
//   const signOutedButtonIds = ['google-auth-button'];
//   const oauthableButtonIds = ['line-notify-auth-wrapper'];
//   const withTokenButtonIds = ['message-wrapper', 'line-notify-revoke'];
//   const invitationCodeWrapper = document.getElementById('invitation-code-wrapper');
//   const signedIn = (globalState.userId !== null);
//   const withToken = (globalState.status.oauthStatus.tokenStatus === "valid");
//   const target = document.getElementById('line-notify-target')

//   if (target) {
//     if (globalState.status.oauthStatus.target) {
//       target.classList.remove('d-none');
//       target.innerText = `（送信先: ${globalState.status.oauthStatus.target}）`;
//     } else {
//       target.classList.add('d-none');
//     }
//   }
//   const showInvitationCodeInput = globalState.userId != null && !globalState.status.activated;
//   const showLineAuthButton = globalState.status.oauthStatus.tokenStatus === "noToken" && !showInvitationCodeInput;

//   if (invitationCodeWrapper) {
//     invitationCodeWrapper.classList.toggle("d-block", showInvitationCodeInput);
//   }
//   signInedButtonIds.forEach((id) => {
//     const button = document.getElementById(id);
//     if (button) {
//       button.classList.toggle('d-none', !signedIn);
//     }
//   });
//   signOutedButtonIds.forEach((id) => {
//     const button = document.getElementById(id);
//     if (button) {
//       button.classList.toggle('d-none', signedIn);
//     }
//   });
//   withTokenButtonIds.forEach((id) => {
//     const button = document.getElementById(id);
//     if (button) {
//       button.classList.toggle('d-none', !withToken || showInvitationCodeInput);
//     }
//   });
//   oauthableButtonIds.forEach((id) => {
//     const button = document.getElementById(id);
//     if (button) {
//       button.classList.toggle('d-none', !showLineAuthButton);
//     }
//   });
// }


// function lineAuth() {
//   if (globalState.userId == null) return;

//   const oauthState = uuidv4();
//   Cookies.set('oauthState', oauthState);
//   const lineClientId = process.env.LINE_NOTIFY_OAUTH_CLIENT_ID;
//   const redirectUri = process.env.LINE_NOTIFY_OAUTH_CALLBACK_URL;
//   const lineAuthUrl = `https://notify-bot.line.me/oauth/authorize?response_type=code&client_id=${lineClientId}&redirect_uri=${redirectUri}&scope=notify&state=${oauthState}`;
//   window.location.href = lineAuthUrl;
// }

// function showGreeting() {
//   const loadElem = document.getElementById('load');
//   if (loadElem) {
//     loadElem.textContent = `${globalState.userName}さんこんにちは`;
//   }
// }

// function initAuthButtons() {
//   const signInbutton = document.getElementById('google-auth-button');
//   if (signInbutton) {
//     signInbutton.addEventListener('click', (e) => {
//       e.preventDefault();
//       signIn();
//     });
//   }
//   const signOutbutton = document.getElementById('signout-button');
//   if (signOutbutton) {
//     signOutbutton.addEventListener('click', (e) => {
//       e.preventDefault();
//       signOut();
//     });
//   }
// }

// function initOAuthButton() {
//   const button = document.getElementById('line-notify-auth');
//   if (button) {
//     button.addEventListener('click', (e) => {
//       e.preventDefault();
//       lineAuth();
//     });
//   }
// }

// function initRevokeButton() {
//   const button = document.getElementById('line-notify-revoke');
//   if (button) {
//     button.addEventListener('click', async (e) => {
//       e.preventDefault();
//       if (!window.confirm('LINE通知を解除してよろしいですか？')) return;
//       globalState.status = await revokeToken();
//       updateUI();
//     });
//   }
// }

// function initInvitationInput() {
//   const button = document.getElementById('invitation-button');
//   const input = document.getElementById('invitation-code-input') as HTMLInputElement | null;
//   if (button && input) {
//     button.addEventListener('click', (e) => {
//       e.preventDefault();
//       sendInvitationCode(input.value);
//     });
//     input.addEventListener('keydown', (e) => {
//       if (e.key === 'Enter') {
//         e.preventDefault();
//         sendInvitationCode(input.value);
//       }
//     });
//   }
// }

// function initMessageInput() {
//   const wrapper = document.getElementById('message-wrapper');
//   if(wrapper) {
//     const button = document.getElementById('send-message-button');
//     const input = document.getElementById('message-text-input') as HTMLInputElement | null;
//     if (button && input) {
//       button.addEventListener('click', (e) => {
//         e.preventDefault();
//         sendLineMessage(input.value);
//       });
//       input.addEventListener('keydown', (e) => {
//         if (e.key === 'Enter') {
//           e.preventDefault();
//           sendLineMessage(input.value);
//         }
//       });
//     }
//   }
// }

// async function createLineNotifyAccessToken(): Promise<string | null> {
//   const params = parseQueryString(window.location.search);
//   const oauthState = Cookies.get('oauthState');
//   if (params.state !== oauthState ) {
//     console.log('oauth state mismatch!');
//     return null;
//   }
//   try {
//     const response = await postApi<{ accessToken: string }>('/api/oauth/callback', { code: params.code });
//     if (response == null) return null;
//     const token = response.data.accessToken
//     console.log(`token created: ${token}`);
//     return token;
//   } catch(error) {
//     console.log(`token creation faild`)
//     return null;
//   }
// }

// async function getStatus(): Promise<void> {
//   const response = await getApi<StatusApiResponse>("/api/status");
//   if (response && response.data) {
//     globalState.status = response.data;
//   } else {
//     globalState.status = defaultStatus();
//   }
// }


// async function sendInvitationCode(code: string): Promise<void> {
//   const button = document.getElementById('invitation-button');
//   const input = document.getElementById('invitation-code-input') as HTMLInputElement | null;
//   if (input == null || button == null) return;

//   button.classList.add('disabled');
//   input.disabled = true;
//   try {
//     const response = await postApi<NotifyApiResponse>('/api/activate', { code });
//     if (response) {
//       console.log(response.data);
//       input.value = '';
//       await getStatus();
//       updateUI();
//       history.replaceState(null, '', '/');
//       Cookies.remove('invitation');
//     }
//     else {
//       console.log('/api/activate no response');
//     }
//   } catch (error) {
//     console.log('/api/activate faild', error?.response.data);
//   } finally {
//     button.classList.remove('disabled');
//     input.disabled = false;
//   }
// }

async function sendLineMessage(message: string): Promise<void> {
  if (message === "") return;
  if (globalState.status.oauthStatus.tokenStatus !== "valid") {
    return;
  }
  const button = document.getElementById('send-message-button');
  const input = document.getElementById('message-text-input') as HTMLInputElement | null;
  if (button == null || input == null) return;
  button.classList.add('disabled');
  input.disabled = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try {
    const response = await postApi<NotifyApiResponse>('/api/line/notify', { message });
    if (response) {
      console.log(response.data);
      input.value = '';
    }
    else {
      console.log('/api/line/notify no response');
    }
  } catch {
    console.log('/api/line/notify caught exception');
  } finally {
    button.classList.remove('disabled');
    input.disabled = false;
  }
}

async function storeUserInfo(user: firebase.User) {
  const docRef = db.collection('users').doc(user.uid);
  const { email, displayName, providerId } = user;
  await docRef.set({ email, displayName, providerId }, { merge: true });
}

async function sleep(time: number): Promise<void> {
  return new Promise((resolve, _) => {
      setTimeout(() => {
          resolve();
      }, time);
  });
}

// function showSpinner() {
//   const spinner = document.getElementById("spinner");
//   if (spinner) {
//     console.log("show spinner");
//     spinner.classList.remove("d-none");
//   }
// }

// function hideSpinner() {
//   const spinner = document.getElementById("spinner");
//   if (spinner) {
//     console.log("hide spinner");
//     spinner.classList.add("d-none");
//   }
// }

// async function showSppinerWhile(func: () => Promise<void>): Promise<void> {
//   try
//   {
//     showSpinner();
//     await func();
//   } finally {
//     hideSpinner();
//   }
// }

// async function processOauthCallback() {
//   const params = parseQueryString(window.location.search);
//   if (params.code != null) {
//     if (await createLineNotifyAccessToken()) {
//       await getStatus();
//     } else {
//       alert('LINE連携処理に失敗しました');
//     }
//   } else {
//     await getStatus();
//   }
//   history.replaceState(null, '', '/');
// }

// async function showArticle() {
//   const data = await getArticleAttached(window.location.pathname);
//   if (data) {
//     window.location.href = data.url;
//     return;
//   } else {
//     alert("エラーが発生しました");
//   }
// }

// async function onAuthorizeFinished(user: firebase.User): Promise<void> {
//   globalState.userId = user.uid;
//   globalState.userName = user.displayName;
//   storeUserInfo(user);

//   showGreeting();

//   if (window.location.pathname === '/oauth/callback') {
//     await processOauthCallback();
//   } else {
//     await getStatus();
//     console.log("status:", globalState.status);
//     if (window.location.pathname.startsWith('/articles/')) {
//       await showArticle();
//     }
//   }
//   hideSpinner();
//   updateUI();
// }

// function onAuthorizeRequired() {
//   const loadElem = document.getElementById('load');
//   if (loadElem) {
//     loadElem.textContent = `ログインしてください`;
//   }
//   hideSpinner();
//   updateUI();
// }

// function onSignout() {
//   globalState.userId = null;
//   globalState.userName = null;
//   globalState.status = defaultStatus();
//   updateUI();
// }

const initApp = () => {
  const root = document.getElementById("app-root");
  ReactDOM.render(<App />, root);
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  // showSpinner();
  // processInvitationCode();
  // initUI();
  // initAuth(onAuthorizeFinished, onAuthorizeRequired, onSignout);
});
