import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, "../public/icons");

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// A valid 1x1 pixel Indigo PNG base64 string
const base64Png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+C/FAAI0wG2hGjTkgAAAABJRU5ErkJggg==";
const buffer = Buffer.from(base64Png, "base64");

const sizes = ["icon16.png", "icon32.png", "icon48.png", "icon128.png"];

sizes.forEach((filename) => {
  fs.writeFileSync(path.join(iconsDir, filename), buffer);
});

console.log("Placeholder extension icons generated.");
