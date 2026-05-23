'use client';

import SectionFrame from '@/components/SectionFrame';
import DailyTasks from '@/components/DailyTasks';
import { useMm3Accent } from '@/lib/use-mm3-accent';
import { useI18n } from '@/lib/i18n-context';

function slugify(text) {
  return String(text || '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function isTableSeparator(line) {
  return /^\s*\|?[\s:-]+\|[\s|:-]*\|?\s*$/.test(line);
}

function isBlockStart(line, nextLine = '') {
  return /^#{1,4}\s+/.test(line)
    || /^---+\s*$/.test(line)
    || /^```/.test(line)
    || /^>\s?/.test(line)
    || /^[-*]\s+/.test(line)
    || /^\d+\.\s+/.test(line)
    || (/^\s*\|.*\|\s*$/.test(line) && isTableSeparator(nextLine));
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function renderInline(text, keyPrefix = 'inline') {
  const source = String(text || '');
  const nodes = [];
  let rest = source;
  let index = 0;

  const patterns = [
    {
      type: 'linked-image',
      regex: /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/,
    },
    {
      type: 'image',
      regex: /!\[([^\]]*)\]\(([^)]+)\)/,
    },
    {
      type: 'link',
      regex: /\[([^\]]+)\]\(([^)]+)\)/,
    },
    {
      type: 'strong',
      regex: /\*\*([^*]+)\*\*/,
    },
    {
      type: 'code',
      regex: /`([^`]+)`/,
    },
  ];

  while (rest) {
    let best = null;

    for (const pattern of patterns) {
      const match = pattern.regex.exec(rest);
      if (!match) continue;
      if (!best || match.index < best.match.index) {
        best = { ...pattern, match };
      }
    }

    if (!best) {
      nodes.push(rest);
      break;
    }

    if (best.match.index > 0) {
      nodes.push(rest.slice(0, best.match.index));
    }

    const key = `${keyPrefix}-${index}`;
    const [, first, second, third] = best.match;

    if (best.type === 'linked-image') {
      nodes.push(
        <a key={key} href={third} className="mm3-doc-image-link">
          <img src={second} alt={first} loading="lazy" className="mm3-doc-image" />
        </a>
      );
    } else if (best.type === 'image') {
      nodes.push(
        <img key={key} src={second} alt={first} loading="lazy" className="mm3-doc-image" />
      );
    } else if (best.type === 'link') {
      const external = /^https?:\/\//.test(second);
      nodes.push(
        <a
          key={key}
          href={second}
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer' : undefined}
        >
          {renderInline(first, `${key}-label`)}
        </a>
      );
    } else if (best.type === 'strong') {
      nodes.push(<strong key={key}>{renderInline(first, `${key}-strong`)}</strong>);
    } else if (best.type === 'code') {
      nodes.push(<code key={key}>{first}</code>);
    }

    rest = rest.slice(best.match.index + best.match[0].length);
    index += 1;
  }

  return nodes;
}

function parseMarkdown(readmeText) {
  const lines = String(readmeText || '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !/^\*\*Live:\*\*/.test(trimmed)
        && !/^<a\s+name=["'](?:english|español|espanol)["']\s*><\/a>$/i.test(trimmed)
        && !/^\[!\[MathsMine3 Portal\]\([^)]+\)\]\([^)]+\)$/.test(trimmed);
    });
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const language = line.replace(/^```/, '').trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'code', language, text: codeLines.join('\n') });
      i += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2].trim(),
        id: slugify(heading[2]),
      });
      i += 1;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: quoteLines.join(' ') });
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line) && isTableSeparator(nextLine)) {
      const header = splitTableRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, '').trim());
        i += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, '').trim());
        i += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    const paragraph = [line.trim()];
    i += 1;
    while (
      i < lines.length
      && lines[i].trim()
      && !isBlockStart(lines[i], lines[i + 1] || '')
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

function ReadmeTerminal({ readmeText }) {
  const blocks = parseMarkdown(readmeText);

  return (
    <section className="mm3-manifesto-panel mm3-markdown-doc mb-6 p-4 sm:p-6 leading-relaxed text-slate-300">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const HeadingTag = `h${Math.min(block.level, 4)}`;
          return (
            <HeadingTag key={`${block.id}-${index}`} id={block.id}>
              <a href={`#${block.id}`}>{renderInline(block.text, `heading-${index}`)}</a>
            </HeadingTag>
          );
        }

        if (block.type === 'paragraph') {
          return <p key={index}>{renderInline(block.text, `p-${index}`)}</p>;
        }

        if (block.type === 'quote') {
          return <blockquote key={index}>{renderInline(block.text, `q-${index}`)}</blockquote>;
        }

        if (block.type === 'hr') {
          return <hr key={index} />;
        }

        if (block.type === 'code') {
          return (
            <pre key={index}>
              <code>{block.text}</code>
            </pre>
          );
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={`${index}-${itemIndex}`}>{renderInline(item, `li-${index}-${itemIndex}`)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'table') {
          return (
            <div key={index} className="mm3-doc-table-wrap">
              <table>
                <thead>
                  <tr>
                    {block.header.map((cell, cellIndex) => (
                      <th key={cellIndex}>{renderInline(cell, `th-${index}-${cellIndex}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {block.header.map((_, cellIndex) => (
                        <td key={cellIndex}>{renderInline(row[cellIndex] || '', `td-${index}-${rowIndex}-${cellIndex}`)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return null;
      })}
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
              background: rgba(2, 6, 11, 0.96);
              border: 1px solid rgba(34, 211, 238, 0.22);
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
              color: #f8fafc;
              font-weight: 800;
              letter-spacing: 0;
              line-height: 1.18;
              margin: 1.45rem 0 0.75rem;
              scroll-margin-top: 8rem;
              text-transform: none;
              text-shadow: 0 0 12px rgba(34,211,238,0.18);
            }
            #manifesto-section .mm3-markdown-doc h1 {
              color: #67e8f9;
              font-size: clamp(1.55rem, 4vw, 2.65rem);
              margin-top: 0;
            }
            #manifesto-section .mm3-markdown-doc h2 {
              border-top: 1px solid rgba(34, 211, 238, 0.15);
              color: #e2e8f0;
              font-size: clamp(1.1rem, 2.4vw, 1.55rem);
              padding-top: 1rem;
            }
            #manifesto-section .mm3-markdown-doc h3 {
              color: #bae6fd;
              font-size: 1rem;
            }
            #manifesto-section .mm3-markdown-doc h1 a,
            #manifesto-section .mm3-markdown-doc h2 a,
            #manifesto-section .mm3-markdown-doc h3 a,
            #manifesto-section .mm3-markdown-doc h4 a {
              color: inherit;
              text-decoration: none;
            }
            #manifesto-section .mm3-markdown-doc h1 a:hover,
            #manifesto-section .mm3-markdown-doc h2 a:hover,
            #manifesto-section .mm3-markdown-doc h3 a:hover,
            #manifesto-section .mm3-markdown-doc h4 a:hover {
              color: #22d3ee;
            }
            #manifesto-section .mm3-markdown-doc p,
            #manifesto-section .mm3-markdown-doc blockquote {
              margin: 0.85rem 0;
            }
            #manifesto-section .mm3-markdown-doc blockquote {
              border-left: 3px solid rgba(34, 211, 238, 0.55);
              color: #c4b5fd;
              font-size: 1rem;
              padding-left: 1rem;
            }
            #manifesto-section .mm3-markdown-doc a {
              color: #67e8f9;
              text-decoration: underline;
              text-decoration-color: rgba(103, 232, 249, 0.4);
              text-underline-offset: 0.18em;
            }
            #manifesto-section .mm3-markdown-doc a:hover {
              color: #f0f9ff;
              text-decoration-color: rgba(240, 249, 255, 0.8);
            }
            #manifesto-section .mm3-markdown-doc strong {
              color: #f8fafc;
              font-weight: 800;
            }
            #manifesto-section .mm3-markdown-doc code {
              background: rgba(15, 23, 42, 0.85);
              border: 1px solid rgba(34, 211, 238, 0.18);
              color: #bae6fd;
              padding: 0.08rem 0.28rem;
            }
            #manifesto-section .mm3-markdown-doc pre {
              background: rgba(2, 6, 23, 0.88);
              border: 1px solid rgba(34, 211, 238, 0.18);
              margin: 1rem 0;
              overflow-x: auto;
              padding: 0.9rem 1rem;
            }
            #manifesto-section .mm3-markdown-doc pre code {
              background: transparent;
              border: 0;
              display: block;
              padding: 0;
              white-space: pre;
            }
            #manifesto-section .mm3-markdown-doc ul,
            #manifesto-section .mm3-markdown-doc ol {
              margin: 0.85rem 0 1rem 1.35rem;
            }
            #manifesto-section .mm3-markdown-doc li {
              margin: 0.32rem 0;
              padding-left: 0.2rem;
            }
            #manifesto-section .mm3-markdown-doc hr {
              border: 0;
              border-top: 1px solid rgba(34, 211, 238, 0.18);
              margin: 1.4rem 0;
            }
            #manifesto-section .mm3-doc-image-link {
              display: block;
              margin: 1rem 0 1.2rem;
              text-decoration: none;
            }
            #manifesto-section .mm3-doc-image {
              border: 1px solid rgba(34, 211, 238, 0.24);
              display: block;
              height: auto;
              max-height: 340px;
              max-width: 100%;
              object-fit: contain;
              width: 100%;
            }
            #manifesto-section .mm3-doc-table-wrap {
              margin: 1rem 0;
              overflow-x: auto;
            }
            #manifesto-section .mm3-markdown-doc table {
              border-collapse: collapse;
              min-width: 640px;
              width: 100%;
            }
            #manifesto-section .mm3-markdown-doc th,
            #manifesto-section .mm3-markdown-doc td {
              border: 1px solid rgba(34, 211, 238, 0.16);
              padding: 0.55rem 0.7rem;
              text-align: left;
              vertical-align: top;
            }
            #manifesto-section .mm3-markdown-doc th {
              background: rgba(34, 211, 238, 0.08);
              color: #f8fafc;
              font-weight: 800;
            }
            #manifesto-section .mm3-markdown-doc td {
              background: rgba(15, 23, 42, 0.32);
            }
            @media (max-width: 640px) {
              #manifesto-section .mm3-manifesto-panel {
                padding: 1rem;
              }
              #manifesto-section .mm3-markdown-doc table {
                min-width: 520px;
              }
            }
            @media (min-width: 768px) {
              #manifesto-section .mm3-doc-image-link {
                margin: 1rem auto 1.2rem;
                max-width: 440px;
              }
              #manifesto-section .mm3-doc-image {
                margin: 0 auto;
                width: min(100%, 440px);
              }
            }
          `}</style>

          <DailyTasks framed={false} />
          <ReadmeTerminal readmeText={manifestoContent} />
        </div>
      </SectionFrame>
    </main>
  );
}
