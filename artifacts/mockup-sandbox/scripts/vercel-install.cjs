const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const lockfilePath = path.join(projectRoot, "package-lock.json");
const lockfile = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
const replitRegistryPrefix = "http://package-firewall.replit.internal/npm/";
const publicRegistryPrefix = "https://registry.npmjs.org/";
let rewrittenCount = 0;

for (const [name, packageInfo] of Object.entries(lockfile.packages ?? {})) {
  const resolved = packageInfo.resolved;
  if (typeof resolved !== "string" || !resolved.includes("package-firewall.replit.internal")) {
    continue;
  }

  if (!resolved.startsWith(replitRegistryPrefix)) {
    throw new Error(`Unexpected Replit package registry URL for ${name}: ${resolved}`);
  }

  packageInfo.resolved = `${publicRegistryPrefix}${resolved.slice(replitRegistryPrefix.length)}`;
  rewrittenCount += 1;
}

if (rewrittenCount > 0) {
  fs.writeFileSync(lockfilePath, `${JSON.stringify(lockfile, null, 2)}\n`);
}

console.log(`Normalized ${rewrittenCount} Replit package URL(s) for Vercel.`);

const env = { ...process.env };
delete env.npm_config_cache_dir;
delete env.NPM_CONFIG_CACHE_DIR;

const install = spawnSync(
  "npm",
  ["install", "--registry=https://registry.npmjs.org/"],
  { cwd: projectRoot, env, stdio: "inherit" },
);

if (install.error) {
  console.error("Could not start npm install:", install.error.message);
  process.exit(1);
}

process.exit(install.status ?? 1);
