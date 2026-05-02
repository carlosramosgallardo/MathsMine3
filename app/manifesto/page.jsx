import { promises as fs } from 'fs';
import path from 'path';
import ManifestoClient from './ManifestoClient';

export default async function ManifestoPage() {
  const readmePath = path.join(process.cwd(), 'README.md');
  const readmeText = await fs.readFile(readmePath, 'utf8');

  return <ManifestoClient readmeText={readmeText} />;
}
