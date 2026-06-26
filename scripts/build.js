import { build } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));

async function run() {
  console.log("=== Starting Extension Build ===");


  // 2. Build Popup React App
  console.log("Building React Popup...");
  await build({
    plugins: [react()],
    build: {
      outDir: resolve(__dirname, "../dist"),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "../popup.html"),
        },
      },
    },
  });
  console.log("✔ React Popup build completed.");

  // 3. Build Background Service Worker
  console.log("Building Background Service Worker...");
  await build({
    configFile: false, // Bypass config file to prevent chunk-splitting issues
    build: {
      outDir: resolve(__dirname, "../dist"),
      emptyOutDir: false, // VERY IMPORTANT: Do not clear popup assets!
      codeSplitting: false,
      lib: {
        entry: resolve(__dirname, "../src/background/service-worker.ts"),
        formats: ["es"],
        fileName: () => "service-worker.js",
      },
      rollupOptions: {
        output: {},
      },
    },
  });
  console.log("✔ Background Service Worker build completed.");
  console.log("=== Extension Build Completed Successfully. Output: /dist ===");
}

run().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
