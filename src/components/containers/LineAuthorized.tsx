import React, { FunctionComponent } from 'react';
import { RevokeLineAuthButton } from "../RevokeLineAuthButton"
import { SendMessageForm } from "../SendMessageForm"
import { useUserStatus } from "../../lib/UserStatus";

export const LineAuthorized: FunctionComponent = () => {
  const userStatus = useUserStatus();
  return (
    <div id="message-wrapper">
      <div className="text-center">
        <h2 id="status-heading" className="mb-3">LINE連携が完了しました</h2>
        <ul className="text-start">
          <li>「LINE Notify」が友達に追加されていますので、送信先LINEグループに参加させてくだい</li>
          <li>よかったら家族も同じLINEグループに招待してください</li>
        </ul>
      </div>
      <div className="text-center mt-3">
        夕方に保育園からのお知らせがLINEに送られます
      </div>
      <div className="group-box">
        <div className="text-center">
          LINEにテストメッセージを送信できます
          <div id="line-notify-target">
          （送信先: {userStatus.oauthStatus.target}）
          </div>
        </div>
        <SendMessageForm />
      </div>
      <div className="button-wrapper"><RevokeLineAuthButton /></div>
    </div>
  );
}
