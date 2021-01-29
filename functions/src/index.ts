import * as functions from "firebase-functions";
import * as firebase from "firebase-admin";
import axios from "axios";
import * as querystring from "querystring";

firebase.initializeApp();
const db = firebase.firestore();

type OAuthTokenResponse = {
  access_token: string; // eslint-disable-line camelcase
};

async function getAccessToken(code: string): Promise<string> {
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
  const response = await axios.post<OAuthTokenResponse>("https://notify-bot.line.me/oauth/token", data);
  functions.logger.info("OAuth Token", { data: response.data });
  return response.data.access_token;
}

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

// type UserData = {
//   oauthStateToken?: string;
// }

// const userDataConverter = {
//   toFirestore(userData: UserData): firebase.firestore.DocumentData {
//     return {oauthStateToken: userData.oauthStateToken};
//   },
//   fromFirestore(
//     snapshot: firebase.firestore.QueryDocumentSnapshot,
//     options: firebase.firestore.SnapshotOptions
//   ): UserData {
//     const data = snapshot.data(options)!;
//     return { oauthStateToken: data.oauthStateToken };
//   }
// };

export const helloWorld = functions.https.onRequest((req, response) => {
  const { code, state } = req.query;
  functions.logger.info(`oauth: ${JSON.stringify(req.query)}`, { code: code });
  if ( typeof code === "string" && typeof state === "string") {
    const [userId, oauthStateToken] = state.split(":");
    functions.logger.info(`userId=${userId}, token=${oauthStateToken}`, { code: code });
    if ( userId != null && oauthStateToken != null ) {
      const docRef = db.collection("users").doc(userId);
      docRef.get().then((doc) => {
        if (doc.exists) {
          const data: any = doc.data();
          functions.logger.info("doc get", { data });
          if ( data.oauthStateToken === oauthStateToken ) {
            getAccessToken(code).then((token) => {
              docRef.set({ lineNotifyToken: token, oauthStateToken: null }).then(() => {
                functions.logger.info("token saved", { token: token });
              })
            })
          }
        }
      })
    }
  }
  response.send("Hello from Firebase!");
});
