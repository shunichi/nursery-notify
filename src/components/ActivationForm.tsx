import React, { FunctionComponent, useState } from "react"
import { sendActivationCode } from "../lib/Activation";
import { checkUserStatus } from "../lib/UserStatus";

type ActivationFormProps = {
  code: string;
};

export const ActivationForm: FunctionComponent<ActivationFormProps> = (props: ActivationFormProps) => {
  const [code, setCode] = useState(props.code);
  const [disabled, setDisabled] = useState(false);

  const sendCode = async (code: string): Promise<void> => {
    setDisabled(true);
    if (await sendActivationCode(code)) {
      await checkUserStatus();
    } else {
      setDisabled(false);
    }
  };

  return (
    <div className="button-wrapper">
      <div className="text-center mb-2">招待コードを入力してください</div>
      <div className="d-flex justify-content-center">
        <input id="invitation-code-input" type="text" className="form-control" placeholder="招待コード" disabled={disabled} value={code} onChange={(e) => setCode(e.target.value)} />
        <button id="invitation-button" className="btn btn-primary text-nowrap" disabled={disabled} onClick={() => sendCode(code)}>送信</button>
      </div>
    </div>
  );
};
