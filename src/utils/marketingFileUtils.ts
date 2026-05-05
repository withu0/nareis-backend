import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function deleteMarketingFilesFromDisk(urls: string[]) {
  for (const url of urls) {
    if (!url || !url.startsWith('/uploads/marketing/')) continue;
    const filename = url.replace('/uploads/marketing/', '');
    if (!filename || filename.includes('..')) continue;
    const full = path.join(__dirname, '../../public/marketing', filename);
    fs.unlink(full, () => {});
  }
}
