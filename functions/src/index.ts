import * as fs from "fs";
import * as functions from "firebase-functions";
import * as firebase from "firebase-admin";
import axios from "axios";
import * as querystring from "querystring";
import * as FormData from "form-data";
import * as corsLib from "cors";
import * as express from "express";
import * as cookieParser from "cookie-parser";
import { getBrowserPage, scrapeAndDownloadFile, notifyPdfAsImages } from "./scraping";

const app = express();
const cors = corsLib({origin: true});;

firebase.initializeApp();
const db = firebase.firestore();

type OAuthTokenResponse = {
  access_token: string; // eslint-disable-line camelcase
};

type NotifyResponse = {
  status: number;
  message: string;
};

type UserIdAndToken = {
  uid: string;
  lineNotifyToken: string;
};

async function getUserIdAndTokens(): Promise<UserIdAndToken[]> {
  const result: UserIdAndToken[] = [];
  const querySnapshot = await db.collection("users").where("lineNotifyToken", "!=", null).get();
  // const querySnapshot = await db.collection("users").get();
  querySnapshot.forEach(function(doc) {
    const data: any = doc.data();
    result.push({ uid: doc.id, lineNotifyToken: data.lineNotifyToken });
  });
  return result;
}

async function notifyMessageToAll(userIdAndTokens: UserIdAndToken[], message: string, imageBuffer?: Buffer): Promise<UserIdAndToken[]> {
  console.log("notifyMessageToAll", userIdAndTokens, message, imageBuffer?.length);
  const formData = new FormData();
  formData.append("message", message);
  if (imageBuffer) {
    console.log(`image size: ${imageBuffer.byteLength}`);
    await fs.promises.mkdir("./tmp", { recursive: true });
    await fs.promises.writeFile("./tmp/image.jpg", imageBuffer);
    // Bufferをそのまま送ると 500 エラーになった
    // よくわからないが、一度ファイルに書いて送ると送れた
    formData.append("imageFile", fs.createReadStream("./tmp/image.jpg"));
    // formData.append("imageFile", imageBuffer, {
    //   filename: 'image.jpg',
    //   contentType: 'image/jpeg',
    //   knownLength: imageBuffer.length,
    //   });
  }
  const succeeded: UserIdAndToken[] = [];
  for(let userIdAndToken of userIdAndTokens) {
    const headers = { ...formData.getHeaders(), "Authorization": `Bearer ${userIdAndToken.lineNotifyToken}` };
    try {
      await axios.post("https://notify-api.line.me/api/notify", formData, { headers });
      succeeded.push(userIdAndToken);
    } catch (error) {
      functions.logger.info("notify api error", { response: { status: error.response.status, data: error.response.data } });
    }
  }
  return succeeded;
}

async function sendMessage(user: firebase.auth.DecodedIdToken, message: string): Promise<NotifyResponse | null> {
  const docRef = db.collection("users").doc(user.uid);
  const doc = await docRef.get();
  if (!doc.exists) {
    functions.logger.info("User doc not exists", { user });
    return null;
  }

  const data: any = doc.data();
  if (data.lineNotifyToken == null)   {
    functions.logger.info("token not exists", { data });
    return null;
  }

  functions.logger.info("Call notify api", { message });
  const params = new URLSearchParams();
  params.append("message", message);
  const headers = { "Authorization": `Bearer ${data.lineNotifyToken}` }
  const response = await axios.post<NotifyResponse>("https://notify-api.line.me/api/notify", params, { headers });
  return response.data;
}

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

const validateFirebaseIdToken = async (req: any, res: any, next: any) => {
  if (req.path === "/api/scraping") {
    next();
    return;
  }

  console.log("Check if request is authorized with Firebase ID token");

  if (!req.headers.authorization || !req.headers.authorization.startsWith("Bearer ")) {
    console.error("No Firebase ID token was passed as a Bearer token in the Authorization header.",
        "Make sure you authorize your request by providing the following HTTP header:",
        "Authorization: Bearer <Firebase ID Token>");
    res.status(403).send("Unauthorized");
    return;
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    console.log("Found \"Authorization\" header");
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split("Bearer ")[1];
  } else {
    // No cookie
    console.log("No authorization");
    res.status(403).send("Unauthorized");
    return;
  }

  try {
    const decodedIdToken = await firebase.auth().verifyIdToken(idToken);
    console.log("ID Token correctly decoded", decodedIdToken);
    req.user = decodedIdToken;
    next();
    return;
  } catch (error) {
    console.error("Error while verifying Firebase ID token:", error);
    res.status(403).send("Unauthorized");
    return;
  }
};

app.use(cors);
app.use(cookieParser());
app.use(validateFirebaseIdToken);

app.post("/api/oauth/callback", async (req: any, res:  any) => {
  functions.logger.info("/api/oauth/callback", { body: req.body, cookies: req.cookies });
  const { code } = req.body;
  if ( typeof code !== "string") {
    res.status(422).json({error: "code required"});
    return;
  }
  // if (req.cookies.oauthState !== state) {
  //   res.status(422).json({error: "state mismatch"});
  //   return;
  // }

  const accessToken = await processRequest(req.user, code);
  if (accessToken == null)  {
    res.status(422).json({error: "failed"});
    return;
  }
  res.json({ accessToken });
});

app.post("/api/notify", async (req: any, res): Promise<void> => {
  // res.json({ message: "hello, notify!"});
  const { message } = req.body;
  const response = await sendMessage(req.user, message);
  if (response) {
    res.json(response);
  } else {
    res.json({ message: "faild"});
  }
})

app.get("/api/status", (req, res) => {
  res.json({ message: "hello, status!", cookies: req.cookies});
})

app.post("/api/scraping", async (_req, res) => {
  const userIdAndTokens = await getUserIdAndTokens();
  if (userIdAndTokens.length == 0) {
    res.json({ message: "No valid tokens" });
    return;
  }
  const config = functions.config();
  const { browser, page } = await getBrowserPage(false);
  const textAndFile = await scrapeAndDownloadFile(page, { id: config.ra9.user_id, password: config.ra9.password });
  browser.close();
  console.log(textAndFile);
  if (textAndFile) {
    const message = (textAndFile.title || textAndFile.text) ? [textAndFile.title, textAndFile.text].join("\n") : "保育園からのお知らせです。"
    let succeeded = [...userIdAndTokens];
    if (/\.pdf$/.test(textAndFile.filePath)) {
      try {
        succeeded = await notifyMessageToAll(succeeded, message);
        await notifyPdfAsImages(textAndFile, async (message: string, imageBuffer?: Buffer): Promise<void> => {
          succeeded = await notifyMessageToAll(succeeded, message, imageBuffer);
        });
      } catch(error) {
        if (error.response) {
          console.log(error.response.data);
        } else {
          console.log(error);
        }
      }
    } else {
      succeeded = await notifyMessageToAll(succeeded, message);
    }
    res.json({ message: "Succeeded", count: succeeded.length });
  } else {
    res.json({ mssage: "No messages" })
  }
});

export const api = functions.https.onRequest(app);
