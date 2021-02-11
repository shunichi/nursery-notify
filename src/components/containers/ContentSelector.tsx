import React, { FunctionComponent } from 'react';
import firebase from "firebase";
import { Spinner } from "../Spinner";
import { RevokeLineAuthButton } from "../RevokeLineAuthButton"
import { ActivationForm } from "../ActivationForm"
import { LineAuthButton } from "../LineAuthButton"
import { UserStatus } from "../../lib/UserStatus";
import { parseQueryString } from "../../lib/QueryString";

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
        return (
        <>
          <div className="text-center">LINE連携してません</div>
          <div className="button-wrapper"><LineAuthButton /></div>
        </>
        );
      case "valid":
        return (
          <>
            <div className="text-center">LINE連携されています</div>;
            <div className="button-wrapper"><RevokeLineAuthButton /></div>
          </>
        );
      default:
        return null;
    }
  } else {
    const params = parseQueryString(window.location.search);
    const code = params.invitation || "";
    return <ActivationForm code={code} />;
  }
}
