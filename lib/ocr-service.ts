// 注意：不在顶部 import paddleocr，用动态 import 避免 SSR 打包时出错
// (paddleocr 依赖 opencv-js 和 onnxruntime-web，含浏览器/Node 专属代码)

export interface OcrProgress {
  stage: "downloading" | "initializing" | "recognizing" | "done";
  percent: number;
}

/**
 * ONNX Runtime 的 wasm 从哪儿加载。
 * ---------------------------------------------------------------------------
 * 不能再用本地的 /ort/：那 13~27MB 的 wasm 一旦通过公网隧道（临时部署）下载，
 * 实测只有 25KB/s，要十几分钟，朋友那边就直接卡死 / 报错。
 * 这里默认走国内的 npmmirror（实测 ~640KB/s，13MB 约 20 秒），
 * 想改回本地或别的 CDN，设环境变量 NEXT_PUBLIC_ORT_WASM_BASE 即可，
 * 例如 "/ort/"（本地开发）或 "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/"。
 */
const ORT_WASM_BASE =
  process.env.NEXT_PUBLIC_ORT_WASM_BASE?.trim() ||
  "https://registry.npmmirror.com/onnxruntime-web/1.24.3/files/dist/";

/**
 * 识别模型（PP-OCRv5 det/rec）由 @paddleocr/paddleocr-js 自己从
 * paddle-model-ecology.bj.bcebos.com 下载，未走隧道，国内速度正常。
 */

let ocrInstance: any = null;
let initPromise: Promise<any> | null = null;

/**
 * 初始化 PaddleOCR 实例（懒加载 + 单例）
 * 模型从 CDN 下载，首次较慢
 */
export async function getOcrInstance(
  onProgress?: (p: OcrProgress) => void
): Promise<any> {
  if (ocrInstance) return ocrInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    onProgress?.({ stage: "downloading", percent: 0 });

    // 动态导入，避免 SSR 打包
    const { PaddleOCR } = await import("@paddleocr/paddleocr-js");

    onProgress?.({ stage: "initializing", percent: 10 });

    const instance = await PaddleOCR.create({
      lang: "ch",
      ocrVersion: "PP-OCRv5",
      ortOptions: {
        wasmPaths: ORT_WASM_BASE,
      },
    });

    ocrInstance = instance;
    onProgress?.({ stage: "initializing", percent: 100 });
    return instance;
  })();

  return initPromise;
}

/**
 * 识别图片，返回拼接好的纯文本
 */
export async function recognizeImage(
  file: File | Blob,
  onProgress?: (p: OcrProgress) => void
): Promise<string> {
  const ocr = await getOcrInstance(onProgress);

  onProgress?.({ stage: "recognizing", percent: 30 });

  const results: any[] = await ocr.predict(file);
  onProgress?.({ stage: "recognizing", percent: 90 });

  const lines = results.flatMap((r: any) => r.items.map((item: any) => item.text));

  onProgress?.({ stage: "done", percent: 100 });

  return lines.join("\n");
}

/** 释放 OCR 实例 */
export async function disposeOcr() {
  if (ocrInstance) {
    await ocrInstance.dispose();
    ocrInstance = null;
    initPromise = null;
  }
}

