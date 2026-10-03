import { pipeline, env } from "@huggingface/transformers";
env.useBrowserCache = true;
env.useWasmCache = true;
env.cacheKey = "humanitas-smollm2-v1";

const MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct";
let generator = null;
let loading = null;

export async function loadModel(onProgress = () => {}) {
  if (generator) return generator;
  if (loading) return loading;
  loading = (async () => {
    const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
    const device = hasWebGPU ? "webgpu" : "wasm";
    const options = {
      device,
      dtype: device === "webgpu" ? "q4f16" : "q8",
      progress_callback: onProgress
    };
    try {
      generator = await pipeline("text-generation", MODEL, options);
    } catch (error) {
      if (device !== "webgpu") throw error;
      onProgress({ status: "fallback", device: "wasm" });
      generator = await pipeline("text-generation", MODEL, {
        device: "wasm",
        dtype: "q8",
        progress_callback: onProgress
      });
    }
    onProgress({ status: "ready", device: generator ? device : "wasm", progress: 100 });
    return generator;
  })();
  try { return await loading; } finally { loading = null; }
}
