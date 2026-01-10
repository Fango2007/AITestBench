import fs from 'fs';
import path from 'path';

const DEFAULT_TEMPLATE_DIR = process.cwd();

export function resolveTemplateDir(): string {
  const configured = process.env.AITESTBENCH_TEST_TEMPLATE_DIR;
  return path.resolve(configured ?? DEFAULT_TEMPLATE_DIR);
}

export function ensureTemplateDir(): string {
  const dir = resolveTemplateDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function buildTemplatePath(id: string, format: 'json' | 'python'): string {
  const extension = format === 'json' ? 'json' : 'py';
  const dir = ensureTemplateDir();
  return path.join(dir, `template-${id}.${extension}`);
}

export function writeTemplateFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

export function deleteTemplateFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }
  fs.unlinkSync(filePath);
}
