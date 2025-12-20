import { execFileSync } from "child_process";
import { existsSync, readdirSync, statSync } from "fs";
import path from "path";

const root = process.cwd();
const inkDir = path.join(root, "src", "ink");
const toolsDir = path.join(inkDir, "tools");
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

// Walk src/ink and collect .ink files (skip tools/)
function collectInkFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (path.basename(full) === "tools") continue;
      out.push(...collectInkFiles(full));
    } else if (stat.isFile() && name.endsWith('.ink')) {
      // compile to same dir with .json extension
      const outPath = full.replace(/\.ink$/i, '.json');
      out.push({ in: full, out: outPath });
    }
  }
  return out;
}

const files = collectInkFiles(inkDir);
if (files.length === 0) {
  console.log('No .ink files found under src/ink to compile.');
  process.exit(0);
}

for (const f of files) {
  console.log(`Compiling ${path.relative(root, f.in)} -> ${path.relative(root, f.out)} using ${path.relative(root, inklecatePath)}`);
  try {
    execFileSync(inklecatePath, ["-o", f.out, f.in], { stdio: "inherit" });
  } catch (err) {
    console.error("Compile failed:", err.message || err);
    process.exit(1);
  }
}