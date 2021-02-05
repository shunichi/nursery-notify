import * as puppeteer from "puppeteer";
import * as fs from "fs";
import * as pathLib from "path";
import { loadPdf, convertPageAsImage } from "./pdfconv";

const globalConfig = {
  downloadPath: "./downloads",
}

async function sleep(time: number): Promise<void> {
  return new Promise((resolve, reject) => {
      setTimeout(() => {
          resolve();
      }, time);
  });
}

async function goto(page: puppeteer.Page, url: string): Promise<void> {
  await page.goto(url, {waitUntil: "domcontentloaded"});
}

async function fillIn(page: puppeteer.Page, selector: string, value: string) {
  await page.focus(selector);
  await page.type(selector, value);
}

async function waitUntilLoad<T>(page: puppeteer.Page, asyncFunc: (page: puppeteer.Page) => Promise<void>) {
  let loadPromise = page.waitForNavigation({waitUntil: "domcontentloaded"});
  await asyncFunc(page);
  await loadPromise;
}

async function waitForSelector(page: puppeteer.Page, selector: string) {
  return page.waitForSelector(selector, {timeout: 5000});
}

type Credential = {
  id: string;
  password: string;
};

async function waitDownload(downloadPath: string) {
  let filename;
  while ( ! filename || filename.endsWith(".crdownload")) {
      filename = fs.readdirSync(downloadPath)[0];
      await sleep(1000);
  }
  return pathLib.join(downloadPath, filename);
}

async function cleanupDirectory(path: string): Promise<void> {
  await fs.promises.mkdir(path, { recursive: true });
  const fileNames = await fs.promises.readdir(path);
  const promises = fileNames.map((fileName) => {
    const filePath = pathLib.join(path, fileName);
    console.log(`rm ${filePath}`);
    return fs.promises.unlink(filePath);
  });
  console.log(promises);
  await Promise.all(promises);
  console.log("cleanup finished.");
}

async function download(page: puppeteer.Page): Promise<string> {
  await cleanupDirectory(globalConfig.downloadPath);
  await (page as any)._client.send("Page.setDownloadBehavior", {
    behavior : "allow",
    downloadPath: globalConfig.downloadPath,
  });
  await sleep(3000);
  await page.click(".sys-attached-file-dl-link a");
  console.log("waiting download.")
  const downloadedFilePath = await waitDownload(globalConfig.downloadPath);
  console.log(`downloaded: ${downloadedFilePath}`);
  return downloadedFilePath;
}

type TextAndFile = {
  title: string;
  text: string;
  filePath: string;
}

async function getText(page: puppeteer.Page, selector: string): Promise<string | null> {
  return page.$eval(selector, (elem) => elem.textContent);
}

async function scrapeDetailPage(page: puppeteer.Page, url: string): Promise<TextAndFile> {
  await goto(page, url);
  await waitForSelector(page, ".topic-contents");
  const dateText = await getText(page, ".val-mail-send_date .date");
  const text = (await getText(page, ".topic-contents")) || "";
  const title = (await getText(page, ".topic-headline .val-mail-title")) || "";
  if (dateText) {
    const match = /(\d+)\/(\d+)\/(\d+)/.exec(dateText);
    if (match) {
      new Date()
    }
  }
  console.log(`title: ${title}`)
  console.log(text)
  const filePath = await download(page);
  return { title, text, filePath };
}

export async function scrapeAndDownloadFile(page: puppeteer.Page, credential: Credential): Promise<TextAndFile | null> {
  await goto(page, "https://ra9.jp/user");
  await page.waitForSelector("input[name=email]", {timeout: 5000});
  await fillIn(page, "input[name=email]", credential.id);
  await fillIn(page, "input[name=password]", credential.password);
  await waitUntilLoad(page, async () => page.click("input[name=login]"));
  await goto(page, "https://ra9.jp/teams/519228/11952930");
  const selector = ".sys-newmail td.hidden-anchor a";
  await page.waitForSelector(selector, {timeout: 5000});
  const hrefs = await page.$$eval(".sys-newmail tr",
    (elements: Element[]) => elements.map((tr) => {
      const a = tr.querySelector("td.hidden-anchor a") as (HTMLAnchorElement | null);
      const title = tr.querySelector(".sys-title");
      const date = tr.querySelector(".date-cell");
      return [a ? a.href : "",  title ? title.textContent : "", date ? date.textContent : ""];
    })
  );
  console.log(hrefs);
  if (hrefs.length > 0 && hrefs[0][0]) {
    return await scrapeDetailPage(page, hrefs[0][0]);
  }
  return null;
}

type BrowserAndPage = {
  browser: puppeteer.Browser;
  page: puppeteer.Page;
};

export async function getBrowserPage(local: boolean): Promise<BrowserAndPage> {
  // Launch headless Chrome. Turn off sandbox so Chrome can run under root.
  const options = local ? { headless: false } : { args: ["--no-sandbox"] };
  const browser = await puppeteer.launch(options);
  return { browser: browser, page: await browser.newPage() };
}

const maxPages = 10;

type NotifyMessageFunc = (message: string, imageBuffer?: Buffer) => Promise<void>;

export async function notifyPdfAsImages(textAndFile: TextAndFile, notifyMessageFunc: NotifyMessageFunc) {
  const pdfDocument = await loadPdf(textAndFile.filePath);
  const pages = Math.min(pdfDocument.numPages, maxPages);
  for(let pageNo = 1; pageNo <= pages; pageNo++) {
    const imageBuffer = await convertPageAsImage(pdfDocument, pageNo, "jpeg");
    await notifyMessageFunc(`${pageNo}ページ目`, imageBuffer);
    // await notifyMessage(`${pageNo}ページ目`, imageBuffer);
  }
}
