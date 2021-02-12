import React, { FunctionComponent } from 'react';
import firebase from "firebase";
import { Activation } from "./Activation";
import { NeedsLineAuth } from "./NeedsLineAuth";
import { LineAuthorized } from "./LineAuthorized";
import { Spinner } from "../Spinner";
import { UserStatus } from "../../lib/UserStatus";

type ContentSelectorProps = {
  user: firebase.User;
  userStatus: UserStatus;
};

export const ContentSelector: FunctionComponent<ContentSelectorProps> = (props: ContentSelectorProps) => {
  const { oauthStatus, activated } = props.userStatus;
  if (oauthStatus.tokenStatus === "checking") {
    return <Spinner />;
  } else if (activated) {
    switch(oauthStatus.tokenStatus) {
      case "unknown":
        return <div className="text-center">エラーが発生しました</div>;
      case "noToken":
        return <NeedsLineAuth />;
      case "valid":
        return <LineAuthorized />;
      default:
        return null;
    }
  } else {
    return <Activation />;
  }
}
