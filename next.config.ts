import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // ONNX Runtime 的多线程 wasm 需要 SharedArrayBuffer，必须开启跨源隔离
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
  webpack: (config) => {
    // opencv-js 引用了 Node 的 fs/path/crypto，浏览器里不需要
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // paddleocr 的 worker 用 new URL("ort.bundle.min.mjs", import.meta.url)
    // 帮 webpack 找到这个文件
    config.resolve.alias = {
      ...config.resolve.alias,
      "ort.bundle.min.mjs": path.resolve(
        __dirname,
        "node_modules/.pnpm/onnxruntime-web@1.30.0/node_modules/onnxruntime-web/dist/ort.bundle.min.mjs"
      ),
    };

    return config;
  },
};

export default nextConfig;
