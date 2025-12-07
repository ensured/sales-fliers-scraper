// lib/pdfjs.ts
import * as pdfjsLib from "pdfjs-dist";

// Point to the worker served from /public
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

export { pdfjsLib };
