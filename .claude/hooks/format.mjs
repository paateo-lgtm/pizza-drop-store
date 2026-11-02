// PostToolUse: formatiert die gerade bearbeitete Datei mit Prettier (nur bekannte Typen).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const file = input.tool_input?.file_path;
if (!file || !/\.(ts|tsx|js|mjs|json|css|md|ya?ml)$/.test(file)) process.exit(0);
if (/node_modules|[\\/]\.next[\\/]|[\\/]generated[\\/]/.test(file)) process.exit(0);
try {
  execFileSync("npx", ["prettier", "--write", "--log-level", "warn", file], {
    cwd: input.cwd,
    stdio: "ignore",
    shell: true,
  });
} catch {
  // Syntaxfehler o. Ä.: nicht blockieren, Typecheck und Lint melden es ohnehin.
}
