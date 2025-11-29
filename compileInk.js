import { execSync } from "child_process"
import fs from "fs"
import path from "path"

const inklecate = "src/ink/tools/inklecate"
const inkDir = "src/ink"

const files = fs.readdirSync(inkDir)

files.filter(f => f.endsWith(".ink")).forEach(file => {
  const input = path.join(inkDir, file)
  const output = path.join(inkDir, file.replace(".ink", ".json"))
  console.log(`Compiling ${file} → ${output}`)
  execSync(`${inklecate} -o ${output} ${input}`, { stdio: "inherit" })
})

console.log("All Ink files compiled!")
