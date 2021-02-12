import React, { FunctionComponent, useState } from 'react';
import { sendLineMessage } from "../lib/SendLineMessage";
import { useDisabled } from "../lib/Disabled";

export const SendMessageForm: FunctionComponent = () => {
  const [message, setMessage] = useState("");
  const [disabled, disabledFunc] = useDisabled();

  const sendMessage = async (): Promise<void> => {
    if (await sendLineMessage(message)) {
      setMessage("");
    }
  }

  return (
    <div className="d-flex justify-content-center">
      <input type="text" id="message-text-input" className="form-control" placeholder="メッセージ" disabled={disabled} value={message} onChange={(e) => setMessage(e.currentTarget.value) } />
      <button id="send-message-button" className="btn btn-primary text-nowrap" disabled={disabled} onClick={() => disabledFunc(sendMessage) }>送信</button>
    </div>
  );
}
