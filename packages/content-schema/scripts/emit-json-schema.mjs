// Emits JSON Schema files (from the Zod schemas) so editors autocomplete and validate content files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { ManifestSchema, ProjectConfigSchema, TourSchema, VideoScriptSchema } from '../dist/index.js';

mkdirSync('schema', { recursive: true });
for (const [name, schema] of [['manifest', ManifestSchema], ['tour', TourSchema], ['video-script', VideoScriptSchema], ['project-config', ProjectConfigSchema]]) {
  writeFileSync(`schema/${name}.schema.json`, JSON.stringify(z.toJSONSchema(schema, { io: 'input' }), null, 2) + '\n');
}
