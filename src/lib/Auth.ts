import firebase from "firebase/";

type AuthorizedCallback = (user: firebase.User) => Promise<void>;
type NotAuthorizedCallback = () => void;
type SignoutCallback = () => void;
type State = {
  onSignout: SignoutCallback | null;
};

const state: State = { onSignout: null };

export function signIn(): Promise<void> {
  const provider = new firebase.auth.GoogleAuthProvider();
  return firebase.auth().signInWithRedirect(provider);
}

export function signOut(): Promise<void> {
  return firebase.auth().signOut().then(() => {
    if (state.onSignout) {
      state.onSignout();
    }
  });
}

export function initAuth(onAuthorized: AuthorizedCallback, onNotAutrhoized: NotAuthorizedCallback, onSignout: SignoutCallback): void {
  state.onSignout = onSignout;

  const timeBegin = Date.now();
  firebase.auth().getRedirectResult().then((result) => {
    if (result.credential && result.user) {
      console.log("getRedirectResult finished");
    } else {
      console.log("getRedirectResult returns null credential or user");
    }
  }).catch((error) => {
    console.error("getRedirectResult faild", error);
  });

  firebase.auth().onAuthStateChanged(function(user) {
    const timeAuthChanged = Date.now();
    console.log(`auth check time: ${(timeAuthChanged - timeBegin) / 1000}sec`);
    if (user) {
      console.log('authorized');
      onAuthorized(user);
    } else {
      console.log('not authorized');
      onNotAutrhoized();
    }
  });
}
