const CYAN = '#22d3ee';

const features = [
  { icon: '▶', label: 'Play instantly', detail: 'No download, no install' },
  { icon: '◈', label: 'No gas fees', detail: 'Free to play, always' },
  { icon: '⚡', label: 'Real-time tokens', detail: 'MM3 mined on every answer' },
  { icon: '🏆', label: 'Live rankings', detail: 'Global leaderboard' },
  { icon: '⚔', label: 'Pool battles', detail: 'Join pools, crush rivals' },
  { icon: '🎴', label: 'NFT rewards', detail: 'Rare drops for top miners' },
];

const steps = [
  { n: '01', title: 'Solve a math problem', body: 'Each block shows an equation or theory question. Answer before the timer runs out — speed counts.' },
  { n: '02', title: 'Earn MM3 tokens', body: 'Every correct answer injects MM3 into the shared global pool. The faster you answer, the more you earn.' },
  { n: '03', title: 'Climb the ranking', body: 'Accumulate tokens to rise through the leaderboard. Join a pool to coordinate strategy with other miners.' },
  { n: '04', title: 'Sell or hold', body: 'Trade your MM3 balance for real value. Watch the live chart to time your exit.' },
];

export default function LandingHero() {
  return (
    <section
      aria-label="About MathsMine3"
      style={{
        fontFamily: 'Consolas, "Courier New", monospace',
        background: 'linear-gradient(180deg, #070b0f 0%, #060a0d 100%)',
        borderTop: `1px solid ${CYAN}22`,
        padding: '3rem 1rem 4rem',
        marginTop: '1.5rem',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Heading */}
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)', color: CYAN, textShadow: `0 0 24px ${CYAN}66`, letterSpacing: '0.06em', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
            Solve Math. Mine Crypto. Climb the Ranking.
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.7', maxWidth: '600px', margin: '0 auto' }}>
            MathsMine3 is a free browser game where every correct math answer injects MM3 tokens into a shared global pool.
            No download required — play as a guest or connect your wallet to save your score.
          </p>
        </div>

        {/* Feature pills */}
        <ul
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', listStyle: 'none', padding: 0, marginBottom: '3rem' }}
          aria-label="Game features"
        >
          {features.map(({ icon, label, detail }) => (
            <li
              key={label}
              title={detail}
              style={{
                border: `1px solid ${CYAN}33`,
                borderRadius: '6px',
                padding: '0.4rem 0.85rem',
                fontSize: '0.78rem',
                color: '#cbd5e1',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: CYAN, marginRight: '0.4rem' }}>{icon}</span>{label}
            </li>
          ))}
        </ul>

        {/* How it works */}
        <h2 style={{ color: CYAN, fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1.25rem', textAlign: 'center', opacity: 0.7 }}>
          How it works
        </h2>
        <ol
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', listStyle: 'none', padding: 0 }}
          aria-label="How to play MathsMine3"
        >
          {steps.map(({ n, title, body }) => (
            <li
              key={n}
              style={{
                background: '#0d1117',
                border: `1px solid ${CYAN}1a`,
                borderRadius: '8px',
                padding: '1rem',
              }}
            >
              <span style={{ color: CYAN, fontSize: '0.65rem', letterSpacing: '0.15em', opacity: 0.5 }}>{n}</span>
              <h3 style={{ color: '#e2e8f0', fontSize: '0.85rem', marginTop: '0.35rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {title}
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: '1.6', margin: 0 }}>{body}</p>
            </li>
          ))}
        </ol>

        {/* Footer note */}
        <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.72rem', marginTop: '2.5rem', letterSpacing: '0.05em' }}>
          Math is the proof of work · Built by{' '}
          <a href="https://mathsmine3.xyz/ai-team" style={{ color: CYAN, textDecoration: 'none' }}>@FreakingAI</a>
          {' '}· Play free at mathsmine3.xyz
        </p>

      </div>
    </section>
  );
}
