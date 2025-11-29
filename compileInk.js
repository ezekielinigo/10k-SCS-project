import { execFileSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

const root = process.cwd();
const toolsDir = path.join(root, "src", "ink", "tools");
const inklecateBase = path.join(toolsDir, "inklecate");

// try common Windows/Unix extensions
const exts = ["", ".exe", ".cmd", ".bat", ".ps1"];
let inklecatePath = null;
for (const ext of exts) {
  const p = inklecateBase + ext;
  if (existsSync(p)) {
    inklecatePath = p;
    break;
  }
}

if (!inklecatePath) {
  console.error(`inklecate not found in ${toolsDir}. Put inklecate(.exe) there or install it globally and update this script.`);
  process.exit(1);
}

const files = [
  { in: path.join("src", "ink", "career_mechanic.ink"), out: path.join("src", "ink", "career_mechanic.json") },
  // add other ink files here
];

for (const f of files) {
  console.log(`Compiling ${f.in} -> ${f.out} using ${inklecatePath}`);
  try {
    execFileSync(inklecatePath, ["-o", f.out, f.in], { stdio: "inherit" });
  } catch (err) {
    console.error("Compile failed:", err.message || err);
    process.exit(1);
  }
}