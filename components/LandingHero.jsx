'use client';

import { useI18n } from '@/lib/i18n-context';

const C = '#22d3ee';

const T = {
  en: {
    tagline: 'Math is the proof of work.',
    sub: 'Solve timed math problems to earn MM3 tokens, claim cells on a shared 784-cell board, and be the last wallet standing. Free browser game — no download, no gas fees.',
    guest: 'Play instantly · No wallet needed · Connect later to save your score',
    modesTitle: 'Game modes',
    modes: [
      {
        icon: '⛏',
        name: 'Training',
        desc: 'Solve math problems against the clock.',
        pills: ['100 problems/day', '13 types', 'NOVICE → LEGEND', 'Speed earns more MM3'],
      },
      {
        icon: '⬛',
        name: 'Mining board',
        desc: '784-cell 28×28 grid. Race to claim cells permanently.',
        pills: ['Buy Mining NFTJIs', '/mine block #XXX in Relaying', 'Blocks locked to first miner'],
      },
      {
        icon: '💱',
        name: 'Trading',
        desc: 'Sell MM3 into fictional EUR / USD / CNY.',
        pills: ['5 EXECs/day', '+1 drill slot per EXEC (permanent)', '🎲 Dice shifts rates'],
      },
      {
        icon: '🤝',
        name: 'Pools',
        desc: 'Join a pool to block rival Mining commands.',
        pills: ['Immunity inside pool', 'NODE SWARM → DRAGON MAINNET', 'Pool Ranking by Mining %'],
      },
      {
        icon: '⚔',
        name: 'Squeezing',
        desc: 'Pool-vs-pool combat. Stakes burned, NFTJI drops.',
        pills: ['5% EUR stake per wallet', '45% burned on loss', '🔥🌪️🎲 shift the formula'],
      },
      {
        icon: '>_',
        name: 'Relaying',
        desc: 'Main action terminal. Commands, events, world state.',
        pills: ['/mine block #XXX', 'Daily Mining command (per NFTJI)', 'Live chain + penalty log'],
      },
    ],
    winTitle: 'Win conditions',
    win: [
      { icon: '🏁', text: 'Be #1 in Mining % when all 784 cells are covered (764 chain blocks mined + 20 NFTJIs owned).' },
      { icon: '⚡', text: 'Submit the correct Ω(α, β, γ) for an immediate win — no board completion required.' },
    ],
    rewardsTitle: 'Daily rewards (fictional EUR)',
    rewards: [
      { task: 'Training', target: '25 correct answers', value: '€0.25' },
      { task: 'Trading', target: '5 EXECs', value: '€0.50' },
      { task: 'Mining', target: '1 NFTJI buy / resell', value: '€0.75' },
      { task: 'Relaying', target: '1 Mining command', value: '€1.00' },
      { task: 'Squeezing', target: '1 Squeeze launched', value: '€1.25' },
      { task: 'Chain block', target: '1 free block mined', value: '€10.00' },
      { task: 'Max/day', target: 'All tasks claimed', value: '€17.50' },
    ],
    ranksTitle: 'Ranks',
    ranks: [
      { emoji: '🧪', name: 'NOVICE', range: '0–19', color: C },
      { emoji: '⛏️', name: 'MINER', range: '20–39', color: '#4ade80' },
      { emoji: '🧠', name: 'HACKER', range: '40–59', color: '#facc15' },
      { emoji: '🪄', name: 'WIZARD', range: '60–79', color: '#f97316' },
      { emoji: '👑', name: 'LEGEND', range: '80–100', color: '#e879f9' },
    ],
    legal: 'MM3 is a fictional token. No real mining, no real payout, no investment.',
  },
  es: {
    tagline: 'Las matemáticas son la prueba de trabajo.',
    sub: 'Resuelve problemas contra el reloj para ganar tokens MM3, reclamar celdas en un tablero compartido de 784 posiciones y ser la última wallet en pie. Juego de navegador gratuito — sin descarga, sin gas fees.',
    guest: 'Juega al instante · Sin wallet · Conéctala después para guardar tu puntuación',
    modesTitle: 'Modos de juego',
    modes: [
      {
        icon: '⛏',
        name: 'Training',
        desc: 'Resuelve problemas de matemáticas contra el reloj.',
        pills: ['100 problemas/día', '13 tipos', 'NOVICE → LEGEND', 'Velocidad = más MM3'],
      },
      {
        icon: '⬛',
        name: 'Tablero de Mining',
        desc: 'Cuadrícula 28×28 de 784 celdas. Carrera por reclamarlas.',
        pills: ['Compra Mining NFTJIs', '/mine block #XXX en Relaying', 'Bloques bloqueados al primer minero'],
      },
      {
        icon: '💱',
        name: 'Trading',
        desc: 'Vende MM3 en EUR / USD / CNY ficticios.',
        pills: ['5 EXECs/día', '+1 drill slot por EXEC (permanente)', '🎲 Dice afecta las tasas'],
      },
      {
        icon: '🤝',
        name: 'Pools',
        desc: 'Únete a un pool para bloquear comandos de Mining rivales.',
        pills: ['Inmunidad dentro del pool', 'NODE SWARM → DRAGON MAINNET', 'Ranking de pools por Mining %'],
      },
      {
        icon: '⚔',
        name: 'Squeezing',
        desc: 'Combate pool-vs-pool. Stakes quemados, drops NFTJI.',
        pills: ['5% de EUR en stake por wallet', '45% quemado al perder', '🔥🌪️🎲 alteran la fórmula'],
      },
      {
        icon: '>_',
        name: 'Relaying',
        desc: 'Terminal de acción principal. Comandos, eventos, estado del mundo.',
        pills: ['/mine block #XXX', 'Comando diario de Mining (por NFTJI)', 'Cadena en vivo + log de penalizaciones'],
      },
    ],
    winTitle: 'Condiciones de victoria',
    win: [
      { icon: '🏁', text: 'Ser #1 en Mining % cuando las 784 celdas estén cubiertas (764 bloques minados + 20 NFTJIs con dueño).' },
      { icon: '⚡', text: 'Enviar el Ω(α, β, γ) correcto para victoria inmediata — sin necesidad de completar el tablero.' },
    ],
    rewardsTitle: 'Recompensas diarias (EUR ficticio)',
    rewards: [
      { task: 'Training', target: '25 respuestas correctas', value: '€0,25' },
      { task: 'Trading', target: '5 EXECs', value: '€0,50' },
      { task: 'Mining', target: '1 compra / reventa NFTJI', value: '€0,75' },
      { task: 'Relaying', target: '1 comando de Mining', value: '€1,00' },
      { task: 'Squeezing', target: '1 Squeeze lanzado', value: '€1,25' },
      { task: 'Bloque cadena', target: '1 bloque libre minado', value: '€10,00' },
      { task: 'Máx/día', target: 'Todas las tareas', value: '€17,50' },
    ],
    ranksTitle: 'Rangos',
    ranks: [
      { emoji: '🧪', name: 'NOVICE', range: '0–19', color: C },
      { emoji: '⛏️', name: 'MINER', range: '20–39', color: '#4ade80' },
      { emoji: '🧠', name: 'HACKER', range: '40–59', color: '#facc15' },
      { emoji: '🪄', name: 'WIZARD', range: '60–79', color: '#f97316' },
      { emoji: '👑', name: 'LEGEND', range: '80–100', color: '#e879f9' },
    ],
    legal: 'MM3 es un token ficticio. Sin minería real, sin pagos reales, sin inversión.',
  },
};

export default function LandingHero() {
  const { language } = useI18n();
  const tx = T[language] || T.en;

  return (
    <section
      aria-label={language === 'es' ? 'Sobre MathsMine3' : 'About MathsMine3'}
      style={{
        fontFamily: 'Consolas, "Courier New", monospace',
        background: '#060a0d',
        borderTop: `1px solid ${C}1a`,
        padding: '2.5rem 1rem 3.5rem',
        marginTop: '1rem',
      }}
    >
      <div style={{ maxWidth: '920px', margin: '0 auto' }}>

        {/* ── Tagline ── */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ color: C, fontSize: 'clamp(1rem, 2.5vw, 1.4rem)', textShadow: `0 0 20px ${C}55`, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            {tx.tagline}
          </p>
          <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.7', maxWidth: '620px', margin: '0 auto 0.75rem' }}>
            {tx.sub}
          </p>
          <span style={{ display: 'inline-block', border: `1px solid ${C}30`, borderRadius: '4px', padding: '0.25rem 0.75rem', fontSize: '0.72rem', color: `${C}88`, letterSpacing: '0.06em' }}>
            {tx.guest}
          </span>
        </div>

        {/* ── Game mode cards ── */}
        <h2 style={{ color: `${C}55`, fontSize: '0.65rem', letterSpacing: '0.22em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '1rem' }}>
          {tx.modesTitle}
        </h2>
        <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', listStyle: 'none', padding: 0, marginBottom: '2rem' }}>
          {tx.modes.map(({ icon, name, desc, pills }) => (
            <li key={name} style={{ background: '#0b1015', border: `1px solid ${C}15`, borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ color: C, fontSize: '0.9rem', minWidth: '1.2rem' }}>{icon}</span>
                <span style={{ color: '#e2e8f0', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{name}</span>
              </div>
              <p style={{ color: '#475569', fontSize: '0.76rem', margin: '0 0 0.6rem', lineHeight: '1.5' }}>{desc}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {pills.map(p => (
                  <span key={p} style={{ background: `${C}0d`, border: `1px solid ${C}20`, borderRadius: '3px', padding: '0.15rem 0.45rem', fontSize: '0.68rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {p}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>

        {/* ── Win conditions + Ranks (2-col) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>

          {/* Win conditions */}
          <div style={{ background: '#0b1015', border: `1px solid ${C}15`, borderRadius: '8px', padding: '1rem' }}>
            <h2 style={{ color: `${C}55`, fontSize: '0.65rem', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>{tx.winTitle}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {tx.win.map(({ icon, text }) => (
                <li key={icon} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.9rem', flexShrink: 0, marginTop: '0.05rem' }}>{icon}</span>
                  <span style={{ color: '#64748b', fontSize: '0.76rem', lineHeight: '1.5' }}>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Ranks */}
          <div style={{ background: '#0b1015', border: `1px solid ${C}15`, borderRadius: '8px', padding: '1rem' }}>
            <h2 style={{ color: `${C}55`, fontSize: '0.65rem', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>{tx.ranksTitle}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {tx.ranks.map(({ emoji, name, range, color }) => (
                <li key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <span style={{ fontSize: '0.9rem', minWidth: '1.4rem' }}>{emoji}</span>
                  <span style={{ color, fontSize: '0.76rem', letterSpacing: '0.08em', minWidth: '70px' }}>{name}</span>
                  <span style={{ color: '#334155', fontSize: '0.72rem' }}>lv. {range}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Daily rewards table ── */}
        <div style={{ background: '#0b1015', border: `1px solid ${C}15`, borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
          <h2 style={{ color: `${C}55`, fontSize: '0.65rem', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>{tx.rewardsTitle}</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <tbody>
              {tx.rewards.map(({ task, target, value }, i) => {
                const isMax = i === tx.rewards.length - 1;
                return (
                  <tr key={task} style={{ borderTop: `1px solid ${C}10` }}>
                    <td style={{ padding: '0.35rem 0.5rem 0.35rem 0', color: isMax ? C : '#94a3b8', fontWeight: isMax ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{task}</td>
                    <td style={{ padding: '0.35rem 0.5rem', color: '#475569', width: '99%' }}>{target}</td>
                    <td style={{ padding: '0.35rem 0 0.35rem 0.5rem', color: isMax ? C : '#4ade80', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: isMax ? 'bold' : 'normal' }}>{value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Legal note ── */}
        <p style={{ textAlign: 'center', color: '#1e293b', fontSize: '0.68rem', letterSpacing: '0.04em' }}>
          {tx.legal}
        </p>

      </div>
    </section>
  );
}
