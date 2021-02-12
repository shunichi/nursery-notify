import { useState } from 'react';

type ExecFunc = () => Promise<void>;
export const useDisabled = (): [boolean, (f: ExecFunc) => void] => {
  const [disabled, setDisabled] = useState(false);

  const func = async (f: ExecFunc) => {
    setDisabled(true);
    await f();
    setDisabled(false);
  }

  return [disabled, func];
};
