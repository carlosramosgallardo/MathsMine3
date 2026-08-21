'use client';

import SectionFrame from '@/components/SectionFrame';
import { useI18n } from '@/lib/i18n-context';
import { useMm3Accent } from '@/lib/use-mm3-accent';
import {
  API_BASE_URL,
  API_COPY,
  API_SECTIONS,
  authLabel,
  buildCurl,
  endpointCount,
} from '@/lib/api-documentation';

function EndpointBlock({ ep, lang }) {
  const c = API_COPY[lang] || API_COPY.en;
  const title = lang === 'es' ? ep.titleEs : ep.titleEn;
  const desc = lang === 'es' ? ep.descEs : ep.descEn;
  const pathOnly = ep.path.split('?')[0];
  const isPublicGet = ep.method === 'GET' && ep.publicGet;
  const line = `${ep.method} ${ep.path}`;

  return (
    <article className="mb-8 border-b border-cyan-900/30 pb-6 last:border-0" id={ep.id}>
      <h3 className="text-base font-semibold mb-1 text-cyan-300">{title}</h3>
      <p className="mb-2 text-gray-400">{desc}</p>
      <p className="mb-2 text-xs text-gray-500">
        {c.auth}: <span className="text-gray-300">{authLabel(ep.auth, lang)}</span>
      </p>
      <code className="block bg-gray-800 p-2 rounded my-2 text-sm">
        {isPublicGet ? (
          <a href={pathOnly} className="text-blue-400" target="_blank" rel="noreferrer">
            {line}
          </a>
        ) : (
          line
        )}
      </code>
      <p className="text-xs uppercase tracking-wider text-gray-500 mt-3 mb-1">{c.curl}</p>
      <pre className="bg-gray-900 p-3 rounded overflow-auto mb-3 text-xs whitespace-pre-wrap">{buildCurl(ep)}</pre>
      {ep.requestSample && (
        <>
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{c.request}</p>
          <pre className="bg-gray-900 p-3 rounded overflow-auto mb-3 text-xs">{ep.requestSample}</pre>
        </>
      )}
      {ep.responseSample && (
        <>
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{c.response}</p>
          <pre className="bg-gray-900 p-3 rounded overflow-auto text-xs">{ep.responseSample}</pre>
        </>
      )}
    </article>
  );
}

export default function ApiPage() {
  const { language } = useI18n();
  const { frameAccent } = useMm3Accent();
  const lang = language === 'es' ? 'es' : 'en';
  const c = API_COPY[lang];
  const total = endpointCount();

  const sections = API_SECTIONS.map((section) => ({
    ...section,
    title: lang === 'es' ? section.titleEs : section.titleEn,
    endpoints: section.endpoints.map((ep, i) => ({
      ...ep,
      id: `${section.id}-${i}`,
    })),
  }));

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="api-section">
        <div className="mm3-readable-scroll max-w-3xl mx-auto px-1 py-1 text-sm font-mono text-gray-400">
          <style>{`
            #api-section h2 {
              color: #22d3ee;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              text-shadow: 0 0 12px rgba(34,211,238,0.24);
            }
            #api-section h3 {
              color: #67e8f9;
            }
            #api-section code,
            #api-section pre {
              border: 1px solid rgba(34,211,238,0.16) !important;
              border-radius: 0 !important;
              background: #02060b !important;
            }
            #api-section a {
              color: #22d3ee;
            }
          `}</style>

          <p className="mb-2">{c.intro}</p>
          <p className="mb-6 text-xs text-gray-500">
            {c.baseUrl}: <code>{API_BASE_URL}</code> · {total} {c.endpointCount}
          </p>

          <nav className="mb-8 p-3 border border-cyan-900/40 bg-gray-900/40">
            <p className="text-xs uppercase tracking-wider text-cyan-400 mb-2">{c.toc}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#section-${section.id}`} className="hover:underline">
                    {section.title} ({section.endpoints.length})
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {sections.map((section) => (
            <section key={section.id} id={`section-${section.id}`} className="mb-10">
              <h2 className="text-xl font-semibold mt-8 mb-4 sticky top-0 bg-[#02060b]/95 py-2 z-10">
                {section.title}
              </h2>
              {section.endpoints.map((ep) => (
                <EndpointBlock key={ep.id} ep={ep} lang={lang} />
              ))}
            </section>
          ))}

          <h2 className="text-xl font-semibold mt-8 mb-2">{c.rateLimit}</h2>
          <p className="mb-6">{c.rateLimitDesc}</p>
        </div>
      </SectionFrame>
    </main>
  );
}
