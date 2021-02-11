import React, { FunctionComponent } from 'react';
import { revokeToken } from "../lib/UserStatus"

export const RevokeLineAuthButton: FunctionComponent = () => {
  return <button id="line-notify-revoke" className="btn btn-danger" onClick={() => revokeToken()}>LINE連携を解除</button>;
}
