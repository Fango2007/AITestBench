import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getTemplatesDir } from './template-storage.js';

const SUPPORTED_EXT = ['.json', '.py'];

export interface TemplateMigrationResult {
  copied: number;
  skipped: number;
  sourceMissing: boolean;
}

export function migrateBuiltinTemplates(): TemplateMigrationResult {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const builtinsDir = path.resolve(moduleDir, '../plugins/builtins');
  if (!fs.existsSync(builtinsDir)) {
    return { copied: 0, skipped: 0, sourceMissing: true };
  }

  const templatesDir = getTemplatesDir();

  const files = fs.readdirSync(builtinsDir);
  let copied = 0;
  let skipped = 0;

  for (const file of files) {
    if (!SUPPORTED_EXT.includes(path.extname(file))) {
      continue;
    }
    const source = path.join(builtinsDir, file);
    const destination = path.join(templatesDir, file);
    if (fs.existsSync(destination)) {
      skipped += 1;
      continue;
    }
    fs.copyFileSync(source, destination);
    copied += 1;
  }

  return { copied, skipped, sourceMissing: false };
}
