import React, { FunctionComponent, useState } from "react"
import { sendActivationCode } from "../lib/Activation";
import { checkUserStatus } from "../lib/UserStatus";
import { useDisabled } from "../lib/Disabled";

type ActivationFormProps = {
  code: string;
};

export const ActivationForm: FunctionComponent<ActivationFormProps> = (props: ActivationFormProps) => {
  const [code, setCode] = useState(props.code);
  const [disabled, disabledFunc] = useDisabled();

  const sendCode = async (): Promise<void> => {
    if (await sendActivationCode(code)) {
      await checkUserStatus();
    }
  }

  const submit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    disabledFunc(sendCode);
  };

  return (
    <div className="button-wrapper">
      <div className="text-center mb-2">招待コードを入力してください</div>
      <form onSubmit={submit} className="d-flex justify-content-center">
        <input id="invitation-code-input" type="text" className="form-control" placeholder="招待コード" disabled={disabled} value={code} onChange={(e) => setCode(e.target.value)} />
        <button type="submit" id="invitation-button" className="btn btn-primary text-nowrap" disabled={disabled || code === ""}>送信</button>
      </form>
    </div>
  );
};
