import { getApi, postApi } from "./Api";
import { useState, useEffect } from "react";

type TokenStatus = "valid" | "noToken" | "unknown" | "checking";
type TargetType = "USER" | "GROUP";
type OAuthStatus = {
  tokenStatus: TokenStatus;
  targetType?: TargetType;
  target?: string;
};
type StatusApiResponse = {
  oauthStatus: OAuthStatus;
  activated: boolean;
};

export type UserStatus = StatusApiResponse;
const defaultStatus = (): StatusApiResponse => ({ oauthStatus: { tokenStatus: "checking" }, activated: false });

type State = {
  userStatus: StatusApiResponse;
};
const state: State = {
  userStatus: defaultStatus(),
}

type StatusChanged = (status: StatusApiResponse) => void;

let subscribers: StatusChanged[] = [];
const subscribe = (func: StatusChanged): void => {
  subscribers.push(func);
}

const unsubscribe = (func: StatusChanged): void => {
  subscribers = subscribers.filter((f) => f != func);
}

const fire = (status: StatusApiResponse): void => {
  subscribers.forEach((f) => f(status));
}

export function initUserStatus(): void {
  state.userStatus = defaultStatus();
  fire(state.userStatus);
}

export async function checkUserStatus(): Promise<void> {
  const response = await getApi<StatusApiResponse>("/api/status");
  if (response && response.data) {
    state.userStatus = response.data;
  } else {
    state.userStatus = defaultStatus();
  }
  fire(state.userStatus);
}

export async function revokeToken(): Promise<void> {
  const response = await postApi<StatusApiResponse>("/api/line/revoke", {});
  if (response && response.data) {
    state.userStatus = response.data;
  } else {
    state.userStatus = defaultStatus();
  }
  fire(state.userStatus);
}

export const useUserStatus = (): StatusApiResponse => {
  const [userStatus, setUserStatus] = useState(state.userStatus);

  useEffect(() => {
    const updateStatus = (status: StatusApiResponse): void => {
      console.log(status.oauthStatus.tokenStatus);
      setUserStatus(status);
    }
    subscribe(updateStatus);

    return () => {
      unsubscribe(updateStatus);
    };
  }, []);

  return userStatus;
}
