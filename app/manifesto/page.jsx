import { promises as fs } from 'fs';
import path from 'path';
import ManifestoClient from './ManifestoClient';

function extractManifesto(readmeText) {
  const start = '<!-- MANIFESTO_START -->';
  const end = '<!-- MANIFESTO_END -->';
  const startIndex = readmeText.indexOf(start);
  const endIndex = readmeText.indexOf(end);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return readmeText;
  }

  return readmeText.slice(startIndex + start.length, endIndex).trim();
}

export default async function ManifestoPage() {
  const readmePath = path.join(process.cwd(), 'README.md');
  const readmeText = await fs.readFile(readmePath, 'utf8');

  return <ManifestoClient readmeText={extractManifesto(readmeText)} />;
}
