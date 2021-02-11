import React, { FunctionComponent, useEffect } from "react";
import { Spinner } from "../Spinner";
import { createLineNotifyAccessToken } from "../../lib/LineAuth";
import { checkUserStatus } from "../../lib/UserStatus";

async function processOAuthCallback() {
  if (await createLineNotifyAccessToken()) {
    history.replaceState(null, '', '/');
    await checkUserStatus();
  } else {
    alert('LINE連携処理に失敗しました');
    history.replaceState(null, '', '/');
  }
}

export const OAuthCallbackProcessor: FunctionComponent = () => {
  useEffect(() => {
    processOAuthCallback();
  }, []);
  return <Spinner />;
}
