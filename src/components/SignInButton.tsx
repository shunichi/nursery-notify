import React, { FunctionComponent } from 'react';
import { signIn } from "../lib/Auth";

export const SignInButton: FunctionComponent = () => {
  return <button id="google-auth-button" className="btn btn-primary" onClick={() => signIn()}>Googleアカウントでログインする</button>;
}
