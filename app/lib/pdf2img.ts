export interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  if (loadPromise) return loadPromise;

  isLoading = true;
  // @ts-expect-error - pdfjs-dist/build/pdf.mjs is not a module
  loadPromise = import("pdfjs-dist/build/pdf.mjs")
    .then((lib) => {
      // Set the worker source to use local file
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      pdfjsLib = lib;
      isLoading = false;
      return lib;
    })
    .catch((err) => {
      isLoading = false;
      throw new Error(`Failed to load PDF.js: ${err}`);
    });

  return loadPromise;
}

/**
 * Converts a PDF file to a PNG image (first page only) in the browser.
 * @param file A File object containing a PDF.
 * @returns A Promise resolving to PdfConversionResult, including the image URL, File object, and error if any.
 */
export async function convertPdfToImage(file: File): Promise<PdfConversionResult> {
  // Early check: reject non-PDF files


  try {
    const lib = await loadPdfJs();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 4 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (context) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
    }

    await page.render({ canvasContext: context!, viewport }).promise;

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Create a File from the blob with the same name as the PDF (but .png)
            const originalName = file.name.replace(/\.pdf$/i, "");
            const imageFile = new File([blob], `${originalName}.png`, {
              type: "image/png",
            });

            resolve({
              imageUrl: URL.createObjectURL(blob),
              file: imageFile,
            });
          } else {
            resolve({
              imageUrl: "",
              file: null,
              error: "Failed to create image blob from canvas",
            });
          }
        },
        "image/png",
        1.0
      );
    });
  } catch (err) {
    return {
      imageUrl: "",
      file: null,
      error: `Failed to convert PDF: ${String(err)}`,
    };
  }
}
