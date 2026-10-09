import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const cssPath = fileURLToPath(new URL('../src/globals.css', import.meta.url));
const previewRoot = new URL('../../../docs/design/', import.meta.url);
const output = new URL('dist/', previewRoot);
const result = await postcss([tailwind({ base: appRoot })]).process(
  await readFile(cssPath, 'utf8'),
  { from: cssPath },
);

for (const warning of result.warnings()) console.warn(warning.toString());
await mkdir(output, { recursive: true });
await writeFile(new URL('globals.css', output), result.css);
const html = await readFile(new URL('preview.html', previewRoot), 'utf8');
await writeFile(
  new URL('index.html', output),
  html.replace('../../apps/mobile/src/globals.css', './globals.css'),
);
console.log(`Design preview: ${fileURLToPath(new URL('index.html', output))}`);
