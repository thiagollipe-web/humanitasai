import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1";

env.useBrowserCache = true;
env.useWasmCache = true;
env.cacheKey = "humanitas-smollm2-v2";

const MODEL = "onnx-community/SmolLM2-135M-Instruct-ONNX";
let generator = null;
let loading = null;
let activeDevice = null;

function progress(onProgress, data) {
  try { onProgress(data); } catch {}
}

export function getModelInfo() {
  return {
    model: MODEL,
    device: activeDevice,
    ready: Boolean(generator)
  };
}

export async function loadModel(onProgress = () => {}) {
  if (generator) return generator;
  if (loading) return loading;

  loading = (async () => {
    const webgpu = typeof navigator !== "undefined" && "gpu" in navigator;

    if (webgpu) {
      try {
        progress(onProgress, { status: "loading", device: "webgpu", dtype: "q4f16", progress: 0 });
        generator = await pipeline("text-generation", MODEL, {
          device: "webgpu",
          dtype: "q4f16",
          progress_callback: onProgress
        });
        activeDevice = "webgpu";
        progress(onProgress, { status: "ready", device: activeDevice, dtype: "q4f16", progress: 100 });
        return generator;
      } catch (error) {
        console.warn("WebGPU q4f16 indisponível; tentando WebGPU q4.", error);
        generator = null;
      }

      try {
        progress(onProgress, { status: "fallback", device: "webgpu", dtype: "q4" });
        generator = await pipeline("text-generation", MODEL, {
          device: "webgpu",
          dtype: "q4",
          progress_callback: onProgress
        });
        activeDevice = "webgpu";
        progress(onProgress, { status: "ready", device: activeDevice, dtype: "q4", progress: 100 });
        return generator;
      } catch (error) {
        console.warn("WebGPU indisponível; usando WASM.", error);
        generator = null;
      }
    }

    progress(onProgress, { status: "loading", device: "wasm", dtype: "q4", progress: 0 });
    generator = await pipeline("text-generation", MODEL, {
      device: "wasm",
      dtype: "q4",
      progress_callback: onProgress
    });
    activeDevice = "wasm";
    progress(onProgress, { status: "ready", device: activeDevice, dtype: "q4", progress: 100 });
    return generator;
  })();

  try {
    return await loading;
  } finally {
    loading = null;
  }
}
