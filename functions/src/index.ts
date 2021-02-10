import * as fs from "fs";
import * as functions from "firebase-functions";
import * as firebase from "firebase-admin";
import axios from "axios";
import type { AxiosError } from "axios";
import * as querystring from "querystring";
import * as FormData from "form-data";
import * as corsLib from "cors";
import * as express from "express";
import * as cookieParser from "cookie-parser";
import { DateTime } from "luxon";
import { getBrowserPage, loginAndGetArticleList, scrapeDetailPage, notifyPdfAsImages, Article, TextAndFile } from "./scraping";

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

async function getAllUserIdAndTokens(): Promise<UserIdAndToken[]> {
  const result: UserIdAndToken[] = [];
  const querySnapshot = await db.collection("users").where("lineNotifyToken", "!=", null).get();
  // const querySnapshot = await db.collection("users").get();
  querySnapshot.forEach(function(doc) {
    const data: any = doc.data();
    result.push({ uid: doc.id, lineNotifyToken: data.lineNotifyToken });
  });
  return result;
}

async function getUserIdAndToken(userId: string): Promise<UserIdAndToken | null> {
  // console.log(`userId: ${userId}`);
  const docRef = await db.collection("users").doc(userId);
  const doc = await docRef.get();
  // console.log(doc);
  if (!doc.exists) return null;
  const data = doc.data() as any;
  // console.log("data:", JSON.stringify(data));
  // console.log(`lineNotifyToken: ${data.lineNotifyToken}`);
  if (data.lineNotifyToken)
    return { uid: doc.id, lineNotifyToken: data.lineNotifyToken };
  else
    return null;
}

type StatusApiResponse = {
  status: number;
  message: string;
  targetType?: string;
  target?: string;
};

function isAxiosError(error: any): error is AxiosError {
  return error.isAxiosError === true;
}
function authHeader(token: string): { Authorization: string }  {
  return { "Authorization": `Bearer ${token}` };
}

async function clearToken(userIdAndToken: UserIdAndToken): Promise<void> {
  const docRef = db.collection("users").doc(userIdAndToken.uid);
  await docRef.set({ lineNotifyToken: null }, { merge: true });
}

async function checkTokenStatus(userIdAndToken: UserIdAndToken): Promise<StatusApiResponse | null> {
  try {
    const response = await axios.get<StatusApiResponse>("https://notify-api.line.me/api/status", { headers: authHeader(userIdAndToken.lineNotifyToken) });
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      const { status, message } = error.response.data;
      return { status, message };
    } else {
      functions.logger.error("status api error", { error });
      return null;
    }
  }
}

type TokenStatus = "valid" | "noToken" | "unknown";
type TargetType = "USER" | "GROUP";
type OAuthStatus = {
  tokenStatus: TokenStatus;
  targetType?: TargetType;
  target?: string;
};

async function validateToken(userIdAndToken: UserIdAndToken): Promise<OAuthStatus> {
  const response = await checkTokenStatus(userIdAndToken);
  if (response) {
    switch(response.status) {
      case 200:
        if (response.targetType === "USER" || response.targetType === "GROUP")
          return { tokenStatus: "valid", targetType: response.targetType, target: response.target };
        else
          return { tokenStatus: "valid", targetType: "GROUP", target: response.target };
      case 401:
        {
          console.log(`invalid token for user ${userIdAndToken.uid}`);
          await clearToken(userIdAndToken);
          return { tokenStatus: "noToken" };
        }
      default:
        console.error(`unknown error ${JSON.stringify(response)}`);
        return { tokenStatus: "unknown" };
    }
  } else {
    return { tokenStatus: "unknown" };
  }
}

async function validateTokens(userIdAndTokens: UserIdAndToken[]): Promise<UserIdAndToken[]> {
  const result: UserIdAndToken[] = [];
  for(let userIdAndToken of userIdAndTokens) {
    const oauthStatus = await validateToken(userIdAndToken);
    if (oauthStatus.tokenStatus === "valid") {
      result.push(userIdAndToken);
    }
  }
  return result;
}

type RevokeApiResponse = {
  status: number;
  message: string;
};

async function revokeToken(userIdAndToken: UserIdAndToken): Promise<TokenStatus> {
  try {
    await axios.post<RevokeApiResponse>("https://notify-api.line.me/api/revoke", {}, { headers: authHeader(userIdAndToken.lineNotifyToken) });
    console.log("revokeToken: reovke finished");
    await clearToken(userIdAndToken);
    console.log("revokeToken: token cleared");
    return "noToken";
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      if (error.response.status === 401) {
        console.log("revokeToken: invalid token");
        await clearToken(userIdAndToken);
        return "noToken";
      }
      return "unknown";
    } else {
      functions.logger.error("revoke api error", { error });
      return "unknown";
    }
  }

}

async function notifyMessage(userIdAndToken: UserIdAndToken, message: string, filePath: string | null): Promise<boolean> {
  const formData = new FormData();
  formData.append("message", message);
  if (filePath) {
    // Bufferをそのまま送ると 500 エラーになった
    // よくわからないが、一度ファイルに書いて送ると送れた
    formData.append("imageFile", fs.createReadStream(filePath));
  }
  // functions.logger.info("call notify api", { uid: userIdAndToken.uid });
  const headers = { ...formData.getHeaders(), "Authorization": `Bearer ${userIdAndToken.lineNotifyToken}` };
  try {
    await axios.post("https://notify-api.line.me/api/notify", formData, { headers });
    return true;
  } catch (error) {
    functions.logger.error("notify api error", { response: { status: error.response?.status, data: error.response?.data } });
    return false;
  }
}
async function notifyMessageToAll(userIdAndTokens: UserIdAndToken[], message: string, imageBuffer?: Buffer): Promise<UserIdAndToken[]> {
  functions.logger.info("notifyMessageToAll", { message, bufferLength: imageBuffer?.length });
  const tempFilePath = "/tmp/images/image.jpg";
  if (imageBuffer) {
    // console.log(`image size: ${imageBuffer.byteLength}`);
    await fs.promises.mkdir("/tmp/images", { recursive: true });
    await fs.promises.writeFile(tempFilePath, imageBuffer);
  }

  const succeeded: UserIdAndToken[] = [];
  for(let userIdAndToken of userIdAndTokens) {
    if (await notifyMessage(userIdAndToken, message, imageBuffer ? tempFilePath : null)) {
      succeeded.push(userIdAndToken);
    }
  }
  return succeeded;
}

async function unsentArticles(articles: Article[]): Promise<Article[]> {
  const querySnapShot = await db.collection("articles").where("url", "in", articles.map(a => a.url)).get();
  const sent: string[] = []
  querySnapShot.forEach(doc => {
    const data = doc.data() as any;
    if (data.sent) {
      sent.push(data.url);
    }
  });
  return articles.filter(a => !sent.includes(a.url));
}

async function makeArticleDoc(article: Article, filePath: string | null): Promise<string> {
  const doc = await db.collection("articles").add({ ...article, filePath, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  return doc.id
}

async function makeArticleSent(docId: string): Promise<void> {
  await db.collection("articles").doc(docId).set({ sent: true }, { merge: true });
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
    functions.logger.error("oauth api error", { error });
    return null;
  }
}

async function createOAuthToken(user: firebase.auth.DecodedIdToken, code: string): Promise<string | null> {
  const docRef = db.collection("users").doc(user.uid);
  const accessToken = await getAccessToken(code);
  if (accessToken == null) {
    return null;
  }

  await docRef.set({ lineNotifyToken: accessToken }, { merge: true });
  functions.logger.info("token saved", { accessToken });
  return accessToken;
}

async function isPdf(path: string): Promise<boolean> {
  const handle = await fs.promises.open(path, "r");
  const array = new Uint8Array(4);
  const { bytesRead } = await handle.read(array, 0, 4);
  await handle.close();
  if (bytesRead !== 4) return false;
  return (array[0] === 0x25 && array[1] === 0x50 && array[2] === 0x44 && array[3] === 0x46);
}

const timeZone = "Asia/Tokyo";

async function storeFileToStorage(filePath: string, name: string, extension: string | null): Promise<string> {
  functions.logger.info("storeFileToStorage", { filePath, name, extension });
  const bucket = firebase.storage().bucket();
  const time = DateTime.fromObject({ zone: timeZone });
  const timestr = time.toFormat("yyyyLLddhhmmss");
  const outputPath = extension ? `${timestr}/${name}.${extension}` : `${timestr}/${name}`;
  const file = bucket.file(outputPath);
  const write = file.createWriteStream({ private: true });
  const read = fs.createReadStream(filePath);
  await new Promise((resolve, reject) => {
    read.on("error", error => {
      functions.logger.info("storeFileToStorage read error", { error });
      reject(error);
    })
    write.on("error", error => {
      functions.logger.info("storeFileToStorage write error", { error });
      reject(error);
    });
    write.on("finish", () => {
      resolve(null);
    });
    read.pipe(write);
  });
  functions.logger.info("storeFileToStorage finished", { outputPath });
  return outputPath;
}

function makeMessage(textAndFile: TextAndFile) {
  const message = (textAndFile.title || textAndFile.text) ? [textAndFile.title, textAndFile.text].join("\n") : "保育園からのお知らせです。"
  return [message, textAndFile.url].join("\n");
}

async function sendArticle(userIdAndTokens: UserIdAndToken[], article: Article, textAndFile: TextAndFile): Promise<void> {
  let succeeded = [...userIdAndTokens];
  let storagePath: string | null = null;
  let pdf = false;
  if (textAndFile.filePath) {
    pdf = await isPdf(textAndFile.filePath);
    storagePath = await storeFileToStorage(textAndFile.filePath, textAndFile.title, pdf ? "pdf" : null);
  }
  const docId = await makeArticleDoc(article, storagePath);
  succeeded = await notifyMessageToAll(succeeded, makeMessage(textAndFile));
  if (pdf) {
    try {
      const notifyFunc = async (message: string, imageBuffer?: Buffer): Promise<void> => {
        succeeded = await notifyMessageToAll(succeeded, message, imageBuffer);
      }
      await notifyPdfAsImages(textAndFile.filePath!, notifyFunc);
    } catch(error) {
      functions.logger.error("notifyPdfAsImages faild", error);
    }
  } else {
    functions.logger.info(`not pdf file: ${textAndFile.filePath}`);
  }
  await makeArticleSent(docId);
}

async function getSignedUrl(path: string): Promise<string> {
  const expirationMinutes = 1;
  const bucket = firebase.storage().bucket();
  const file = bucket.file(path)
  const time = DateTime.fromObject({ zone: timeZone });
  const signedUrl = await file.getSignedUrl({ action: "read", expires: time.plus({ minutes: expirationMinutes }).toUTC().toISO() })
  return signedUrl[0];
}

async function getArticleAttachedFileSignedUrl(articleId: string): Promise<string | null> {
  const docRef = db.collection("articles").doc(articleId);
  const doc = await docRef.get();
  if (!doc.exists) return null;
  const data = doc.data() as any;
  if (!data.filePath) return null;
  return getSignedUrl(data.filePath);
}

async function isActivatedUser(user: firebase.auth.DecodedIdToken): Promise<boolean> {
  const doc = await db.collection("activatedUsers").doc(user.uid).get();
  return doc.exists;
}

async function activateAccount(user: firebase.auth.DecodedIdToken, code: string): Promise<boolean> {
  const docRef = db.collection("activationCodes").doc(code);
  const doc = await docRef.get();
  if (!doc.exists) {
    console.log(`code ${code} doesn't exist`);
    return false;
  }
  const data = doc.data() as any;
  console.log(data);
  if (data.used) return false;
  // if (!data.expires) return false;
  // const expires = data.expires as Timestamp;
  // const now = new Date();
  // if (now > expires.toDate()) return false;
  await db.collection("activatedUsers").doc(user.uid).set({ createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  docRef.set({ used: true, userId: user.uid, email: user.email }, { merge: true });
  return true;
}

async function scraping(): Promise<string> {
  const userIdAndTokens = await validateTokens(await getAllUserIdAndTokens());
  if (userIdAndTokens.length === 0) {
    return "No valid tokens";
  }
  const config = functions.config();
  const { browser, page } = await getBrowserPage(false);
  const credential = { id: config.ra9.user_id, password: config.ra9.password };
  const articles = (await loginAndGetArticleList(page, credential)).reverse();
  const unsent = (await unsentArticles(articles));
  if (unsent.length === 0) {
    return "No unsent articles";
  }
  for(let article of unsent) {
    const textAndFile = await scrapeDetailPage(page, article.url);
    await sendArticle(userIdAndTokens, article, textAndFile);
  }
  browser.close();
  return "Succeeded";
}

const validateFirebaseIdToken = async (req: any, res: any, next: any) => {
  functions.logger.info(req.path, { body: req.body, cookies: req.cookies });

  if (req.path === "/api/scraping") {
    if (req.headers.authorization && req.headers.authorization === `Bearer ${functions.config().app.scraping_api_token}`) {
      next();
      return;
    } else {
      console.error("Invalid Scraping API token");
      res.status(403).send("Unauthorized");
      return;
    }
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
    // console.log("Found \"Authorization\" header");
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
    // console.log("ID Token correctly decoded", decodedIdToken);
    req.user = decodedIdToken;
    next();
    return;
  } catch (error) {
    functions.logger.error("Error while verifying Firebase ID token", { error });
    res.status(403).send("Unauthorized");
    return;
  }
};

function isActivationRequiredPath(path: string): boolean {
  const inactiveAllowedPaths = ["/api/status", "/api/activate", "/api/scraping"];;
  return inactiveAllowedPaths.indexOf(path) < 0;
}

const ensureActivatedUser = async (req: any, res: any, next: any) => {
  if (isActivationRequiredPath(req.path)) {
    const activated = await isActivatedUser(req.user);
    if (!activated) {
      res.status(403).json({ message: "activation required" });
      return;
    }
  }
  next();
}

app.use(cors);
app.use(cookieParser());
app.use(validateFirebaseIdToken);
app.use(ensureActivatedUser);

app.post("/api/oauth/callback", async (req: any, res:  any) => {
  const { code } = req.body;
  if ( typeof code !== "string") {
    res.status(422).json({error: "code required"});
    return;
  }

  const accessToken = await createOAuthToken(req.user, code);
  if (accessToken == null)  {
    res.status(422).json({error: "failed"});
    return;
  }
  res.json({ accessToken });
});

app.post("/api/line/notify", async (req: any, res): Promise<void> => {
  // res.json({ message: "hello, notify!"});
  const { message } = req.body;
  const response = await sendMessage(req.user, message);
  if (response) {
    res.json(response);
  } else {
    res.json({ message: "faild" });
  }
});

app.get("/api/status", async (req: any, res) => {
  const [userIdAndToken, activated] = await Promise.all([getUserIdAndToken(req.user.uid), isActivatedUser(req.user)]);
  let oauthStatus: OAuthStatus;
  if (userIdAndToken) {
    oauthStatus = await validateToken(userIdAndToken);
  } else {
    oauthStatus = { tokenStatus: "noToken" }
  }
  res.json({ oauthStatus, activated });
});


app.post("/api/activate", async (req: any, res) => {
  const { code } = req.body;
  if (await activateAccount(req.user, code)) {
    res.json({ message: "succeeded" });
  } else {
    res.status(422).json({ message: "faild" });
  }
});

app.post("/api/line/revoke", async (req: any, res) => {
  const [userIdAndToken, activated] = await Promise.all([getUserIdAndToken(req.user.uid), isActivatedUser(req.user)]);
  let oauthStatus: OAuthStatus;
  if (userIdAndToken) {
    const tokenStatus = await revokeToken(userIdAndToken);
    oauthStatus = { tokenStatus };
  } else {
    oauthStatus = { tokenStatus: "noToken" };
  }
  res.json({ oauthStatus, activated });
});

app.get("/api/articles/:articleId/attached", async (req, res) => {
  const signedUrl = await getArticleAttachedFileSignedUrl(req.params.articleId)
  if (signedUrl) {
    res.json({ url: signedUrl });
  } else {
    res.status(404).json({ message: "not found" });
  }
})

app.post("/api/scraping", async (_req, res) => {
  const message = await scraping();
  res.json({ message });
});

const runtimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 300,
  memory: "1GB"
};

export const api = functions.runWith(runtimeOpts).https.onRequest(app);

export const scheduled = functions.runWith(runtimeOpts)
  .pubsub
  .schedule("0 16,17,18 * * 1-5")
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
  const message = await scraping();
  functions.logger.info(message);
  return null;
});
