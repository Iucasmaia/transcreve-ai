import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const TRANSFORMERS_FILES = ["transformers.min.js"];
const ONNX_FILES = [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
];

function packageDistDir(packageName: string): string {
  return dirname(require.resolve(packageName));
}

export function vendorRuntime(targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });

  const transformersDir = packageDistDir("@huggingface/transformers");
  for (const file of TRANSFORMERS_FILES) {
    const source = join(transformersDir, file);
    if (!existsSync(source)) {
      throw new Error(`missing vendored runtime: ${source}`);
    }
    copyFileSync(source, join(targetDir, file));
  }

  const onnxDir = packageDistDir("onnxruntime-web");
  for (const file of ONNX_FILES) {
    const source = join(onnxDir, file);
    if (!existsSync(source)) {
      throw new Error(`missing vendored runtime: ${source}`);
    }
    copyFileSync(source, join(targetDir, file));
  }

  copyLicense(dirname(transformersDir), targetDir, "LICENSE.transformers");
  copyLicense(dirname(onnxDir), targetDir, "LICENSE.onnxruntime-web");
}

function copyLicense(packageDir: string, targetDir: string, name: string): void {
  for (const candidate of ["LICENSE", "LICENSE.txt", "LICENSE.md"]) {
    const source = join(packageDir, candidate);
    if (existsSync(source)) {
      copyFileSync(source, join(targetDir, name));
      return;
    }
  }
  const fallback = join(import.meta.dirname, "licenses", name);
  if (existsSync(fallback)) {
    copyFileSync(fallback, join(targetDir, name));
    return;
  }
  throw new Error(`missing license for ${packageDir}`);
}
