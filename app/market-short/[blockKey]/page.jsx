'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import SectionFrame from '@/components/SectionFrame';
import { useI18n } from '@/lib/i18n-context';
import { useMm3Accent } from '@/lib/use-mm3-accent';
import supabase from '@/lib/supabaseClient';

function normalizeShortUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  const shortsMatch = url.match(/youtube\.com\/shorts\/([^?&/]+)/i);
  if (shortsMatch?.[1]) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
  const watchMatch = url.match(/[?&]v=([^?&/]+)/i);
  if (watchMatch?.[1]) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  const shortId = url.match(/youtu\.be\/([^?&/]+)/i);
  if (shortId?.[1]) return `https://www.youtube.com/embed/${shortId[1]}`;
  return url;
}

const FALLBACK_BLOCK = {
  block_key: 'mm3-023',
  emoji: '🛰',
  title_en: 'Genesis uplink',
  title_es: 'Uplink génesis',
  short_url: '',
  claimed_by: null,
  is_active: true,
};

export default function MarketShortPage() {
  const params = useParams();
  const { t, language } = useI18n();
  const { frameAccent } = useMm3Accent();
  const [block, setBlock] = useState(FALLBACK_BLOCK);
  const [loading, setLoading] = useState(true);

  const blockKey = useMemo(() => String(params?.blockKey || FALLBACK_BLOCK.block_key), [params]);

  useEffect(() => {
    let active = true;

    const loadBlock = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('mm3_market_blocks')
          .select('block_key, emoji, title_en, title_es, short_url, claimed_by, is_active')
          .eq('block_key', blockKey)
          .maybeSingle();

        if (error) throw error;
        if (active && data) {
          setBlock({
            ...FALLBACK_BLOCK,
            ...data,
          });
        }
      } catch (error) {
        console.error('market short load:', error);
        if (active) setBlock(FALLBACK_BLOCK);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadBlock();
    return () => {
      active = false;
    };
  }, [blockKey]);

  const embedUrl = normalizeShortUrl(block?.short_url);
  const title = language === 'es'
    ? (block?.title_es || block?.title_en || t('podcast.template'))
    : (block?.title_en || block?.title_es || t('podcast.template'));

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="market-short-section">
        <div className="mx-auto max-w-4xl font-mono text-cyan-100">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-lg font-black text-cyan-100 sm:text-2xl">
                <span className="text-2xl sm:text-3xl">{block?.emoji}</span>
                <span>{title}</span>
              </div>
            </div>

            <Link
              href="/market"
              className="rounded-xl border border-cyan-400/35 bg-black/70 px-4 py-3 text-[0.90rem] font-black uppercase tracking-[0.24em] text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100"
            >
              {t('podcast.backToMarket')}
            </Link>
          </div>

          <section className="rounded-xl border border-cyan-500/20 bg-black/60 p-4 sm:p-5">
            <div className="aspect-[9/16] w-full overflow-hidden rounded-xl border border-cyan-500/20 bg-[#04070d] sm:mx-auto sm:max-w-[380px]">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-[0.7rem] uppercase tracking-[0.2em] text-cyan-300/70">
                  {loading ? t('podcast.loading') : block?.is_active ? t('podcast.pending') : t('podcast.offline')}
                </div>
              )}
            </div>

            <div className="mt-4 text-center text-[0.75rem] uppercase tracking-[0.18em] text-cyan-300/70">
              {block?.claimed_by ? `${t('podcast.owner')}: ${block.claimed_by}` : t('podcast.noWinner')}
            </div>
          </section>
        </div>
      </SectionFrame>
    </main>
  );
}
