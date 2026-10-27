import { spawnSync } from "node:child_process";

const SITE_URL = "https://qr-aims.pages.dev";
const PROJECT = "qr-aims";

function run(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// SITE_URL is read while the pages are rendered at build time, and it must win
// over any local .env.local, so it is set in the child's environment.
run("npx", ["next", "build"], { SITE_URL });

if (process.argv.includes("--build-only")) {
  console.log(`Static export ready in out/ for ${SITE_URL}`);
} else {
  // --branch main promotes the deployment to production, so qr-aims.pages.dev
  // serves it instead of a per-commit preview URL.
  run(
    "npx",
    [
      "wrangler",
      "pages",
      "deploy",
      "out",
      "--project-name",
      PROJECT,
      "--branch",
      "main",
      "--commit-dirty=true",
    ],
    {},
  );
}
