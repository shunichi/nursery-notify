// https://github.com/mozilla/pdf.js/tree/master/examples/node/pdf2png

// https://stackoverflow.com/questions/18680261/extract-images-from-pdf-file-with-javascript

import * as Canvas from "canvas";
import * as assert from "assert";
import * as fs from "fs";
const pdfjsLib = require("pdfjs-dist/es5/build/pdf.js");

type CanvasAndConext = {
  canvas: Canvas.Canvas | null;
  context: Canvas.CanvasRenderingContext2D | null;
};

class NodeCanvasFactory {
  create(width: number, height: number): CanvasAndConext {
    assert(width > 0 && height > 0, "Invalid canvas size");
    var canvas = Canvas.createCanvas(width, height);
    var context = canvas.getContext("2d");
    return {
      canvas,
      context,
    };
  }

  reset(canvasAndContext: CanvasAndConext, width: number, height: number) {
    assert(canvasAndContext.canvas, "Canvas is not specified");
    assert(width > 0 && height > 0, "Invalid canvas size");
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: CanvasAndConext) {
    assert(canvasAndContext.canvas, "Canvas is not specified");

    // Zeroing the width and height cause Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

export async function convertPageAsImage(pdfDocument: any, pageNo: number, imageType: "jpeg" | "png", scale: number = 4.0): Promise<Buffer> {
  console.log(`convertPageAsImage ${pageNo}`);
  return pdfDocument.getPage(pageNo).then(function (page: any) {
    const viewport = page.getViewport({ scale });
    const canvasFactory = new NodeCanvasFactory();
    const canvasAndContext = canvasFactory.create(
      viewport.width,
      viewport.height
    );
    const renderContext = {
      canvasContext: canvasAndContext.context,
      viewport,
      canvasFactory,
    };

    console.log(`convertPageAsImage ${pageNo} render: width=${viewport.width} height=${viewport.height}`);
    const renderTask = page.render(renderContext);
    return renderTask.promise.then(() => {
      // Convert the canvas to an image buffer.
      console.log(`convertPageAsImage ${pageNo} toBuffer`);
      const canvas = canvasAndContext.canvas;
      var image = (imageType === "jpeg") ? canvas!.toBuffer("image/jpeg") : canvas!.toBuffer("image/png");
      canvasFactory.destroy(canvasAndContext);
      return image;
    });
  });
}

export async function writePageAsImage(pdfDocument: any, pageNo: number, fileName: string, imageType: "jpeg" | "png"): Promise<void> {
  const image = await convertPageAsImage(pdfDocument, pageNo, imageType);
  return fs.promises.writeFile(fileName, image);
}


// eslint-disable-next-line @typescript-eslint/no-unused-vars
function writeRawImageData(pdfDocument: any, pageNo: number) {
  pdfDocument.getPage(pageNo).then((page:any) => {
    page.getOperatorList().then(function (ops: any) {
      // console.log(`ops.fnArray.length: ${ops.fnArray.length}`);
      // console.log(pdfjsLib.OPS);
      let imageNo = 0;
      for (var i=0; i < ops.fnArray.length; i++) {
        // console.log(ops.fnArray[i]);
        if (ops.fnArray[i] == pdfjsLib.OPS.paintImageXObject) {
          const op = ops.argsArray[i][0]
          page.objs.get(op,(img: any) => {
            // console.log(img);
            // デコード済みのデータっぽい？
            fs.writeFile(`data-${pageNo}-${++imageNo}.bin`, img.data, (error) => {
              if (error) {
                console.error("Error: " + error);
              } else {
                console.log(
                  "Finished extracting data."
                );
              }
            });
          });
        }
      }
    })
  });
}

// Some PDFs need external cmaps.
// const CMAP_URL = "./node_modules/pdfjs-dist/cmaps/";
// const CMAP_PACKED = true;

export async function loadPdf(pdfPath: string) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  // Load the PDF file.
  const loadingTask = pdfjsLib.getDocument({
    data
  });
  return await loadingTask.promise;
}

export async function pdf2png(pdfPath: string): Promise<void> {
  const pdfDocument = await loadPdf(pdfPath);
  const pages = pdfDocument.numPages;
  console.log(`# PDF document loaded. (${pages}pages)`);
  for(let pageNo = 1; pageNo <= pages; pageNo++) {
    console.log(`writing ${pageNo}`);
    const fileName = `output${pageNo}.jpeg`
    await writePageAsImage(pdfDocument, pageNo, fileName, "jpeg")
    .then(() => {
      console.log(
        `Finished converting page ${pageNo} of PDF file to a image.`
      );
    })
    .catch((error) => {
      console.error("Error: " + error);
    });
  }
}
