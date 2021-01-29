import * as functions from "firebase-functions";
import * as firebase from "firebase-admin";
import axios from "axios";
import * as querystring from "querystring";
import * as corsLib from "cors";
const cors = corsLib({origin: true});;


firebase.initializeApp();
const db = firebase.firestore();

type OAuthTokenResponse = {
  access_token: string; // eslint-disable-line camelcase
};

async function getAccessToken(code: string): Promise<string | null> {
  const config = functions.config();
  const lineClientId = config.line_notify.oauth_client_id;
  const lineClientSecret = config.line_notify.oauth_client_secret;
  const redirectUri = config.line_notify.oauth_callback_url;
  const data = querystring.stringify({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
    client_id: lineClientId,
    client_secret: lineClientSecret
  });
  try {
    functions.logger.info("Call oauth token api", { data });
    const response = await axios.post<OAuthTokenResponse>("https://notify-bot.line.me/oauth/token", data);
    functions.logger.info("OAuth Token", { data: response.data });
    return response.data.access_token;
  } catch(error) {
    functions.logger.error("api error", error);
    return null;
  }
}

async function verifyIdToken(req: functions.https.Request): Promise<firebase.auth.DecodedIdToken | null> {
  let idToken: string | null = null;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    functions.logger.info("Found \"Authorization\" header");
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split("Bearer ")[1];
  }
  if (idToken == null) return null;

  try {
    const decodedIdToken = await firebase.auth().verifyIdToken(idToken);
    functions.logger.info(`ID Token correctly decoded: ${decodedIdToken}`);
    return decodedIdToken;
  } catch (error) {
    return null;
  }
}

async function processRequest(user: firebase.auth.DecodedIdToken, code: string): Promise<string | null> {
  const docRef = db.collection("users").doc(user.uid);
  const accessToken = await getAccessToken(code);
  if (accessToken == null) {
    return null;
  }

  // TODO: 許可されたユーザーかチェック
  // const doc = await docRef.get();
  // if (doc.exists) {
  //   const data: any = doc.data();
  // }

  await docRef.set({ lineNotifyToken: accessToken });
  functions.logger.info("token saved", { accessToken });
  return accessToken;
}

export const storeToken = functions.https.onRequest(async (req, res): Promise<void> => {
  cors(req, res, async () => {
    const { code } = req.body;
    functions.logger.info(`storeToken called: ${JSON.stringify(req.body)}`, { code: code });
    if ( typeof code !== "string") {
      res.status(422).json({error: "code required"});
      return;
    }
    const user = await verifyIdToken(req);
    if (user == null) {
      res.status(403).json({error: "Unauthorized"});
      return;
    }

    const accessToken = await processRequest(user, code);
    if (accessToken == null)  {
      res.status(422).json({error: "failed"});
      return;
    }
    res.json({ accessToken });
  })
});
