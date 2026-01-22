import { spawnSync } from "node:child_process";

const args = ["test", "--allow-env", "--allow-read", "supabase/functions/_shared"];
const denoCheck = spawnSync("deno", ["--version"], { stdio: "ignore" });
const hasDeno = denoCheck.status === 0;

const command = hasDeno ? "deno" : "npx";
const commandArgs = hasDeno ? args : ["--yes", "deno", ...args];

const result = spawnSync(command, commandArgs, { stdio: "inherit" });
process.exit(result.status ?? 1);
