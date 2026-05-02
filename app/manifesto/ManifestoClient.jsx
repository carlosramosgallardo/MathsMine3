'use client';

import SectionFrame from '@/components/SectionFrame';
import { useMm3Accent } from '@/lib/use-mm3-accent';

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/`([^`]+)`/g, '$1')
    .replace(/&/g, 'and')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

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
      nodes.push(<Tag key={key} id={slugifyHeading(textValue)} className={`${className} scroll-mt-24`}>{renderInline(textValue, key)}</Tag>);
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
  const { frameAccent } = useMm3Accent();

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

        <ReadmeTerminal readmeText={readmeText} />

        </div>
      </SectionFrame>
    </main>
  );
}
