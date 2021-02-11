import React, { FunctionComponent } from 'react';
import { signOut } from "../lib/Auth";

export const SignOutButton: FunctionComponent = () => {
  return <button id="signout-button" className="btn btn-outline-secondary" onClick={() => signOut()}>ログアウトする</button>;
}
