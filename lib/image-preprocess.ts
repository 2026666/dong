/**
 * 图像预处理 —— 为 Tesseract.js OCR 优化游戏截图
 *
 * 游戏截图通常有彩色背景、渐变、半透明遮罩，直接给 Tesseract 识别率很低。
 * 这个函数做：灰度化 → 对比度拉伸 → 自适应二值化 → 放大 2x
 * 返回一个处理过的 Blob，可以直接传给 tesseract.js 的 recognize()
 */
export async function preprocessImage(
  file: File,
  options: {
    scale?: number;           // 放大倍数，默认 2（OCR 对小字体很敏感）
    contrast?: number;        // 对比度系数，1.0 不变，默认 1.5
    brightness?: number;      // 亮度偏移，默认 0
    threshold?: number;       // 二值化阈值 0-255，0 表示自动
    grayscale?: boolean;     // 是否灰度化，默认 true
    binarize?: boolean;      // 是否二值化，默认 true（关掉只做放大+对比度，给 OCR 补一刀用）
  } = {}
): Promise<Blob> {
  const {
    scale = 2,
    contrast = 1.5,
    brightness = 0,
    threshold = 0,
    grayscale = true,
    binarize = true,
  } = options;

  // 1. 加载图片
  const img = await loadImage(file);

  // 2. 计算新尺寸
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  // 3. 画到 Canvas
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);

  // 4. 取像素数据
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // 5. 灰度化 + 对比度 + 亮度
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (grayscale) {
      // ITU-R BT.601 标准灰度转换
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = gray;
    }

    // 对比度 + 亮度
    r = clamp(((r / 255 - 0.5) * contrast + 0.5) * 255 + brightness);
    g = clamp(((g / 255 - 0.5) * contrast + 0.5) * 255 + brightness);
    b = clamp(((b / 255 - 0.5) * contrast + 0.5) * 255 + brightness);

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  // 6. 二值化（阈值化）—— 让文字纯黑背景纯白
  const useThreshold = threshold > 0 ? threshold : autoThreshold(data);
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const v = avg > useThreshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
  }

  ctx.putImageData(imageData, 0, 0);

  // 7. 导出 Blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob 失败"));
    }, "image/png");
  });
}

/** 自适应阈值 —— Otsu 方法的简化版 */
function autoThreshold(data: Uint8ClampedArray): number {
  // 计算直方图
  const hist = new Array(256).fill(0);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    hist[Math.round(avg)]++;
    total++;
  }

  // Otsu 算法：最大化类间方差
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }

  return threshold;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };
    img.src = url;
  });
}
