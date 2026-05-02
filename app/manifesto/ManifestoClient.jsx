'use client';

import SectionFrame from '@/components/SectionFrame';
import { useMm3Accent } from '@/lib/use-mm3-accent';
import { useI18n } from '@/lib/i18n-context';

function ReadmeTerminal({ readmeText }) {
  return (
    <section className="mm3-manifesto-panel mb-6 p-4 sm:p-6 whitespace-pre-wrap leading-relaxed text-slate-300">
      {readmeText}
    </section>
  );
}

export default function ManifestoClient({ enContent, esContent }) {
  const { frameAccent } = useMm3Accent();
  const { language } = useI18n();

  const normalizedLang = String(language || 'en').toLowerCase();
  const manifestoContent = normalizedLang.startsWith('es')
    ? (esContent || enContent)
    : (enContent || esContent);

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="manifesto-section">
        <div className="mm3-readable-scroll mx-auto max-w-5xl px-1 py-1 text-sm font-mono text-gray-400 break-words overflow-x-hidden">
          <style>{`
            #manifesto-section .mm3-manifesto-panel {
              background: linear-gradient(180deg, rgba(5,8,16,0.96) 0%, rgba(2,6,23,0.9) 100%);
              border: 1px solid rgba(34, 211, 238, 0.22);
              box-shadow: inset 0 0 24px rgba(34,211,238,0.05), 0 0 18px rgba(34,211,238,0.06);
            }
            #manifesto-section h2 {
              letter-spacing: 0.12em;
              text-transform: uppercase;
              text-shadow: 0 0 12px rgba(34,211,238,0.24);
            }
            #manifesto-section .mm3-markdown-doc {
              color: rgba(226, 232, 240, 0.9);
            }
            #manifesto-section .mm3-markdown-doc::selection {
              background: rgba(34, 211, 238, 0.25);
              color: #fff;
            }
            #manifesto-section .mm3-markdown-doc h1,
            #manifesto-section .mm3-markdown-doc h2,
            #manifesto-section .mm3-markdown-doc h3,
            #manifesto-section .mm3-markdown-doc h4 {
              letter-spacing: 0.06em;
              text-transform: none;
            }
          `}</style>

          <ReadmeTerminal readmeText={manifestoContent} />
        </div>
      </SectionFrame>
    </main>
  );
}