import { v4 as uuidv4 } from 'uuid';
import Cookies from 'js-cookie';
import { postApi } from "./Api";
import { parseQueryString } from "./QueryString";

export const startLineAuth = (): void => {
  const oauthState = uuidv4();
  Cookies.set('oauthState', oauthState);
  const lineClientId = process.env.LINE_NOTIFY_OAUTH_CLIENT_ID;
  const redirectUri = process.env.LINE_NOTIFY_OAUTH_CALLBACK_URL;
  const lineAuthUrl = `https://notify-bot.line.me/oauth/authorize?response_type=code&client_id=${lineClientId}&redirect_uri=${redirectUri}&scope=notify&state=${oauthState}`;
  window.location.href = lineAuthUrl;
}

export async function createLineNotifyAccessToken(): Promise<string | null> {
  const params = parseQueryString(window.location.search);
  const oauthState = Cookies.get('oauthState');
  if (params.state !== oauthState ) {
    console.log('oauth state mismatch!');
    return null;
  }
  try {
    const response = await postApi<{ accessToken: string }>('/api/oauth/callback', { code: params.code });
    if (response == null) return null;
    const token = response.data.accessToken
    console.log(`token created: ${token}`);
    return token;
  } catch(error) {
    console.log(`token creation faild`)
    return null;
  }
}
