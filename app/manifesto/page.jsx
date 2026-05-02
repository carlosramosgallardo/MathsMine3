import { promises as fs } from 'fs';
import path from 'path';
import ManifestoClient from './ManifestoClient';

function extractManifesto(readmeText, lang) {
  const startTag = lang === 'es' ? '<!-- MANIFESTO_ES_START -->' : '<!-- MANIFESTO_EN_START -->';
  const endTag = lang === 'es' ? '<!-- MANIFESTO_ES_END -->' : '<!-- MANIFESTO_EN_END -->';
  const startIndex = readmeText.indexOf(startTag);
  const endIndex = readmeText.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return '';
  }

  return readmeText.slice(startIndex + startTag.length, endIndex).trim();
}

export default async function ManifestoPage() {
  const readmePath = path.join(process.cwd(), 'README.md');
  const readmeText = await fs.readFile(readmePath, 'utf8');

  const enContent = extractManifesto(readmeText, 'en');
  const esContent = extractManifesto(readmeText, 'es');

  return <ManifestoClient enContent={enContent} esContent={esContent} />;
}
