'use client';

import Link from 'next/link';
import SectionFrame from '@/components/SectionFrame';
import { useI18n } from '@/lib/i18n-context';
import { useMm3Accent } from '@/lib/use-mm3-accent';

function renderInline(text, keyPrefix) {
  const pattern = /(\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g;
  const parts = text.split(pattern).filter(Boolean);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    const linkedImageMatch = part.match(/^\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)$/);
    if (linkedImageMatch) {
      return (
        <a
          key={key}
          href={linkedImageMatch[3]}
          target={linkedImageMatch[3].startsWith('http') ? '_blank' : undefined}
          rel={linkedImageMatch[3].startsWith('http') ? 'noopener noreferrer' : undefined}
          className="block"
        >
          <img
            src={linkedImageMatch[2]}
            alt={linkedImageMatch[1]}
            loading="lazy"
            className="my-4 max-h-[420px] w-full border border-cyan-400/20 bg-black/40 object-contain shadow-[0_0_28px_rgba(34,211,238,0.10)]"
          />
        </a>
      );
    }

    const imageMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      return (
        <img
          key={key}
          src={imageMatch[2]}
          alt={imageMatch[1]}
          loading="lazy"
          className="my-4 max-h-[420px] w-full border border-cyan-400/20 bg-black/40 object-contain shadow-[0_0_28px_rgba(34,211,238,0.10)]"
        />
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={key}
          href={linkMatch[2]}
          target={linkMatch[2].startsWith('http') ? '_blank' : undefined}
          rel={linkMatch[2].startsWith('http') ? 'noopener noreferrer' : undefined}
          className="text-[#22d3ee] underline underline-offset-2 hover:text-cyan-200"
        >
          {linkMatch[1]}
        </a>
      );
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="border border-cyan-400/20 bg-cyan-400/5 px-1 text-cyan-100">
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key} className="text-slate-100">{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

function parseTable(lines, startIndex) {
  const rows = [];
  let index = startIndex;

  while (index < lines.length && /^\|.*\|$/.test(lines[index].trim())) {
    rows.push(lines[index].trim());
    index += 1;
  }

  if (rows.length < 2 || !/^\|[\s:-]+\|/.test(rows[1])) {
    return null;
  }

  const headers = rows[0].slice(1, -1).split('|').map((cell) => cell.trim());
  const body = rows.slice(2).map((row) => row.slice(1, -1).split('|').map((cell) => cell.trim()));

  return { headers, body, nextIndex: index };
}

function MarkdownDoc({ text }) {
  const lines = text.split('\n');
  const nodes = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    const key = `md-${index}`;

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      nodes.push(
        <div key={key} className="my-4">
          {lang ? <div className="border border-b-0 border-cyan-400/20 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-emerald-300/70">{lang}</div> : null}
          <pre className="overflow-x-auto border border-cyan-400/20 bg-black/45 p-3 text-[0.78rem] leading-relaxed text-cyan-50">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      nodes.push(
        <div key={key} className="my-5 overflow-x-auto border border-cyan-400/15">
          <table className="min-w-full border-collapse text-left text-[0.78rem]">
            <thead className="bg-cyan-400/10 text-cyan-100">
              <tr>
                {table.headers.map((header, cellIndex) => (
                  <th key={`${key}-h-${cellIndex}`} className="border-b border-cyan-400/20 px-3 py-2 font-bold">
                    {renderInline(header, `${key}-h-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.body.map((row, rowIndex) => (
                <tr key={`${key}-r-${rowIndex}`} className="odd:bg-white/[0.015]">
                  {row.map((cell, cellIndex) => (
                    <td key={`${key}-c-${rowIndex}-${cellIndex}`} className="border-t border-cyan-400/10 px-3 py-2 align-top text-slate-300">
                      {renderInline(cell, `${key}-c-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      index = table.nextIndex;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const textValue = heading[2];
      const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4';
      const className = level === 1
        ? 'mt-2 mb-5 text-2xl font-black text-[#22d3ee] sm:text-3xl'
        : level === 2
          ? 'mt-8 mb-3 text-xl font-bold text-[#22d3ee]'
          : 'mt-6 mb-2 text-base font-bold text-emerald-300';
      nodes.push(<Tag key={key} className={className}>{renderInline(textValue, key)}</Tag>);
      index += 1;
      continue;
    }

    if (trimmed === '---') {
      nodes.push(<hr key={key} className="my-6 border-cyan-400/20" />);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines = [];
      while (index < lines.length && lines[index].trim().startsWith('> ')) {
        quoteLines.push(lines[index].trim().slice(2));
        index += 1;
      }
      nodes.push(
        <blockquote key={key} className="my-4 border-l-2 border-emerald-300/50 bg-emerald-300/[0.04] px-4 py-3 text-slate-200">
          {quoteLines.map((quote, quoteIndex) => (
            <p key={`${key}-q-${quoteIndex}`} className="leading-relaxed">{renderInline(quote, `${key}-q-${quoteIndex}`)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    if (/^- /.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^- /.test(lines[index].trim())) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      nodes.push(
        <ul key={key} className="my-4 list-disc space-y-2 pl-5 text-slate-300">
          {items.map((item, itemIndex) => (
            <li key={`${key}-li-${itemIndex}`} className="leading-relaxed">{renderInline(item, `${key}-li-${itemIndex}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\. /.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\d+\. /.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\. /, ''));
        index += 1;
      }
      nodes.push(
        <ol key={key} className="my-4 list-decimal space-y-2 pl-5 text-slate-300">
          {items.map((item, itemIndex) => (
            <li key={`${key}-oli-${itemIndex}`} className="leading-relaxed">{renderInline(item, `${key}-oli-${itemIndex}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith('```') &&
      !/^#{1,4}\s+/.test(lines[index].trim()) &&
      lines[index].trim() !== '---' &&
      !lines[index].trim().startsWith('> ') &&
      !/^- /.test(lines[index].trim()) &&
      !/^\d+\. /.test(lines[index].trim()) &&
      !/^\|.*\|$/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    const paragraph = paragraphLines.join(' ');
    const isImageOnly = /^(\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)|!\[[^\]]*\]\([^)]+\))$/.test(paragraph);
    nodes.push(isImageOnly ? (
      <div key={key} className="my-4">
        {renderInline(paragraph, key)}
      </div>
    ) : (
      <p key={key} className="my-4 leading-relaxed text-slate-300">
        {renderInline(paragraph, key)}
      </p>
    ));
  }

  return <div className="mm3-markdown-doc">{nodes}</div>;
}

function ReadmeTerminal({ readmeText }) {
  return (
    <section className="mm3-manifesto-panel mb-6 p-4 sm:p-6">
      <MarkdownDoc text={readmeText} />
    </section>
  );
}

export default function ManifestoClient({ readmeText }) {
  const { t, language } = useI18n();
  const { frameAccent } = useMm3Accent();

  const menuLinks = [
    {
      href: '/',
      label: 'Mining',
      desc: language === 'es'
        ? 'el núcleo del juego: resolver, minar, fallar, sobrevivir y volver a inyectar MM3 en la cadena'
        : 'the game core: solve, mine, fail, survive, and inject MM3 back into the chain',
    },
    {
      href: '/trade-mm3',
      label: 'Trading',
      desc: language === 'es'
        ? 'la tty ficticia donde la wallet convierte MM3 en EUR, USD o CNY — visible en modo lectura para cualquiera, activa solo con wallet'
        : 'the fictional tty where the wallet converts MM3 into EUR, USD, or CNY — visible in read-only preview for anyone, live only with a wallet',
    },
    {
      href: '/ranking',
      label: 'Ranking',
      desc: language === 'es'
        ? 'la tabla pública donde se ordena quién manda en el mainframe por nivel, saldo, bloque de Market y penalización activa'
        : 'the public table where the mainframe hierarchy is ordered by level, balance, Market block, and active penalty',
    },
    {
      href: '/mm3-value',
      label: 'MM3',
      desc: language === 'es'
        ? 'el gráfico vivo que enseña cómo mining, trade, heart y NTFJIs deforman el valor global del sistema'
        : 'the live chart that shows how mining, trade, heart, and NTFJIs distort the system-wide value',
    },
    {
      href: '/market',
      label: 'Market',
      desc: language === 'es'
        ? 'el tablero de bloques donde compras, revendes y activas NTFJIs con comandos IRC diarios'
        : 'the block board where wallets buy, resell, and activate NTFJIs with daily IRC commands',
    },
    {
      href: '/irc',
      label: 'IRC',
      desc: language === 'es'
        ? 'el relay social del portal: wallets en vivo, NTFJIs de Market, lista de wallets listas para lanzar comando y códigos numéricos'
        : 'the portal social relay: live wallets, Market NTFJIs, command-ready wallet lists, daily commands, and numeric codes',
    },
    {
      href: '/ai-team',
      label: '@FreakingAI',
      desc: language === 'es'
        ? 'la cámara de máquinas: quién diseña el comportamiento, la economía, la estética y la narrativa del portal'
        : 'the machine room: who designs the behavior, the economy, the aesthetics, and the narrative of the portal',
    },
    {
      href: '/api',
      label: 'API',
      desc: language === 'es'
        ? 'la salida pública para inspeccionar datos, comprobar estados y leer el pulso del sistema sin maquillaje'
        : 'the public outlet to inspect data, check states, and read the system pulse without makeup',
    },
  ];

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

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">{t('manifesto.title')}</h2>
          <p className="leading-relaxed">{t('manifesto.intro1')}</p>
          <p className="leading-relaxed mt-3">{t('manifesto.intro2')}</p>
          <p className="leading-relaxed mt-3">{t('manifesto.intro3')}</p>
        </section>

        <section className="mm3-manifesto-panel mb-6 p-4">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">
            {language === 'es' ? 'Propósito del Mainframe' : 'Mainframe Purpose'}
          </h2>
          <p className="leading-relaxed">
            {language === 'es'
              ? 'MathsMine3 existe para convertir aprendizaje matemático, identidad wallet y estética crypto-freak en un único circuito de tensión. No quiere parecer una academia. Quiere parecer un terminal vivo que te obliga a pensar rápido, arriesgar, volver y recordar. Una respuesta incorrecta rompe todo. Una tirada de suerte lo cambia.'
              : 'MathsMine3 exists to fuse mathematical learning, wallet identity, and crypto-freak aesthetics into a single tension circuit. It does not want to feel like an academy. It wants to feel like a live terminal that forces you to think fast, risk, return, and remember. One wrong answer breaks everything. One lucky roll changes it.'}
          </p>
          <p className="leading-relaxed mt-3">
            {language === 'es'
              ? 'Este Manifiesto ahora carga el README completo como documento vivo: reglas, fórmulas, límites diarios, Market, IRC, ranking, API y sistema visual en una sola página pública. Más contenido útil para usuarios, más contexto para buscadores, mismo ruido de mainframe.'
              : 'This Manifesto now loads the complete README as a living document: rules, formulas, daily limits, Market, IRC, ranking, API, and visual system in one public page. More useful content for users, more context for crawlers, same mainframe noise.'}
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">{t('manifesto.howItWorks')}</h2>
          <p className="leading-relaxed"><strong>{t('manifesto.game')}</strong> {t('manifesto.gameDesc')}</p>
          <p className="leading-relaxed mt-3"><strong>{t('manifesto.ranks')}</strong> {t('manifesto.ranksDesc')}</p>
          <p className="leading-relaxed mt-3"><strong>{t('manifesto.economy')}</strong> {t('manifesto.economyDesc')}</p>
          <p className="leading-relaxed mt-3"><strong>{t('manifesto.community')}</strong> {t('manifesto.communityDesc')}</p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">{t('manifesto.whyMathsMine3')}</h2>
          <ul className="list-disc list-inside space-y-2 leading-relaxed">
            <li><strong>{t('manifesto.addictiveLearning')}</strong> {t('manifesto.addictiveLearningDesc')}</li>
            <li><strong>{t('manifesto.fairTransparent')}</strong> {t('manifesto.fairTransparentDesc')}</li>
            <li><strong>{t('manifesto.web3Native')}</strong> {t('manifesto.web3NativeDesc')}</li>
            <li><strong>{t('manifesto.freeToPlay')}</strong> {t('manifesto.freeToPlayDesc')}</li>
            <li><strong>{t('manifesto.educational')}</strong> {t('manifesto.educationalDesc')}</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-[#22d3ee]">
            {language === 'es' ? 'Mapa del Menú' : 'Menu Map'}
          </h2>
          <div className="space-y-3">
            {menuLinks.map((entry) => (
              <p key={entry.href} className="leading-relaxed">
                <Link href={entry.href} className="text-[#22d3ee] underline hover:text-cyan-300">
                  {entry.label}
                </Link>
                {' — '}
                {entry.desc}
              </p>
            ))}
          </div>
        </section>

        <ReadmeTerminal readmeText={readmeText} />

        <section className="mb-6">
          <p className="leading-relaxed">{t('manifesto.participation')}</p>
        </section>

        <section className="mb-6">
          <p className="leading-relaxed">
            {language === 'es' ? 'Explora el terminal de ' : 'Explore the '}
            <Link href="/trade-mm3" className="text-[#22d3ee] underline hover:text-cyan-300">Trade MM3</Link>
            {language === 'es'
              ? ' para ver el estado ficticio de intercambio de tu wallet en CNY, EUR o USD.'
              : ' terminal to see the fictional trade state for your wallet in CNY, EUR, or USD.'}
          </p>
          <p className="leading-relaxed mt-3">
            {language === 'es' ? 'Y entra en el ' : 'And enter the '}
            <Link href="/irc" className="text-[#22d3ee] underline hover:text-cyan-300">IRC relay</Link>
            {language === 'es'
              ? ' para hablar con otras wallets conectadas, lanzar comandos de Market cuando tengas un NFTJI y ver en tiempo real quién ocupa el mainframe contigo.'
              : ' to talk with other connected wallets, launch Market commands when you own an NFTJI, and see in real time who is occupying the mainframe with you.'}
          </p>
        </section>

        <section className="mb-6">
          <p className="leading-relaxed">
            {t('manifesto.apiIntro')}{' '}
            <Link href="/api" className="text-[#22d3ee] underline hover:text-cyan-300">REST API</Link>
            {' '}{t('manifesto.apiDesc')}
          </p>
        </section>

        <section>
          <p className="leading-relaxed text-slate-600 text-[0.78rem]">
            {language === 'es'
              ? <>→ Legal: <Link href="/privacy" className="underline hover:text-slate-400">Privacidad</Link> · <Link href="/terms" className="underline hover:text-slate-400">Términos</Link></>
              : <>→ Legal: <Link href="/privacy" className="underline hover:text-slate-400">Privacy</Link> · <Link href="/terms" className="underline hover:text-slate-400">Terms</Link></>}
          </p>
        </section>

        </div>
      </SectionFrame>
    </main>
  );
}
