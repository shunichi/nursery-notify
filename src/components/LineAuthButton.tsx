import React, { FunctionComponent } from 'react';
import { startLineAuth } from "../lib/LineAuth";

export const LineAuthButton: FunctionComponent = () => {
  return <button id="line-notify-auth" className="btn btn-success" onClick={() => startLineAuth()}>LINE連携する</button>;
}
