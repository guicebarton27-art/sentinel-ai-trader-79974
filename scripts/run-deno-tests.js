import { spawnSync } from "node:child_process";

const args = ["test", "--allow-env", "--allow-read", "supabase/functions/_shared"];
const denoBinary = process.env.DENO_BIN ?? "deno";

const run = (command, commandArgs) => spawnSync(command, commandArgs, { stdio: "inherit" });
const check = (command, commandArgs) => spawnSync(command, commandArgs, { stdio: "ignore" });

const hasDeno = check(denoBinary, ["--version"]).status === 0;
if (hasDeno) {
  const result = run(denoBinary, args);
  process.exit(result.status ?? 1);
}

const npmExecCheck = check("npm", ["--version"]).status === 0;
if (!npmExecCheck) {
  console.error("Deno not found and npm is unavailable. Install Deno or ensure npm is on PATH.");
  process.exit(1);
}

console.warn("Deno not found. Falling back to `npm exec --yes deno`.");
const fallback = run("npm", ["exec", "--yes", "deno", "--", ...args]);
if ((fallback.status ?? 1) !== 0) {
  console.error(
    "Deno fallback failed. Install Deno from https://deno.com/runtime or set DENO_BIN to its path."
  );
}
process.exit(fallback.status ?? 1);
