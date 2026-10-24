const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const outputDir = path.join(root, "dist");
const generatedMarker = path.join(root, ".tagalong-public-generated");

if (fs.existsSync(generatedMarker)) {
  fs.rmSync(publicDir, { recursive: true, force: true });
  fs.rmSync(generatedMarker, { force: true });
}
fs.rmSync(outputDir, { recursive: true, force: true });

const result = spawnSync("pnpm", ["exec", "expo", "export", "--platform", "web", "--output-dir", "dist"], {
  cwd: root,
  stdio: "inherit",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

fs.rmSync(publicDir, { recursive: true, force: true });
fs.renameSync(outputDir, publicDir);
fs.writeFileSync(generatedMarker, "Expo web build output\n");
