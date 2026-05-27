'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';

const C = '#22d3ee';

const SECTIONS = {
  en: [
    { href: '/',           icon: '⛏',  name: 'Training',    desc: 'Solve math problems against the clock. 100/day, 13 types. Speed earns more MM3.' },
    { href: '/mining',     icon: '⬛',  name: 'Mining',      desc: '784-cell 28×28 board. Race to claim cells permanently with NFTJIs.' },
    { href: '/trading',    icon: '💱',  name: 'Trading',     desc: 'Sell MM3 into fictional EUR / USD / CNY. 5 EXECs/day — dice shifts rates.' },
    { href: '/ranking',    icon: '🏆',  name: 'Ranking',     desc: 'Live wallet & pool leaderboard. Mining %, level, EXECs and penalty log.' },
    { href: '/squeezing',  icon: '⚔',  name: 'Squeezing',   desc: 'Pool-vs-pool combat. Stakes burned, NFTJI drops, formula shifts.' },
    { href: '/relaying',   icon: '>_', name: 'Relaying',    desc: 'Main action terminal. /mine commands, world events, live chain log.' },
    { href: '/mm3-value',  icon: '📈',  name: 'MM3 Chart',   desc: 'Real-time MM3 token value chart across EUR, USD and CNY.' },
    { href: '/manifesto',  icon: '📜',  name: 'Manifesto',   desc: 'The philosophy behind MathsMine3 — why math is the proof of work.' },
    { href: '/ai-team',    icon: '🤖',  name: 'AI Team',     desc: 'Meet the bot wallets running 24/7 on the board alongside human miners.' },
  ],
  es: [
    { href: '/',           icon: '⛏',  name: 'Training',    desc: 'Resuelve problemas contra el reloj. 100/día, 13 tipos. Velocidad = más MM3.' },
    { href: '/mining',     icon: '⬛',  name: 'Mining',      desc: 'Tablero 28×28 de 784 celdas. Carrera por reclamarlas con NFTJIs.' },
    { href: '/trading',    icon: '💱',  name: 'Trading',     desc: 'Vende MM3 en EUR / USD / CNY ficticios. 5 EXECs/día — dados afectan tasas.' },
    { href: '/ranking',    icon: '🏆',  name: 'Ranking',     desc: 'Clasificación en vivo de wallets y pools. Mining %, nivel, EXECs y penalizaciones.' },
    { href: '/squeezing',  icon: '⚔',  name: 'Squeezing',   desc: 'Combate pool-vs-pool. Stakes quemados, drops de NFTJI, la fórmula cambia.' },
    { href: '/relaying',   icon: '>_', name: 'Relaying',    desc: 'Terminal de acción. Comandos /mine, eventos del mundo, log de cadena en vivo.' },
    { href: '/mm3-value',  icon: '📈',  name: 'MM3 Chart',   desc: 'Gráfica del valor del token MM3 en tiempo real en EUR, USD y CNY.' },
    { href: '/manifesto',  icon: '📜',  name: 'Manifiesto',  desc: 'La filosofía detrás de MathsMine3 — por qué las matemáticas son la prueba de trabajo.' },
    { href: '/ai-team',    icon: '🤖',  name: 'AI Team',     desc: 'Conoce los bots que corren 24/7 en el tablero junto a los mineros humanos.' },
  ],
};

export default function LandingHero() {
  const { language } = useI18n();
  const sections = SECTIONS[language] || SECTIONS.en;

  return (
    <section
      aria-label={language === 'es' ? 'Sobre MathsMine3' : 'About MathsMine3'}
      style={{
        fontFamily: 'Consolas, "Courier New", monospace',
        background: '#060a0d',
        borderTop: `1px solid ${C}1a`,
        padding: '2rem 1rem 3rem',
        marginTop: '1rem',
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <div style={{ maxWidth: '920px', margin: '0 auto', width: '100%', boxSizing: 'border-box', minWidth: 0 }}>

        <p style={{
          color: C,
          fontSize: 'clamp(0.9rem, 2vw, 1.2rem)',
          textShadow: `0 0 20px ${C}55`,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textAlign: 'center',
          marginBottom: '1.75rem',
        }}>
          {language === 'es' ? 'Las matemáticas son la prueba de trabajo.' : 'Math is the proof of work.'}
        </p>

        <ul style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
          gap: '0.6rem',
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}>
          {sections.map(({ href, icon, name, desc }) => (
            <li key={href} style={{ minWidth: 0 }}>
              <Link
                href={href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  background: '#0b1015',
                  border: `1px solid ${C}18`,
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  textDecoration: 'none',
                  transition: 'border-color 0.18s, background 0.18s',
                  height: '100%',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = `${C}55`;
                  e.currentTarget.style.background = '#0d1419';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = `${C}18`;
                  e.currentTarget.style.background = '#0b1015';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.95rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                  <span style={{ color: '#e2e8f0', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }}>{name}</span>
                </div>
                <p style={{ color: '#475569', fontSize: '0.72rem', margin: 0, lineHeight: '1.5', wordBreak: 'break-word' }}>{desc}</p>
              </Link>
            </li>
          ))}
        </ul>

        <p style={{ textAlign: 'center', color: '#1e293b', fontSize: '0.65rem', letterSpacing: '0.04em', marginTop: '2rem' }}>
          {language === 'es'
            ? 'MM3 es un token ficticio. Sin minería real, sin pagos reales, sin inversión.'
            : 'MM3 is a fictional token. No real mining, no real payout, no investment.'}
        </p>

      </div>
    </section>
  );
}
