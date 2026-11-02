// PreToolUse: Kein Lesen oder Ändern von .env-Dateien (Secrets, SEED_PASSWORD).
// .env.example bleibt erlaubt. Exit 2 = Aufruf blockieren, stderr geht an Claude.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const tool = input.tool_input ?? {};
const isEnv = (name) => /^\.env(\..+)?$/.test(name) && !name.endsWith(".example");

const file = tool.file_path ?? tool.path;
const command = tool.command ?? "";
const blocked =
  (file && isEnv(basename(file))) ||
  /(^|[\s"'\/\\=<>])\.env(\.(local|development|production|test))?(?=$|[\s"'<>|;&])/.test(
    command,
  );

if (blocked) {
  console.error(
    "Blockiert: .env-Dateien enthalten Secrets und werden nicht gelesen oder geändert. " +
      "Werte über process.env im Code nutzen; neue Variablen in .env.example dokumentieren.",
  );
  process.exit(2);
}
