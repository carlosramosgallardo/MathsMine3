'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import supabase from '@/lib/supabaseClient';

const isHex = (v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test((v || '').replace('#', ''));
const normHex = (v) => (v?.startsWith?.('#') ? v : `#${v || ''}`);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

const hslToHex = (h, s, l) => {
  h = ((h % 360) + 360) % 360;
  s = clamp01(s / 100);
  l = clamp01(l / 100);
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
};

const colorFromAddress = (addr = '') => {
  const s = String(addr).toLowerCase().replace(/^0x/, '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hslToHex(hash % 360, 70, 55);
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const fetchTop1WalletOnce = async () => {
  try {
    const { data, error } = await supabase
      .from('leaderboard_data')
      .select('wallet, total_eth')
      .order('total_eth', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.wallet) return data.wallet;
  } catch {}

  try {
    const { data, error } = await supabase
      .from('top_positive_miner')
      .select('wallet, pos_total')
      .order('pos_total', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.wallet) return data.wallet;
  } catch {}

  return null;
};

const fetchTop1WalletWithRetries = async (retries = 2) => {
  let last = null;
  for (let i = 0; i <= retries; i++) {
    last = await fetchTop1WalletOnce();
    if (last) return last;
    await sleep(i === 0 ? 700 : 1500);
  }
  return last;
};

export function useMm3Accent() {
  const [orbColor, setOrbColor] = useState('#000000');
  const isReconciling = useRef(false);

  const loadOrbColor = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('mm3_visual_state')
        .select('color_hex')
        .eq('id', 1)
        .maybeSingle();
      if (data?.color_hex && isHex(data.color_hex)) setOrbColor(normHex(data.color_hex));
    } catch {}
  }, []);

  const reconcileTop1Color = useCallback(async () => {
    if (isReconciling.current) return;
    isReconciling.current = true;
    try {
      const top = await fetchTop1WalletWithRetries(2);
      const topLower = String(top || '').toLowerCase();
      if (!topLower) return;
      const shouldHex = colorFromAddress(topLower);
      if (!isHex(shouldHex)) return;
      setOrbColor(normHex(shouldHex));
    } finally {
      isReconciling.current = false;
    }
  }, []);

  useEffect(() => {
    loadOrbColor().then(reconcileTop1Color);
  }, [loadOrbColor, reconcileTop1Color]);

  useEffect(() => {
    let timer = null;
    const tick = async () => {
      await reconcileTop1Color();
      timer = setTimeout(tick, 6000);
    };
    timer = setTimeout(tick, 6000);
    const onVisible = async () => {
      if (document.visibilityState === 'visible') await reconcileTop1Color();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reconcileTop1Color]);

  useEffect(() => {
    const onDbUpdated = () => loadOrbColor();
    window.addEventListener('mm3-db-updated', onDbUpdated);
    return () => window.removeEventListener('mm3-db-updated', onDbUpdated);
  }, [loadOrbColor]);

  const frameAccent =
    typeof orbColor === 'string' && orbColor.toLowerCase() !== '#000000'
      ? orbColor
      : '#cbd5e1';

  return { frameAccent, reconcileTop1Color };
}
