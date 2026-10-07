const { existsSync } = require("node:fs");
const { spawn } = require("node:child_process");

// Node 22's watch mode attempts to watch even a missing optional env file.
// Only include --env-file when it exists; Replit Secrets arrive via process.env.
const args = [
  ...(existsSync(".env") ? ["--env-file=.env"] : []),
  "--import", "tsx", "--watch", "server/src/index.ts",
];
const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("error", () => process.exit(1));
child.on("exit", code => process.exit(code ?? 0));
