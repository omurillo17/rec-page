// Copia las skills del kit a la carpeta de skills de usuario de Claude Code (~/.claude/skills),
// para usarlas en cualquier proyecto. Volver a ejecutar tras actualizar el kit.
import { cpSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('.', import.meta.url));
const dest = join(homedir(), '.claude', 'skills');
for (const name of readdirSync(src, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  if (!existsSync(join(src, name, 'SKILL.md'))) continue;
  cpSync(join(src, name), join(dest, name), { recursive: true });
  // La copia ya no está dentro del kit: le dejamos la ruta para que encuentre el CLI.
  writeFileSync(join(dest, name, 'kit-path'), dirname(src));
  console.log(`✔ ${name} → ${join(dest, name)}`);
}
