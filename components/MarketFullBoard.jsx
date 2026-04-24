'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { useI18n } from '@/lib/i18n-context';
import PageLoading from '@/components/PageLoading';
import { WALLET_DECORATIONS } from '@/lib/wallet-decorations';

const ANSWER_HASH_GENESIS = '0ac59a6eff4c0d73984b7ec775d6a01864e80dbc5e5488c594ed1ae4748ff56d';
const GENESIS_PIXEL_KEY = 'mm3-023';
const GRID_ROWS = 28;
const GRID_COLS = 28;

const PLACEHOLDER_EMOJIS = [
  '💎', '🪐', '📡', '🎧', '📼', '🏆', '💾', '🧷', '🧲', '🪫', '⭐', '💿', '🪩',
  '🧯', '🧬', '🌟', '☢', '⚗️', '🪙', '📟', '🕹', '🎛', '✨', '⚡', '📻',
  '🔭', '🗜', '🧰', '💫', '🔩', '⚙', '🗝', '⛓', '🪤', '🧱', '📎', '✂', '🔐',
  '🛠', '🔌', '🎇', '🕯', '📀', '🪪', '🧭', '🪞', '🪬', '🥇', '⚜️', '🪁',
];

const PLACEHOLDER_NAMES_EN = [
  'Null relay', 'Cipher cache', 'Retro shard', 'Hash prism', 'Tape daemon', 'Orbital latch',
  'Neon bus', 'Static forge', 'Ghost patch', 'Signal kiln', 'Pulse crate', 'Kernel spark',
  'Proxy rune', 'Noise latch', 'Arc shell', 'Mirror vault', 'Dust repeater', 'Copper void',
  'Cold socket', 'Wire relic', 'Miner tape', 'Byte lantern', 'Signal comb', 'Phase spool',
  'Echo clutch', 'Vacuum token', 'Grid cassette', 'Heat sink', 'Vector husk', 'Core fuse',
  'Plasma stub', 'Quartz node', 'Loop pin', 'Codec shard', 'Static idol', 'Rift spool',
  'Torch latch', 'Patch idol', 'Vault coil', 'Frame token', 'Noise engine', 'Delta shell',
  'Rust beacon', 'Spine cache', 'Split cassette', 'Mica relay', 'Circuit relic', 'Tape prism',
  'Cryo shell', 'Kernel husk', 'Zero uplink',
];

const PLACEHOLDER_NAMES_ES = [
  'Relay nulo', 'Cache cifrado', 'Shard retro', 'Prisma hash', 'Daemon cinta', 'Pestillo orbital',
  'Bus neón', 'Forja estática', 'Patch fantasma', 'Horno de señal', 'Caja de pulso', 'Chispa kernel',
  'Runa proxy', 'Pestillo ruido', 'Shell de arco', 'Bóveda espejo', 'Repetidor polvo', 'Vacío cobre',
  'Socket frío', 'Reliquia cable', 'Cinta minera', 'Linterna byte', 'Peine señal', 'Bobina fase',
  'Embrague eco', 'Token vacío', 'Cassette grid', 'Disipador calor', 'Cáscara vector', 'Fusible core',
  'Stub plasma', 'Nodo cuarzo', 'Pin loop', 'Shard codec', 'Ídolo estático', 'Bobina grieta',
  'Pestillo antorcha', 'Ídolo patch', 'Bobina bóveda', 'Token frame', 'Motor ruido', 'Shell delta',
  'Baliza óxido', 'Cache espina', 'Cassette partido', 'Relay mica', 'Reliquia circuito', 'Prisma cinta',
  'Shell cryo', 'Cáscara kernel', 'Uplink cero',
];

const FALLBACK_BLOCK = {
  pixel_key: GENESIS_PIXEL_KEY,
  grid_row: 0,
  grid_col: 22,
  emoji: WALLET_DECORATIONS.marketGenesis,
  title_en: 'Genesis uplink',
  title_es: 'Uplink génesis',
  answer_hash: ANSWER_HASH_GENESIS,
  price_eur: 1,
  short_url: '',
  is_active: true,
  claimed_by: null,
  claimed_source: null,
  claimed_at: null,
  paid_eur: 0,
  paid_usd: 0,
  paid_cny: 0,
};

function getTokenPixelTone(row, col) {
  return {
    backgroundImage: 'url(/mm3-token.png)',
    backgroundSize: `${GRID_COLS * 100}% ${GRID_ROWS * 100}%`,
    backgroundPosition: `${(col / (GRID_COLS - 1)) * 100}% ${(row / (GRID_ROWS - 1)) * 100}%`,
    border: 'rgba(34,211,238,0.08)',
  };
}

function getBlockHex(row, col) {
  return '#' + (row * GRID_COLS + col).toString(16).toUpperCase().padStart(3, '0');
}

function buildMergedBlocks(blocks) {
  const posMap = new Map();
  for (const block of blocks) {
    if (block.grid_row !== null && block.grid_col !== null) {
      posMap.set(`${block.grid_row}-${block.grid_col}`, { ...block, isPlaceholder: false });
    }
  }

  const result = [];
  let placeholderIndex = 0;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const key = `${row}-${col}`;
      if (posMap.has(key)) {
        result.push(posMap.get(key));
        continue;
      }

      result.push({
        pixel_key: `ph-${row}-${col}`,
        grid_row: row,
        grid_col: col,
        emoji: PLACEHOLDER_EMOJIS[placeholderIndex % PLACEHOLDER_EMOJIS.length] || '◈',
        title_en: PLACEHOLDER_NAMES_EN[placeholderIndex % PLACEHOLDER_NAMES_EN.length] || `Template shell ${placeholderIndex + 1}`,
        title_es: PLACEHOLDER_NAMES_ES[placeholderIndex % PLACEHOLDER_NAMES_ES.length] || `Shell plantilla ${placeholderIndex + 1}`,
        answer_hash: '',
        price_eur: 0,
        short_url: '',
        is_active: false,
        claimed_by: null,
        claimed_source: null,
        claimed_at: null,
        paid_eur: 0,
        paid_usd: 0,
        paid_cny: 0,
        isPlaceholder: true,
      });
      placeholderIndex++;
    }
  }
  return result;
}

function stepSelection(blocks, currentKey, direction) {
  const current = blocks.find((entry) => entry.pixel_key === currentKey) || blocks[0];
  if (!current) return currentKey;

  let best = current;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of blocks) {
    if (candidate.pixel_key === current.pixel_key) continue;
    const dx = candidate.grid_col - current.grid_col;
    const dy = candidate.grid_row - current.grid_row;
    const horizontalScore = Math.abs(dx) * 10 + Math.abs(dy);
    const verticalScore = Math.abs(dy) * 10 + Math.abs(dx);
    const valid =
      (direction === 'right' && dx > 0) ||
      (direction === 'left' && dx < 0) ||
      (direction === 'down' && dy > 0) ||
      (direction === 'up' && dy < 0);

    if (!valid) continue;
    const score = direction === 'left' || direction === 'right' ? horizontalScore : verticalScore;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best.pixel_key;
}

export default function MarketFullBoard() {
  const { t, language } = useI18n();
  const [blocks, setBlocks] = useState([FALLBACK_BLOCK]);
  const [selectedKey, setSelectedKey] = useState(GENESIS_PIXEL_KEY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initialKey = new URLSearchParams(window.location.search).get('pixel');
    if (initialKey) setSelectedKey(initialKey);
  }, []);

  useEffect(() => {
    const loadBlocks = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('mm3_podcast_pixels')
          .select('pixel_key, grid_row, grid_col, emoji, title_en, title_es, answer_hash, price_eur, short_url, is_active, claimed_by, claimed_source, claimed_at, paid_eur, paid_usd, paid_cny')
          .order('pixel_key', { ascending: true });

        if (error) throw error;
        setBlocks(Array.isArray(data) && data.length ? data : [FALLBACK_BLOCK]);
      } catch (error) {
        console.error('market full board load:', error);
        setBlocks([FALLBACK_BLOCK]);
      } finally {
        setLoading(false);
      }
    };

    loadBlocks();
    window.addEventListener('focus', loadBlocks);

    const channel = supabase
      .channel('mm3-podcast-full-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_podcast_pixels' }, loadBlocks)
      .subscribe();

    return () => {
      window.removeEventListener('focus', loadBlocks);
      supabase.removeChannel(channel);
    };
  }, []);

  const mergedBlocks = useMemo(() => buildMergedBlocks(blocks), [blocks]);
  const blockMap = useMemo(
    () => new Map(mergedBlocks.map((entry) => [String(entry.pixel_key), entry])),
    [mergedBlocks]
  );

  useEffect(() => {
    if (!blockMap.has(selectedKey)) setSelectedKey(GENESIS_PIXEL_KEY);
  }, [blockMap, selectedKey]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key.replace('Arrow', '').toLowerCase();
      setSelectedKey((current) => stepSelection(mergedBlocks, current, direction));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mergedBlocks]);

  const selectedBlock = blockMap.get(selectedKey) || mergedBlocks[0] || FALLBACK_BLOCK;
  const selectedTitle = language === 'es'
    ? (selectedBlock?.title_es || selectedBlock?.title_en || t('podcast.template'))
    : (selectedBlock?.title_en || selectedBlock?.title_es || t('podcast.template'));
  const selectedHex = getBlockHex(selectedBlock?.grid_row ?? 0, selectedBlock?.grid_col ?? 0);
  const marketHref = selectedBlock?.pixel_key
    ? `/market?pixel=${encodeURIComponent(selectedBlock.pixel_key)}`
    : '/market';

  const move = (direction) => setSelectedKey((current) => stepSelection(mergedBlocks, current, direction));

  return (
    <div className="w-full font-mono text-cyan-100">
      {loading && <PageLoading label={t('podcast.loading')} />}

      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-base leading-none">{selectedBlock?.emoji}</span>
          <span className="truncate text-[0.58rem] font-black uppercase tracking-[0.22em] text-cyan-100/80">{selectedTitle}</span>
          <span className="shrink-0 font-mono text-[0.42rem] text-cyan-400/40">{selectedHex}</span>
        </div>
        <Link
          href={marketHref}
          onClick={() => window.dispatchEvent(new CustomEvent('mm3-route-loading', { detail: { href: '/market', label: 'market' } }))}
          className="shrink-0 border border-cyan-500/20 bg-transparent px-2.5 py-1 text-[0.52rem] font-black uppercase tracking-[0.28em] text-cyan-400/50 transition hover:border-cyan-400/50 hover:text-cyan-300"
        >
          [ {t('podcast.closeFullBoard')} ]
        </Link>
      </div>

      <div className="flex justify-center">
        <div className="relative w-full max-w-[min(97vw,calc(100dvh-220px))]">
          <button
            type="button"
            onClick={() => move('up')}
            className="absolute left-1/2 top-0 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-400/25 bg-black/85 text-[0.6rem] text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100"
            aria-label={t('podcast.panUp')}
          >▲</button>
          <button
            type="button"
            onClick={() => move('left')}
            className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-400/25 bg-black/85 text-[0.6rem] text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100"
            aria-label={t('podcast.panLeft')}
          >◀</button>
          <button
            type="button"
            onClick={() => move('right')}
            className="absolute right-0 top-1/2 z-10 flex h-8 w-8 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-400/25 bg-black/85 text-[0.6rem] text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100"
            aria-label={t('podcast.panRight')}
          >▶</button>
          <button
            type="button"
            onClick={() => move('down')}
            className="absolute bottom-0 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border border-cyan-400/25 bg-black/85 text-[0.6rem] text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100"
            aria-label={t('podcast.panDown')}
          >▼</button>

          <div className="overflow-hidden">
            <div
              className="relative grid w-full"
              style={{
                gridTemplate: `repeat(${GRID_ROWS}, 1fr) / repeat(${GRID_COLS}, 1fr)`,
                aspectRatio: '1 / 1',
                gap: '1px',
              }}
            >
              {mergedBlocks.map((block) => {
                const row = block.grid_row ?? 0;
                const col = block.grid_col ?? 0;
                const isSelected = block.pixel_key === selectedKey;
                const isClaimed = Boolean(block.claimed_by);
                const tone = getTokenPixelTone(row, col);
                const cellHex = getBlockHex(row, col);

                return (
                  <button
                    key={block.pixel_key}
                    type="button"
                    onClick={() => setSelectedKey(block.pixel_key)}
                    className="relative flex items-center justify-center overflow-hidden transition duration-100 focus:outline-none"
                    style={{
                      background: isClaimed
                        ? 'rgba(2,8,4,0.97)'
                        : isSelected
                          ? 'linear-gradient(180deg,rgba(250,204,21,0.42),rgba(113,63,18,0.95))'
                          : undefined,
                      backgroundImage: !isClaimed && !isSelected ? tone.backgroundImage : undefined,
                      backgroundSize: !isClaimed && !isSelected ? tone.backgroundSize : undefined,
                      backgroundPosition: !isClaimed && !isSelected ? tone.backgroundPosition : undefined,
                      border: isSelected
                        ? '1px solid rgba(250,204,21,0.95)'
                        : isClaimed
                          ? '1px solid rgba(34,197,94,0.18)'
                          : `1px solid ${tone.border}`,
                      boxShadow: isSelected
                        ? '0 0 10px rgba(250,204,21,0.35)'
                        : isClaimed
                          ? 'inset 0 0 4px rgba(34,197,94,0.1)'
                          : 'none',
                    }}
                    title={`${block.emoji} ${language === 'es' ? block.title_es : block.title_en}`}
                  >
                    {isSelected && (
                      <>
                        <span className="pointer-events-none text-[min(2.4vw,0.92rem)] leading-none drop-shadow-[0_0_8px_rgba(250,204,21,0.35)] sm:text-[min(1.6vw,1rem)]">
                          {block.emoji}
                        </span>
                        <span className="pointer-events-none absolute bottom-[1px] right-[1px] text-[0.26rem] font-black tracking-[0.08em] text-cyan-100/90 sm:text-[0.3rem]">
                          {cellHex}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
