import React, { FunctionComponent, useState, useEffect } from 'react';
import firebase from "firebase";
import { initAuth } from "../../lib/Auth";
import { useUserStatus, checkUserStatus, initUserStatus } from "../../lib/UserStatus";
import { ContentSelector } from "./ContentSelector";
import { OAuthCallbackProcessor } from "./OAuthCallbackProcessor"
import { SignInButton } from "../SignInButton";
import { SignOutButton } from "../SignOutButton";
import "../../styles/app.scss";

const useAuth = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<firebase.User | null>(null);
  useEffect(() => {
    const onAuthorized = async (user: firebase.User): Promise<void> => {
      setInitializing(false);
      setUser(user);
      checkUserStatus();
    };
    const onNotAuthorized = () => {
      setInitializing(false);
    }
    const onSignOut = () => {
      setUser(null);
      initUserStatus();
    };
    initAuth(onAuthorized, onNotAuthorized, onSignOut);
  }, []);
  return { initializing, user };
}

export const App: FunctionComponent = () => {
  const authStatus = useAuth();
  const userStatus = useUserStatus();

  if (authStatus.initializing) {
    return <div id="load">Loading&hellip;</div>;
  } else if(authStatus.user) {
    if (window.location.pathname === '/oauth/callback') {
      return <OAuthCallbackProcessor />;
    } else {
      return (<>
        <div id="load">{authStatus.user.displayName}さん こんにちは</div>
        <ContentSelector user={authStatus.user} userStatus={userStatus} />
        <div className="button-wrapper mb-4">
          <SignOutButton />
        </div>
      </>);
    }
  } else {
    return (<>
      <div id="load">ログインしてください</div>
      <div className="button-wrapper mb-4">
        <SignInButton />
      </div>
    </>);
  }
};
