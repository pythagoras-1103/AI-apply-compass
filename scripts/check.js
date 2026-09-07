import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
function checkDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = entry.name;
    if (entry.isDirectory()) { checkDirectory(join(directory,file)); continue; }
    if (!file.endsWith(".js")) continue;
    const result = spawnSync(process.execPath, ["--check", join(directory, file)], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
for (const directory of ["src", "public", "scripts", "tests"]) checkDirectory(directory);
console.log("JavaScript syntax checks passed.");
