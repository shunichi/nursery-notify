import React, { FunctionComponent } from 'react';
import { LineAuthButton } from "../LineAuthButton";

export const NeedsLineAuth: FunctionComponent = () => {
  return (
    <div id="line-notify-auth-wrapper" className="button-wrapper">
      <h2 id="status-heading" className="mb-3">LINE連携しましょう</h2>
      <div className="text-center mb-3">LINE連携すると保育園からのお知らせが<br />LINEに送信されるようになります</div>
      <div className="text-center mb-3">下のボタンを押す前にお知らせ送信先の<br />LINEグループを作っておいてください</div>
      <LineAuthButton />
    </div>
  );
}
