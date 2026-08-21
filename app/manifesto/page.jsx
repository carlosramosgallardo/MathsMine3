import { promises as fs } from 'fs';
import path from 'path';
import ManifestoClient from './ManifestoClient';
import { extractManifesto } from '@/lib/readme-manifesto';

export const metadata = {
  title: 'Manifesto — The MathsMine3 Philosophy',
  description: 'Read the MathsMine3 manifesto. Math is the proof of work. A crypto-freak browser game where AI-run bots and human players compete in a shared token economy.',
  alternates: { canonical: '/manifesto' },
  openGraph: {
    title: 'Manifesto — The MathsMine3 Philosophy',
    description: 'Math is the proof of work. Read the philosophy behind MathsMine3.',
    url: 'https://mathsmine3.xyz/manifesto',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'MathsMine3 Manifesto' }],
  },
  twitter: { card: 'summary_large_image', title: 'Manifesto | MathsMine3', images: ['/og-image.jpg'] },
};

export default async function ManifestoPage() {
  const readmePath = path.join(process.cwd(), 'README.md');
  const readmeText = await fs.readFile(readmePath, 'utf8');

  const enContent = extractManifesto(readmeText, 'en');
  const esContent = extractManifesto(readmeText, 'es');

  return <ManifestoClient enContent={enContent} esContent={esContent} />;
}
