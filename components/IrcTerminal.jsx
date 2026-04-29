'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { useI18n } from '@/lib/i18n-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { useSound } from '@/lib/sound-context';
import { CNY_TO_EUR, CNY_TO_USD, getSellRateCny } from '@/lib/sell-offer';
import {
  computeMarketCommandCode,
  marketCommandFromBlock,
  normalizeCommandText,
  getUtcDayWindow,
} from '@/lib/market-commands';
import { useIrcPresence } from '@/lib/irc-presence-context';
import { colorFromAddress } from '@/lib/wallet-colors';

const ACTIVE_WINDOW_MS = 90_000;
const MAX_SESSION_MESSAGES = 500;
const MAX_CHAT_HISTORY = 500;

function flagImgUrl(cc) {
  if (!cc || cc.length !== 2) return null;
  return `https://flagcdn.com/16x12/${cc.toLowerCase()}.png`;
}

function FlagImg({ cc, style }) {
  const url = flagImgUrl(cc);
  if (!url) return <span style={style}>🌐</span>;
  return <img src={url} alt={cc} style={{ display: 'inline', verticalAlign: 'middle', height: '0.7rem', ...style }} />;
}

function hashIpToId(ip) {
  let h = 5381;
  for (let i = 0; i < ip.length; i++) {
    h = ((h << 5) + h) ^ ip.charCodeAt(i);
    h = h >>> 0;
  }
  return `anon:${h.toString(36).slice(0, 6).padStart(6, '0')}`;
}
const IRC_ADMIN_WALLET = '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab';
const IRC_ADMIN_LABEL = 'freakingAI@MM3';

function getBlockHex(row, col) {
  return '#' + ((Number(row) || 0) * 28 + (Number(col) || 0)).toString(16).toUpperCase().padStart(3, '0');
}

function safeParseSession(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sessionKeyForWallet(wallet) {
  return `mm3-irc-session-${String(wallet || '').toLowerCase()}`;
}

function makeMessage({ id, kind = 'chat', wallet = 'system', text = '', ts = Date.now(), tone = 'neutral' }) {
  return { id, kind, wallet, text, ts, tone };
}

function formatRelayTime(ts) {
  try {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch {
    return '--:--:--';
  }
}

function formatClockTime(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--:--:--';

    const p = (n) => String(n).padStart(2, '0');

    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch {
    return '--:--:--';
  }
}

function normalizeRelayMessage(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 280);
}

function shortenWallet(value) {
  const wallet = String(value || '');
  if (wallet.length <= 18) return wallet;
  return `${wallet.slice(0, 10)}…${wallet.slice(-6)}`;
}

function shortenMarketWallet(value) {
  const wallet = String(value || '');
  if (!wallet) return '';
  if (wallet.length <= 14) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatIrcWalletLabel(wallet) {
  const normalized = String(wallet || '').toLowerCase();
  return normalized === IRC_ADMIN_WALLET ? IRC_ADMIN_LABEL : shortenWallet(normalized);
}

function formatChatAuthor(wallet, normalizedWallet, youLabel) {
  const normalized = String(wallet || '').toLowerCase();
  const baseLabel = normalized === IRC_ADMIN_WALLET ? IRC_ADMIN_LABEL : normalized;
  return normalized === normalizedWallet ? `${baseLabel} (${youLabel})` : baseLabel;
}

function tickerFromRow(row, language, fallback) {
  const localized = language === 'es' ? row?.ticker_message_es : row?.ticker_message_en;
  return String(localized || row?.ticker_message || fallback || '').trim() || fallback;
}

export default function IrcTerminal({ accent = '#22d3ee' }) {
  const { t, language } = useI18n();
  const { account } = useActiveWallet();
  const { playIrcMessage } = useSound();
  // Stable anon ID initialization - check all sources for maximum stability
  const initAnonId = (() => {
    if (typeof window === 'undefined') return 'anon:000000';
    const k = 'mm3-anon-session';
    const sessionStored = sessionStorage.getItem(k);
    if (sessionStored?.startsWith('anon:')) return sessionStored;
    // Try meta cache (has IP-based stable ID)
    try {
      const cached = JSON.parse(sessionStorage.getItem('mm3-anon-meta') || '{}');
      if (cached.id?.startsWith('anon:')) return cached.id;
    } catch {}
    // Generate new random as last resort
    return `anon:${Math.random().toString(36).slice(2, 8)}`;
  })();

  const normalizedWallet = useMemo(() => String(account || '').toLowerCase(), [account]);
  const { anonIrcUsers: anonUsers, trackAnon, untrackAnon, channelStatus } = useIrcPresence();
  const [anonId, setAnonId] = useState(initAnonId);
  const [anonFlag, setAnonFlag] = useState('');
  const [anonVisibleCount, setAnonVisibleCount] = useState(5);
  const [walletFlag, setWalletFlag] = useState('');
  const [walletFlags, setWalletFlags] = useState({});
  const actorId = normalizedWallet || anonId;
  const storageKey = useMemo(() => sessionKeyForWallet(actorId), [actorId]);

  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [connectedWallets, setConnectedWallets] = useState([]);
  const [marketClaimsByWallet, setMarketClaimsByWallet] = useState({});
  const [relayReady, setRelayReady] = useState(false);
  const [totalWallets, setTotalWallets] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);

  const relayRef = useRef(null);
  const previousPresenceRef = useRef(new Set());
  const presenceBootedRef = useRef(false);
  const endRef = useRef(null);
  const blockByKeyRef = useRef(new Map());
  const inputRef = useRef(null);

  // Auto-focus input when wallet is connected and terminal is ready
  useEffect(() => {
    if (normalizedWallet && inputRef.current) {
      inputRef.current.focus();
    }
  }, [normalizedWallet, relayReady]);

  const persistMessages = useCallback((nextMessages) => {
    if (typeof window === 'undefined' || !storageKey) return;
    sessionStorage.setItem(storageKey, JSON.stringify(nextMessages.slice(-MAX_SESSION_MESSAGES)));
  }, [storageKey]);

  const appendMessage = useCallback((message, options = {}) => {
    if (!message?.id) return;
    setMessages((current) => {
      if (current.some((entry) => entry.id === message.id)) return current;
      const next = [...current, message].slice(-MAX_SESSION_MESSAGES);
      persistMessages(next);
      return next;
    });
    if (!options.silent) {
      playIrcMessage();
    }
  }, [persistMessages, playIrcMessage]);

  const upsertMessage = useCallback((message) => {
    if (!message?.id) return;
    setMessages((current) => {
      const filtered = current.filter((m) => !String(m.id).startsWith('relay-status:'));
      const next = [...filtered, message].slice(-MAX_SESSION_MESSAGES);
      persistMessages(next);
      return next;
    });
  }, [persistMessages]);

  const buildMarketStatusLines = useCallback(({ ownersData = [], commandsData = [], blocksData = [], penaltiesData = [] }) => {
    const blocks = blocksData || [];
    const blockByKey = new Map(blocks.map((entry) => [entry.block_key, entry]));
    blockByKeyRef.current = blockByKey;

    const commandEntries = blocks.map(marketCommandFromBlock).filter(Boolean);
    const commandEntryByKey = new Map(commandEntries.map((entry) => [entry.key, entry]));
    const ownerWalletsByKey = new Map();
    for (const entry of ownersData || []) {
      const key = entry.market_nftji_key;
      const wallet = String(entry.wallet || '').toLowerCase();
      if (!key || !wallet) continue;
      if (!ownerWalletsByKey.has(key)) ownerWalletsByKey.set(key, []);
      ownerWalletsByKey.get(key).push(wallet);
    }

    const penaltiesByCommandId = new Map();
    const penaltiesByKey = new Map();
    for (const penalty of penaltiesData || []) {
      const wallet = String(penalty.wallet || '').toLowerCase();
      if (!wallet) continue;
      if (penalty.command_id) {
        if (!penaltiesByCommandId.has(penalty.command_id)) penaltiesByCommandId.set(penalty.command_id, []);
        penaltiesByCommandId.get(penalty.command_id).push(wallet);
      }
      if (penalty.nftji_key) {
        if (!penaltiesByKey.has(penalty.nftji_key)) penaltiesByKey.set(penalty.nftji_key, []);
        penaltiesByKey.get(penalty.nftji_key).push(wallet);
      }
    }

    const label = language === 'es'
      ? { active: 'activo', ready: 'listo', affected: 'afectadas', wallets: 'wallets', reset: 'reset' }
      : { active: 'active', ready: 'ready', affected: 'affected', wallets: 'wallets', reset: 'reset' };

    const activeLines = [];
    const activeKeys = new Set();
    for (const command of commandsData || []) {
      const key = command.nftji_key;
      if (!key) continue;
      activeKeys.add(key);
      const block = blockByKey.get(key);
      const fallback = commandEntryByKey.get(key);
      const emoji = block?.emoji || fallback?.emoji || '?';
      const hex = block ? getBlockHex(block.grid_row, block.grid_col) : key;
      const affectedWallets = penaltiesByCommandId.get(command.id) || penaltiesByKey.get(key) || [];
      const affected = affectedWallets.map(shortenMarketWallet).join(' · ') || '0';
      activeLines.push(
        `Market: ${label.active} // ${emoji} ${hex} // ${t('irc.by')} ${shortenMarketWallet(command.wallet)} // ${label.affected}: ${affected} // ${label.reset} ${formatClockTime(command.reset_at)}`
      );
    }

    if (activeLines.length > 0) return activeLines;

    const readyLines = [];
    for (const entry of commandEntries) {
      if (activeKeys.has(entry.key)) continue;
      const ownerWallets = ownerWalletsByKey.get(entry.key) || [];
      if (ownerWallets.length === 0) continue;
      const block = blockByKey.get(entry.key);
      const hex = block ? getBlockHex(block.grid_row, block.grid_col) : entry.key;
      const readyWallets = ownerWallets.map(shortenMarketWallet).join(' · ');
      readyLines.push(`Market: ${label.ready} // ${entry.emoji} ${hex} // ${label.wallets}: ${readyWallets}`);
    }

    return readyLines.length > 0 ? readyLines : [`Market: ${t('irc.marketNoPenalties')}`];
  }, [language, t]);

  // Derive stable anon ID from external IP (client-only, no DB, cached in sessionStorage)
  useEffect(() => {
    if (normalizedWallet || typeof window === 'undefined') return;
    const META_KEY = 'mm3-anon-meta';
    try {
      const cached = JSON.parse(sessionStorage.getItem(META_KEY) || '{}');
      if (cached.id?.startsWith('anon:') && cached.flag) {
        setAnonId(cached.id);
        setAnonFlag(cached.flag);
        sessionStorage.setItem('mm3-anon-session', cached.id);
        return;
      }
    } catch {}
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);
    fetch('https://ipapi.co/json/', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        const ip = String(data.ip || '');
        const cc = String(data.country_code || '');
        const id = ip ? hashIpToId(ip) : anonId;
        const flag = cc.length === 2 ? cc.toUpperCase() : '';
        setAnonId(id);
        setAnonFlag(flag);
        sessionStorage.setItem('mm3-anon-session', id);
        sessionStorage.setItem(META_KEY, JSON.stringify({ id, flag }));
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
  }, [normalizedWallet]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect country flag for wallet users (client-only, cached in sessionStorage)
  useEffect(() => {
    if (!normalizedWallet || typeof window === 'undefined') return;
    const cacheKey = `mm3-wallet-flag:${normalizedWallet}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) { setWalletFlag(cached); return; }
    } catch {}
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);
    fetch('https://ipapi.co/json/', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        const cc = String(data.country_code || '');
        const flag = cc.length === 2 ? cc.toUpperCase() : '';
        setWalletFlag(flag);
        try { sessionStorage.setItem(cacheKey, flag); } catch {}
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
  }, [normalizedWallet]);

  // Wallet-flags Presence channel — all users subscribe (read); wallet users also track
  useEffect(() => {
    const channel = supabase.channel('mm3-irc-wallet-flags');
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const flags = {};
        for (const entries of Object.values(state)) {
          for (const u of entries) {
            const w = String(u.wallet || '').toLowerCase();
            const cc = String(u.flag || '');
            if (w && cc.length === 2) flags[w] = cc;
          }
        }
        setWalletFlags(flags);
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || !normalizedWallet || !walletFlag) return;
        await channel.track({ wallet: normalizedWallet, flag: walletFlag }).catch(() => {});
      });
    return () => { supabase.removeChannel(channel); setWalletFlags({}); };
  }, [normalizedWallet, walletFlag]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!normalizedWallet) {
      presenceBootedRef.current = false;
      previousPresenceRef.current = new Set();
    }
  }, [normalizedWallet]);

  useEffect(() => {
    if (typeof window === 'undefined' || !storageKey) return;
    let cancelled = false;

    const loadWelcome = async () => {
      let welcomeText = t('irc.welcomeFallback');
      const marketMessages = [];
      let chatHistory = [];

      try {
        const nowIso = new Date().toISOString();
        // Separate queries: if macro or owners fail, we still want the chat history
        const [ircRes, macroRes, ownersRes, commandsRes, blocksRes, penaltiesRes] = await Promise.all([
          supabase
            .from('mm3_irc_messages')
            .select('wallet, text, ts, kind, tone')
            .order('ts', { ascending: false })
            .limit(MAX_CHAT_HISTORY),
          supabase
            .from('mm3_macro_state')
            .select('ticker_message, ticker_message_en, ticker_message_es')
            .eq('id', 1)
            .maybeSingle(),
          supabase
            .from('player_progress')
            .select('wallet, market_nftji_key')
            .not('market_nftji_key', 'is', null),
          supabase
            .from('mm3_market_commands')
            .select('id, nftji_key, formula_x, reset_at, wallet')
            .gt('reset_at', nowIso),
          supabase
            .from('mm3_market_blocks')
            .select('block_key, emoji, grid_row, grid_col, title_en, title_es, price_eur, market_command, is_active'),
          supabase
            .from('mm3_command_penalties')
            .select('command_id, nftji_key, wallet')
            .is('redeemed_at', null)
            .gt('reset_at', nowIso),
        ]);

        const dbMessages = ircRes.data || [];
        chatHistory = Array.isArray(dbMessages) ? [...dbMessages].reverse() : [];

        const { data } = macroRes;
        const { data: ownersData } = ownersRes;
        const { data: commandsData } = commandsRes;
        const { data: blocksData } = blocksRes;
        const { data: penaltiesData } = penaltiesRes;

        welcomeText = tickerFromRow(data, language, welcomeText);
        marketMessages.push(...buildMarketStatusLines({ ownersData, commandsData, blocksData, penaltiesData }));

        const stored = safeParseSession(sessionStorage.getItem(storageKey));
        const withoutWelcome = stored.filter((entry) =>
          !(entry.kind === 'system' && (entry.tone === 'accent' || String(entry.id || '').startsWith('market-status:') || String(entry.id || '').startsWith('relay-status:')))
        );

        // Combine history from DB and session storage, then deduplicate by content signature
        const normTs = (raw) => isNaN(Number(raw)) ? new Date(raw).getTime() : Number(raw);
        const dbMapped = chatHistory.map((m) => makeMessage({
          id: `db:${m.wallet}:${m.ts}`,
          kind: m.kind || 'chat',
          wallet: m.wallet,
          text: m.text,
          ts: normTs(m.ts),
          tone: m.tone || 'neutral',
        }));

        const combined = [...dbMapped, ...withoutWelcome];
        const seenSig = new Set();
        const uniqueMessages = [];

        for (const m of combined) {
          const sig = `${m.wallet}:${m.ts}:${m.text}`;
          if (!seenSig.has(sig)) {
            seenSig.add(sig);
            uniqueMessages.push(m);
          }
        }

        // Ensure strict chronological order across sources
        uniqueMessages.sort((a, b) => a.ts - b.ts);

        // Use functional update to merge with messages received via broadcast during the await
        setMessages((current) => {
          const currentChat = current.filter(m => m.kind === 'chat');
          const combinedPool = [...uniqueMessages, ...currentChat];
          const finalSeen = new Set();
          const finalUnique = [];

          for (const m of combinedPool) {
            const sig = `${m.wallet}:${m.ts}:${m.text}`;
            if (!finalSeen.has(sig)) {
              finalSeen.add(sig);
              finalUnique.push(m);
            }
          }
          finalUnique.sort((a, b) => a.ts - b.ts);

          const seeded = [
            makeMessage({
              id: `welcome:${actorId}`,
              kind: 'system',
              wallet: 'system',
              text: welcomeText,
              tone: 'accent',
            }),
            ...marketMessages.map((text, i) => makeMessage({
              id: `market-status:${i}:${actorId}`,
              kind: 'system',
              wallet: 'system',
              text,
              tone: 'market',
            })),
            ...finalUnique,
          ].slice(-MAX_SESSION_MESSAGES);

          if (cancelled) return current;
          persistMessages(seeded);
          return seeded;
        });
      } catch (err) {
        console.error('IRC initialization failed:', err);
      }
    };

    loadWelcome();
    return () => {
      cancelled = true;
    };
  }, [language, actorId, persistMessages, storageKey, t, buildMarketStatusLines]);

  useEffect(() => {
    const relay = supabase
      .channel('mm3-irc-relay', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        const text = normalizeRelayMessage(payload?.text);
        const wallet = String(payload?.wallet || '').toLowerCase();
        if (!text || !wallet) return;
        appendMessage(
          makeMessage({
            id: payload?.id || `relay:${wallet}:${payload?.ts || Date.now()}`,
            kind: payload?.kind === 'system' ? 'system' : 'chat',
            wallet,
            text,
            ts: payload?.ts || Date.now(),
            tone: payload?.tone || 'neutral',
          }),
          { silent: false }
        );
      })
      .subscribe((status) => {
        setRelayReady(status === 'SUBSCRIBED');
      });

    relayRef.current = relay;
    return () => {
      setRelayReady(false);
      relayRef.current = null;
      supabase.removeChannel(relay);
    };
  }, [appendMessage]);

  // Register anon presence via shared context channel
  useEffect(() => {
    if (channelStatus !== 'SUBSCRIBED') return;
    if (normalizedWallet || !anonId.startsWith('anon:')) return;
    trackAnon(anonId, anonFlag);
    return () => { untrackAnon(); };
  }, [channelStatus, anonId, anonFlag, normalizedWallet, trackAnon, untrackAnon]);

  const loadMarketClaims = useCallback(async () => {
    try {
      const [{ data: ownersData, error }, { data: blocksData }] = await Promise.all([
        supabase
          .from('player_progress')
          .select('wallet, market_nftji_key')
          .not('market_nftji_key', 'is', null),
        supabase
          .from('mm3_market_blocks')
          .select('block_key, emoji'),
      ]);
      if (error) throw error;

      const emojiByKey = new Map();
      for (const p of blocksData || []) {
        if (p.block_key && p.emoji) emojiByKey.set(p.block_key, p.emoji);
      }

      const nextClaims = {};
      for (const entry of ownersData || []) {
        const wallet = String(entry.wallet || '').toLowerCase();
        const key = entry.market_nftji_key;
        const emoji = emojiByKey.get(key);
        if (!wallet || !emoji) continue;
        nextClaims[wallet] = [emoji];
      }
      setMarketClaimsByWallet(nextClaims);
    } catch {
      setMarketClaimsByWallet({});
    }
  }, []);

  useEffect(() => {
    loadMarketClaims();
    const channel = supabase
      .channel('mm3-irc-market-claims')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_progress' }, loadMarketClaims)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMarketClaims]);

  const loadPresence = useCallback(async () => {
    try {
      const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
      const { data, error } = await supabase
        .from('mm3_wallet_presence')
        .select('wallet, source, last_seen')
        .gte('last_seen', since)
        .order('last_seen', { ascending: false });
      if (error) throw error;

      const uniqueWallets = [];
      const seen = new Set();
      for (const entry of data || []) {
        const wallet = String(entry.wallet || '').toLowerCase();
        if (!wallet || seen.has(wallet)) continue;
        seen.add(wallet);
        uniqueWallets.push({
          wallet,
          source: entry.source || 'wallet',
          lastSeen: entry.last_seen || null,
        });
      }

      setConnectedWallets(uniqueWallets);

      const nextPresence = new Set(uniqueWallets.map((entry) => entry.wallet));
      const previousPresence = previousPresenceRef.current;
      if (presenceBootedRef.current) {
        nextPresence.forEach((wallet) => {
          if (!previousPresence.has(wallet) && wallet !== actorId && !wallet.startsWith('anon:')) {
            appendMessage(
              makeMessage({
                id: `join:${wallet}:${Date.now()}`,
                kind: 'system',
                wallet: 'system',
                text: `${wallet} ${t('irc.joined')}`,
                tone: 'join',
              }),
              { silent: false }
            );
          }
        });

        previousPresence.forEach((wallet) => {
          if (!nextPresence.has(wallet) && wallet !== actorId && !wallet.startsWith('anon:')) {
            appendMessage(
              makeMessage({
                id: `leave:${wallet}:${Date.now()}`,
                kind: 'system',
                wallet: 'system',
                text: `${wallet} ${t('irc.left')}`,
                tone: 'leave',
              }),
              { silent: false }
            );
          }
        });
      }

      previousPresenceRef.current = nextPresence;
      presenceBootedRef.current = true;
    } catch {
      setConnectedWallets([]);
    }
  }, [appendMessage, actorId, t]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    loadPresence();
    const timer = setInterval(loadPresence, 10_000);
    const channel = supabase
      .channel('mm3-irc-presence-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_wallet_presence' }, loadPresence)
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [loadPresence]);

  useEffect(() => {
    const load = async () => {
      try {
        const { count } = await supabase
          .from('player_progress')
          .select('wallet', { count: 'exact', head: true });
        if (count != null) setTotalWallets(count);
      } catch {}
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const shortW = (w) => `${String(w).slice(0, 6)}...${String(w).slice(-4)}`;

    const build = () => {
      const walletParts = connectedWallets.map((u) => shortW(u.wallet));
      const n = walletParts.length;
      const walletLabel = t('irc.wallets');
      const text = n === 0
        ? t('irc.mainframeQuiet')
        : t('irc.mainframeNodes').replace('{count}', n).replace('{walletLabel}', walletLabel) + walletParts.join(' · ');

      upsertMessage(makeMessage({
        id: `relay-status:${Date.now()}`,
        kind: 'system',
        wallet: 'system',
        text,
        ts: Date.now(),
        tone: 'ghost',
      }));
    };

    build();
    const timer = setInterval(build, 60_000);
    return () => clearInterval(timer);
  }, [connectedWallets, language, t, upsertMessage]);

  // Generate all current market status messages
  const generateMarketStatusMessages = useCallback(async (actorIdForId) => {
    const marketMessages = [];
    try {
      const nowIso = new Date().toISOString();
      const [{ data: ownersData }, { data: commandsData }, { data: blocksData }, { data: penaltiesData }] = await Promise.all([
        supabase
          .from('player_progress')
          .select('wallet, market_nftji_key')
          .not('market_nftji_key', 'is', null),
          supabase
            .from('mm3_market_commands')
            .select('id, nftji_key, formula_x, reset_at, wallet')
            .gt('reset_at', nowIso),
        supabase
          .from('mm3_market_blocks')
          .select('block_key, emoji, grid_row, grid_col, title_en, title_es, price_eur, market_command, is_active'),
        supabase
          .from('mm3_command_penalties')
          .select('command_id, nftji_key, wallet')
          .is('redeemed_at', null)
          .gt('reset_at', nowIso),
      ]);
      marketMessages.push(...buildMarketStatusLines({ ownersData, commandsData, blocksData, penaltiesData }));
    } catch {}

    return marketMessages.map((text, i) => makeMessage({
      id: `market-status:${i}:${actorIdForId}`,
      kind: 'system',
      wallet: 'system',
      text,
      ts: Date.now(),
      tone: 'market',
    }));
  }, [buildMarketStatusLines]);

  // Update market status messages with current state (keeps all user messages intact)
  const refreshMarketStatus = useCallback(async () => {
    const newMarketMessages = await generateMarketStatusMessages(actorId);
    if (newMarketMessages.length > 0) {
      setMessages((current) => {
        // Keep all existing messages (user chat, system events, etc.)
        const existing = current;
        // Remove old market-status messages
        const withoutMarket = existing.filter((m) => !String(m.id).startsWith('market-status:'));
        // Add new market status (goes at the end where welcome was)
        const allMessages = [...withoutMarket, ...newMarketMessages];
        // Only truncate at MAX_SESSION_MESSAGES if we have too many
        return allMessages.length > MAX_SESSION_MESSAGES
          ? allMessages.slice(-MAX_SESSION_MESSAGES)
          : allMessages;
      });
    }
  }, [generateMarketStatusMessages, actorId]);

  // Refresh market status periodically (like relay-status mainframe)
  useEffect(() => {
    refreshMarketStatus();
    const timer = setInterval(refreshMarketStatus, 15_000);
    return () => clearInterval(timer);
  }, [refreshMarketStatus]);

  useEffect(() => {
    const resolveBlock = (nftjiKey) => {
      const block = blockByKeyRef.current.get(nftjiKey);
      const fallback = marketCommandFromBlock(block);
      return {
        emoji: block?.emoji || fallback?.emoji || '?',
        hex: block ? getBlockHex(block.grid_row, block.grid_col) : nftjiKey,
        command: block?.market_command || fallback?.command || '?',
      };
    };
    const resolveBlockByEmoji = (emoji) => {
      const block = [...blockByKeyRef.current.values()].find((entry) => String(entry.emoji || '') === String(emoji || ''));
      return {
        emoji: block?.emoji || emoji || '?',
        hex: block ? getBlockHex(block.grid_row, block.grid_col) : '',
      };
    };
    const traceLabel = language === 'es'
      ? { exec: 'exec', affected: 'afectadas', buy: 'compra', resell: 'reventa', codeOk: 'código ok', reset: 'penalización reset' }
      : { exec: 'exec', affected: 'affected', buy: 'buy', resell: 'resell', codeOk: 'code ok', reset: 'penalty reset' };

    let pendingTimeouts = [];
    const scheduleTimeout = (fn, delay) => {
      const id = setTimeout(fn, delay);
      pendingTimeouts.push(id);
      return id;
    };

    const channel = supabase
      .channel('mm3-irc-market-commands-watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mm3_market_commands' }, ({ new: rec }) => {
        const { emoji, hex } = resolveBlock(rec.nftji_key);
        const reset = formatClockTime(rec.reset_at);
        scheduleTimeout(async () => {
          try {
            const { data: penaltyRows } = await supabase
              .from('mm3_command_penalties')
              .select('wallet')
              .eq('command_id', rec.id);
            const affected = (penaltyRows || []).map((row) => shortenMarketWallet(row.wallet)).join(' · ') || '0';
            appendMessage(makeMessage({
              id: `market-event:on:${rec.id}`,
              kind: 'system',
              wallet: 'system',
              text: `Market: ${traceLabel.exec} // ${emoji} ${hex} // ${t('irc.by')} ${shortenMarketWallet(rec.wallet)} // ${traceLabel.affected}: ${affected} // reset ${reset}`,
              ts: Date.now(),
              tone: 'market',
            }), { silent: false });
          } catch {}
          refreshMarketStatus();
        }, 3000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mm3_market_commands' }, async ({ new: rec }) => {
        if (new Date(rec.reset_at) > new Date()) return;
        const { emoji, hex } = resolveBlock(rec.nftji_key);
        let releasedInfo = '0';
        try {
          const { data: penaltyRows } = await supabase
            .from('mm3_command_penalties')
            .select('wallet')
            .eq('command_id', rec.id);
          const count = (penaltyRows || []).length;
          releasedInfo = String(count);
        } catch {}
        const expiredPayload = {
          id: `market-event:off:${rec.id}`,
          kind: 'system',
          wallet: 'system',
          text: `Market: ${traceLabel.reset} // ${emoji} ${hex} // ${releasedInfo} ${t('irc.walletsReleased')}`,
          ts: Date.now(),
          tone: 'market',
        };
        appendMessage(makeMessage(expiredPayload), { silent: false });
        relayRef.current?.send({ type: 'broadcast', event: 'message', payload: expiredPayload }).catch(() => {});
        // After detail trace, refresh grouped market status for all users
        scheduleTimeout(() => refreshMarketStatus(), 500);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mm3_market_events' }, ({ new: rec }) => {
        if (!['market_buy', 'market_resell'].includes(rec?.event_type)) return;
        const { emoji, hex } = resolveBlockByEmoji(rec.emoji);
        const action = rec.event_type === 'market_buy' ? traceLabel.buy : traceLabel.resell;
        appendMessage(makeMessage({
          id: `market-event:${rec.event_type}:${rec.id || rec.created_at || Date.now()}`,
          kind: 'system',
          wallet: 'system',
          text: `Market: ${action} // ${emoji}${hex ? ` ${hex}` : ''} // ${shortenMarketWallet(rec.wallet)}`,
          ts: Date.now(),
          tone: 'market',
        }), { silent: false });
        scheduleTimeout(() => refreshMarketStatus(), 500);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mm3_command_penalties' }, ({ new: rec }) => {
        if (!rec?.redeemed_at || !rec?.attempted_at) return;
        const { emoji, hex } = resolveBlock(rec.nftji_key);
        appendMessage(makeMessage({
          id: `market-code-ok:${rec.id}:${rec.redeemed_at}`,
          kind: 'system',
          wallet: 'system',
          text: `Market: ${traceLabel.codeOk} // ${emoji} ${hex} // ${shortenMarketWallet(rec.wallet)} // ${traceLabel.reset}`,
          ts: Date.now(),
          tone: 'market',
        }), { silent: false });
        scheduleTimeout(() => refreshMarketStatus(), 500);
      })
      .subscribe();

    return () => {
      pendingTimeouts.forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [appendMessage, refreshMarketStatus, supabase, language, t]);

  useEffect(() => {
    if (typeof window === 'undefined' || !normalizedWallet) return;
    const query = new URLSearchParams(window.location.search);
    const command = query.get('command');
    if (command) setDraft(command);
  }, [normalizedWallet]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const broadcastSystemMessage = useCallback(async (text, tone = 'accent') => {
    const payload = {
      id: `system:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      kind: 'system',
      wallet: 'system',
      text: normalizeRelayMessage(text),
      ts: Date.now(),
      tone,
    };
    appendMessage(makeMessage(payload), { silent: false });
    try {
      await relayRef.current?.send({
        type: 'broadcast',
        event: 'message',
        payload,
      });
    } catch {}
  }, [appendMessage]);

  const loadMarketCommandEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('mm3_market_blocks')
      .select('block_key, emoji, grid_row, grid_col, title_en, title_es, price_eur, market_command, is_active')
      .not('market_command', 'is', null);
    if (error) throw error;
    return (data || [])
      .map(marketCommandFromBlock)
      .filter(Boolean);
  }, []);

  const findMarketCommandInDb = useCallback(async (text) => {
    const normalized = normalizeCommandText(text);
    const entries = await loadMarketCommandEntries();
    return entries.find((entry) => normalizeCommandText(entry.command) === normalized) || null;
  }, [loadMarketCommandEntries]);

  const showMarketCommandHelp = useCallback(async () => {
    try {
      const entries = await loadMarketCommandEntries();
      const helpLines = [
        `// cmd index :: ${entries.length} Market commands loaded from DB :: money rail ·· MM3 rail ·· hidden signals stay private`,
        ...entries.map((entry) => {
          const block = blockByKeyRef.current.get(entry.key);
          const row = block?.grid_row ?? entry.grid_row;
          const col = block?.grid_col ?? entry.grid_col;
          const hex = row !== undefined && col !== undefined ? getBlockHex(row, col) : entry.key;
          const rail = entry.effect === 'mm3' ? 'MM3' : 'money';
          return `// ${entry.emoji} ${hex} :: ${entry.command} :: effect=-${rail} :: numeric_code=market challenge`;
        }),
      ];
      helpLines.forEach((line, index) => {
        appendMessage(makeMessage({
          id: `sys:help:${Date.now()}:${index}`,
          kind: 'system',
          wallet: 'system',
          ts: Date.now() + index,
          tone: 'accent',
          text: line,
        }), { silent: true });
      });
    } catch (err) {
      appendMessage(makeMessage({
        id: `sys:help:${Date.now()}`,
        kind: 'system',
        wallet: 'system',
        ts: Date.now(),
        tone: 'leave',
        text: `// cmd index unavailable :: ${err?.message || 'market DB offline'}`,
      }), { silent: true });
    }
  }, [appendMessage, loadMarketCommandEntries]);

  const processMarketCommand = useCallback(async (text) => {
    const commandEntry = await findMarketCommandInDb(text);
    if (!commandEntry || !normalizedWallet) return false;

    const now = new Date();
    const nowIso = now.toISOString();
    const dayWindow = getUtcDayWindow(now);

    try {
      const [{ data: launcher }, { data: existingCommand }, { data: blockRow }] = await Promise.all([
        supabase
          .from('player_progress')
          .select('wallet, market_nftji_key, mm3_sold')
          .eq('wallet', normalizedWallet)
          .maybeSingle(),
        supabase
          .from('mm3_market_commands')
          .select('id, wallet, reset_at')
          .eq('nftji_key', commandEntry.key)
          .gt('reset_at', nowIso)
          .order('executed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('mm3_market_blocks')
          .select('block_key, emoji, grid_row, grid_col, title_en, title_es, price_eur, market_command')
          .eq('block_key', commandEntry.key)
          .maybeSingle(),
      ]);

      if (launcher?.market_nftji_key !== commandEntry.key) {
        const hex = blockRow ? getBlockHex(blockRow.grid_row, blockRow.grid_col) : commandEntry.key;
        const emoji = blockRow?.emoji || commandEntry.emoji;
        await broadcastSystemMessage(`${t('irc.commandRejected')} // ${normalizedWallet} ${t('irc.doesNotOwn')} ${hex}${emoji}`, 'leave');
        return true;
      }

      if (existingCommand) {
        const reset = formatClockTime(existingCommand.reset_at);
        await broadcastSystemMessage(`${commandEntry.emoji} ${t('podcast.launchLocked')} ${reset} local`, 'leave');
        return true;
      }

      if (!blockRow) {
        await broadcastSystemMessage(`${t('irc.commandRejected')} // ${t('irc.noBlock')} ${commandEntry.key}`, 'leave');
        return true;
      }

      const { x, code } = computeMarketCommandCode(commandEntry, normalizedWallet, dayWindow.dayKey, now.getTime());
      const { data: insertedCommand, error: commandError } = await supabase
        .from('mm3_market_commands')
        .insert({
          wallet: normalizedWallet,
          nftji_key: commandEntry.key,
          command: commandEntry.command,
          numeric_code: code,
          formula_x: x,
          reset_at: dayWindow.resetAt,
        })
        .select('id')
        .single();
      if (commandError) throw commandError;

      const { data: allProgress, error: progressError } = await supabase
        .from('player_progress')
        .select('wallet, level, market_nftji_key, eur_earned, usd_earned, cny_earned, mm3_sold')
        .limit(1000);
      if (progressError) throw new Error(`allProgress: ${progressError.message}`);

      const priceEur = Number(blockRow.price_eur) || 0;
      const priceUsd = priceEur * (CNY_TO_USD / CNY_TO_EUR);
      const priceCny = priceEur / CNY_TO_EUR;
      const isMm3Command = commandEntry.effect === 'mm3';
      const penalties = [];
      const balanceUpdates = [];

      for (const row of allProgress || []) {
        const wallet = String(row.wallet || '').toLowerCase();
        if (!wallet || wallet === normalizedWallet) continue;
        if (row.market_nftji_key === commandEntry.key) continue;
        if (isMm3Command) {
          const soldMm3 = Number(row.mm3_sold) || 0;
          penalties.push({
            wallet,
            command_id: insertedCommand?.id || null,
            nftji_key: commandEntry.key,
            penalty_code: code,
            penalty_value: priceEur,
            penalty_eur: 0,
            penalty_effect: 'mm3',
            reason: `${blockRow.emoji || commandEntry.emoji} ${blockRow.title_en || commandEntry.key}`,
            reset_at: dayWindow.resetAt,
          });
          balanceUpdates.push({
            wallet,
            mm3_sold: soldMm3 + priceEur,
            updated_at: new Date().toISOString(),
          });
        } else {
          const rateCny = getSellRateCny(Number(row.level) || 0);
          const penaltyMm3 = rateCny > 0 ? priceEur / (rateCny * CNY_TO_EUR) : 0;
          penalties.push({
            wallet,
            command_id: insertedCommand?.id || null,
            nftji_key: commandEntry.key,
            penalty_code: code,
            penalty_value: penaltyMm3,
            penalty_eur: priceEur,
            penalty_effect: 'money',
            reason: `${blockRow.emoji || commandEntry.emoji} ${blockRow.title_en || commandEntry.key}`,
            reset_at: dayWindow.resetAt,
          });
          balanceUpdates.push({
            wallet,
            eur_earned: (Number(row.eur_earned) || 0) - priceEur,
            usd_earned: (Number(row.usd_earned) || 0) - priceUsd,
            cny_earned: (Number(row.cny_earned) || 0) - priceCny,
            updated_at: new Date().toISOString(),
          });
        }
      }

      if (penalties.length > 0) {
        const { error: penaltyError } = await supabase
          .from('mm3_command_penalties')
          .insert(penalties);
        if (penaltyError) throw penaltyError;

        const { error: balanceError } = await supabase
          .from('player_progress')
          .upsert(balanceUpdates, { onConflict: 'wallet', ignoreDuplicates: false });
        if (balanceError) throw balanceError;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_dirty_at', String(Date.now()));
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet: normalizedWallet, marketCommand: true } }));
      }

      await broadcastSystemMessage(
        `${blockRow.emoji || commandEntry.emoji} ${t('podcast.launchSuccess')} // cmd=${commandEntry.command} // nonce=${x} // ${penalties.length} ${t('podcast.walletsPenalized')} // reset ${formatClockTime(dayWindow.resetAt)} local`,
        'accent'
      );
      return true;
    } catch (err) {
      console.error('market command:', err);
      await broadcastSystemMessage(`${t('podcast.commandFailed')} // ${err?.message || 'market daemon non-zero'}`, 'leave');
      return true;
    }
  }, [broadcastSystemMessage, findMarketCommandInDb, normalizedWallet, t]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!normalizedWallet) return;
    const text = normalizeRelayMessage(draft);
    if (!text) return;
    setDraft('');

    // ── Command routing: lines starting with / ──
    if (text.startsWith('/')) {
      const afterSlash = text.slice(1).trim();
      const cmdName = afterSlash.split(/\s/)[0].toLowerCase();

      // /? — local command index (not broadcast)
      if (afterSlash === '?' || cmdName === 'help') {
        await showMarketCommandHelp();
        return;
      }

      // Public Market commands are loaded from DB and can use any slash name.
      if (await processMarketCommand(text)) {
        return;
      }

      // Try hidden command (DB-validated, not in source)
      try {
        const res = await fetch('/api/exec-hidden-cmd', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: normalizedWallet, command: text }),
        });
        if (res.status !== 404) {
          const data = await res.json().catch(() => ({}));
          if (data.ok) {
            const trace = language === 'es' ? data.trace_es : data.trace_en;
            await broadcastSystemMessage(trace, 'accent');
            try {
              await supabase.from('mm3_irc_messages').insert({
                wallet: 'system', text: trace, ts: Date.now(), kind: 'system', tone: 'accent',
              });
            } catch {}
            if (typeof window !== 'undefined') {
              localStorage.setItem('lb_dirty_at', String(Date.now()));
              window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet: normalizedWallet } }));
            }
          } else {
            const errorMsg = language === 'es'
              ? ({
                  level_too_low: `// acceso denegado :: nivel insuficiente para /${cmdName}`,
                  command_not_active: '// acceso denegado :: comando Market público no activo hoy para este bloque',
                  already_executed_today: '// acceso denegado :: cuota diaria del comando agotada',
                }[data.error] || `// acceso denegado :: /${cmdName} rechazado`)
              : ({
                  level_too_low: `// access denied :: level insufficient for /${cmdName}`,
                  command_not_active: '// access denied :: public Market command not active for this block today',
                  already_executed_today: '// access denied :: command quota exhausted for today',
                }[data.error] || `// access denied :: /${cmdName} rejected`);
            appendMessage(makeMessage({
              id: `sys:err:${Date.now()}`,
              kind: 'system', wallet: 'system', ts: Date.now(), tone: 'leave',
              text: errorMsg,
            }), { silent: true });
          }
          return;
        }
      } catch {}

      // Unknown command — local error only
      appendMessage(makeMessage({
        id: `sys:err:${Date.now()}`,
        kind: 'system', wallet: 'system', ts: Date.now(), tone: 'leave',
        text: `// bash: /${cmdName}: command not found ·· type /? to dump available commands`,
      }), { silent: true });
      return;
    }

    // ── Regular chat message ──
    const now = Date.now();
    const payload = {
      id: `msg:${normalizedWallet}:${now}:${Math.random().toString(36).slice(2, 7)}`,
      wallet: normalizedWallet,
      text,
      ts: now,
    };

    appendMessage(makeMessage(payload), { silent: false });

    try {
      await supabase.from('mm3_irc_messages').insert({
        wallet: normalizedWallet,
        text,
        ts: payload.ts,
        kind: 'chat',
        tone: 'neutral',
      });
    } catch {}

    try {
      await relayRef.current?.send({
        type: 'broadcast',
        event: 'message',
        payload,
      });
    } catch {}
  };

  return (
    <div className="mm3-irc-root">
      <style>{`
        .mm3-irc-root {
          --irc-accent: ${accent};
        }
        .mm3-irc-shell {
          display: grid;
          gap: 0.55rem;
          grid-template-columns: minmax(0, 1fr);
        }
        @media (min-width: 900px) {
          .mm3-irc-shell {
            grid-template-columns: minmax(0, 1fr) 12.6rem;
          }
        }
        /* ── Mobile: compact aside above chat, flex layout ── */
        @media (max-width: 899px) {
          /* Shell becomes a flex column bounded by the small viewport */
          .mm3-irc-shell {
            display: flex;
            flex-direction: column;
            gap: 0.45rem;
            max-height: calc(100svh - 15.5rem);
          }
        }
        @media (max-width: 899px) and (orientation: portrait) {
          .mm3-irc-shell {
            max-height: calc(100svh - 17rem);
          }
          /* Aside: shrink to content, floated above chat */
          .mm3-irc-shell > aside {
            order: -1;
            flex: 0 0 auto;
            padding: 0.4rem 0.6rem;
          }
          .mm3-irc-aside-inner {
            max-height: 4rem;
            overflow-y: auto;
          }
          /* Chat section: grows to fill remaining height */
          .mm3-irc-shell > section {
            flex: 1 1 0;
            min-height: 0;
            display: flex;
            flex-direction: column;
            padding: 0.5rem 0.65rem;
          }
          /* Section header and form: fixed size */
          .mm3-irc-shell > section > div:first-child,
          .mm3-irc-shell > section > form,
          .mm3-irc-shell > section > div:last-child {
            flex: 0 0 auto;
          }
          /* Remove border-b from channel header row on mobile — avoids strikethrough appearance */
          .mm3-irc-header-row {
            border-bottom: none !important;
            padding-bottom: 0.4rem;
          }
          /* Chat log: takes all leftover space inside section */
          .mm3-irc-chat-log {
            flex: 1 1 0;
            min-height: 0;
            max-height: none;
          }
          .mm3-irc-peer-row {
            padding-top: 0.08rem;
            padding-bottom: 0.08rem;
            font-size: 0.60rem;
          }
          .mm3-irc-anon-label {
            margin-top: 0.15rem;
            font-size: 0.48rem;
          }
        }
        .mm3-irc-panel {
          border: 1px solid rgba(34, 211, 238, 0.16);
          background:
            linear-gradient(180deg, rgba(34, 211, 238, 0.05), transparent 28%),
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.95));
          box-shadow:
            inset 0 0 24px rgba(34, 211, 238, 0.05),
            0 0 18px rgba(34, 211, 238, 0.05);
        }
        .mm3-irc-chat-log {
          min-height: 18.5rem;
          max-height: 50dvh;
          overflow-y: auto;
          background:
            repeating-linear-gradient(
              0deg,
              rgba(255,255,255,0.015) 0,
              rgba(255,255,255,0.015) 1px,
              transparent 1px,
              transparent 3px
            ),
            rgba(0,0,0,0.72);
        }
        .mm3-irc-line {
          border-bottom: 1px solid rgba(34, 211, 238, 0.06);
        }
        .mm3-irc-line:last-child {
          border-bottom: none;
        }
        /* ── IRC fixed colour palette ── */
        .mm3-irc-line.system                       {
          color: var(--irc-accent, #22d3ee);
          text-shadow: 0 0 8px color-mix(in srgb, var(--irc-accent, #22d3ee) 18%, transparent);
        }
        .mm3-irc-line.system[data-tone]            { color: var(--irc-accent, #22d3ee); }
        .mm3-irc-line.system > span,
        .mm3-irc-line.system .mm3-irc-author       { color: inherit; }
        .mm3-irc-line.self   .mm3-irc-author       { color: #4ade80; }  /* self:   green  */
        .mm3-irc-line.other  .mm3-irc-author       { color: #e879f9; }  /* others: magenta */
        /* system text inherits line colour; chat text stays white */
        .mm3-irc-line.system .mm3-irc-msg-text     { color: inherit; }
        .mm3-irc-line.self   .mm3-irc-msg-text,
        .mm3-irc-line.other  .mm3-irc-msg-text     { color: #e2e8f0; }
        .mm3-irc-author { word-break: break-all; }
        .mm3-irc-wallet-line {
          display: flex;
          align-items: flex-start;
          gap: 0.3rem;
        }
        .mm3-irc-wallet-meta {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          min-width: 0;
          flex: 1;
        }
        .mm3-irc-wallet-emojis {
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.14rem;
          flex-shrink: 0;
        }
        .mm3-irc-wallet-emoji {
          font-size: 0.72rem;
          line-height: 1;
          filter: drop-shadow(0 0 6px rgba(34, 211, 238, 0.16));
        }
        .mm3-irc-peer-row {
          display: flex;
          align-items: center;
          gap: 0.28rem;
          padding: 0.18rem 0;
          border-bottom: 1px solid rgba(34, 211, 238, 0.05);
          font-size: 0.56rem;
          font-family: monospace;
          letter-spacing: 0.08em;
          line-height: 1.35;
          color: #94a3b8;
          min-width: 0;
        }
        .mm3-irc-peer-row:last-child { border-bottom: none; }
        .mm3-irc-peer-row.is-you { color: #4ade80; }
        .mm3-irc-peer-row.is-anon { color: #78716c; opacity: 0.7; }
        .mm3-irc-line.system[data-tone='ghost'] {
          font-style: italic;
        }
        .mm3-irc-anon-label {
          font-family: monospace;
          font-size: 0.42rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #78716c;
          opacity: 0.6;
          padding: 0.35rem 0 0.2rem;
          border-top: 1px solid rgba(120,113,108,0.15);
          margin-top: 0.5rem;
          line-height: 1.4;
        }
        .mm3-irc-peer-chevron {
          color: rgba(34, 211, 238, 0.45);
          flex-shrink: 0;
          font-size: 0.5rem;
        }
        .mm3-irc-peer-label {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mm3-irc-peer-src {
          flex-shrink: 0;
          opacity: 0.38;
          font-size: 0.48rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .mm3-irc-peer-emojis {
          flex-shrink: 0;
          font-size: 0.64rem;
          line-height: 1;
          letter-spacing: 0;
        }
        .mm3-irc-show-more {
          display: block;
          width: 100%;
          margin-top: 0.35rem;
          padding: 0.22rem 0;
          font-family: monospace;
          font-size: 0.5rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(34, 211, 238, 0.45);
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
        }
        .mm3-irc-show-more:hover { color: #22d3ee; }
        .mm3-irc-submit:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      `}</style>

      <div className="mm3-irc-shell">
        <section className="mm3-irc-panel rounded-sm p-2.5">
          <div className="mm3-irc-header-row max-sm:portrait:hidden mb-2 flex items-center justify-between gap-1 sm:border-b sm:border-cyan-500/12 pb-2 font-mono">
            <div className="shrink-0 text-[0.70rem] sm:text-[0.80rem] uppercase tracking-[0.16em] text-slate-500">#relay-mainframe</div>
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
              <span className={`shrink-0 text-[0.65rem] sm:text-[0.75rem] uppercase tracking-[0.16em] ${normalizedWallet ? 'text-cyan-700' : 'text-amber-700/70'}`}>
                {!normalizedWallet ? t('irc.readOnly') : (relayReady ? t('irc.live') : t('irc.syncing'))}
              </span>
              <span className={`truncate text-[0.72rem] sm:text-[0.82rem] ${normalizedWallet ? 'text-cyan-200' : 'text-slate-500'}`}>
                {formatIrcWalletLabel(actorId)}
              </span>
            </div>
          </div>

          <div className="mm3-irc-chat-log rounded-sm border border-cyan-500/12 px-2.5 py-1.5 font-mono">
            {messages.length > 0 ? messages.map((message) => {
              const isSelf = message.kind === 'chat' && message.wallet === normalizedWallet;
              const lineMode = message.kind === 'system' ? 'system' : isSelf ? 'self' : 'other';
              const ownedMarketEmojis = message.kind === 'chat' ? (marketClaimsByWallet[message.wallet] || []) : [];
              const author = message.kind === 'system'
                ? 'system'
                : formatChatAuthor(message.wallet, normalizedWallet, t('irc.you'));

              return (
                <div
                  key={message.id}
                  className={`mm3-irc-line ${lineMode} flex gap-3 px-1 py-2 text-[0.7rem]`}
                  data-tone={message.tone}
                >
                  <span className="shrink-0 pt-0.5 text-[0.76rem] uppercase tracking-[0.14em] text-slate-500">
                    {formatRelayTime(message.ts)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mm3-irc-wallet-line">
                      <div className="mm3-irc-wallet-meta">
                        {message.kind === 'chat' && (
                          <span className="inline-flex shrink-0 items-center gap-[0.16rem]">
                            <FlagImg cc={walletFlags[message.wallet]} style={{ height: '0.65rem' }} />
                            {ownedMarketEmojis.map((emoji, index) => (
                              <span key={`${message.wallet}-${emoji}-${index}`} className="mm3-irc-wallet-emoji">{emoji}</span>
                            ))}
                          </span>
                        )}
                        <div
                          className="mm3-irc-author flex-1 text-[0.80rem] uppercase tracking-[0.13em]"
                          style={message.kind === 'chat' ? { color: colorFromAddress(message.wallet) } : undefined}
                        >{author}</div>
                      </div>
                    </div>
                    <div className="mm3-irc-msg-text mt-0.5 break-words text-[0.95rem] leading-relaxed">{message.text}</div>
                  </div>
                </div>
              );
            }) : (
              <div className="px-1 py-2 text-[0.88rem] uppercase tracking-[0.14em] text-slate-500">
                {t('irc.empty')}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {normalizedWallet ? (
            <form onSubmit={handleSend} className="mt-2 flex gap-1.5">
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t('irc.inputPlaceholder')}
                className="min-w-0 flex-1 rounded-sm border border-cyan-500/15 bg-black/80 px-2.5 py-1.5 font-mono text-[0.95rem] text-cyan-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/45 focus:shadow-[0_0_18px_rgba(34,211,238,0.08)]"
                maxLength={280}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                className="mm3-irc-submit rounded-sm border border-cyan-500/35 px-3 py-1.5 font-mono text-[0.75rem] font-black uppercase tracking-[0.22em] text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100"
                disabled={!relayReady || !normalizeRelayMessage(draft)}
              >
                {t('irc.send')}
              </button>
            </form>
          ) : (
            <div className="mt-2 flex items-center gap-2 border border-amber-500/12 bg-amber-950/10 px-2.5 py-1.5 font-mono">
              <span className="text-amber-600/70 text-[0.5rem]">▶</span>
              <span className="text-[0.80rem] uppercase tracking-[0.2em] text-amber-700/60">{t('irc.readOnlyHint')}</span>
            </div>
          )}
        </section>

        <aside className="mm3-irc-panel rounded-sm p-2.5">
          <div className="border-b border-cyan-500/12 pb-1.5 font-mono">
            <div className="flex items-baseline justify-end gap-[3px] text-[0.75rem] font-black tabular-nums">
              <span className="text-emerald-400">{connectedWallets.length}</span>
              <span className="text-slate-600 text-[0.65rem]">/</span>
              <span className="text-slate-500">{totalWallets}</span>
              <span className="text-slate-600 text-[0.60rem]">wal</span>
              <span className="text-slate-700 mx-[1px]">·</span>
              <span className="text-cyan-700">{connectedWallets.length + anonUsers.length}</span>
              <span className="text-cyan-900 text-[0.60rem]">irc</span>
            </div>
          </div>

          <div className="mm3-irc-aside-inner mt-1.5">
            {connectedWallets.length > 0 ? (
              <>
                {connectedWallets.slice(0, visibleCount).map((entry) => {
                  const isYou = entry.wallet === actorId;
                  const isAnon = entry.source === 'anon' || entry.wallet.startsWith('anon:');
                  const label = isYou
                    ? `${formatIrcWalletLabel(entry.wallet)} (${t('irc.you')})`
                    : formatIrcWalletLabel(entry.wallet);
                  const emojis = isAnon ? [] : (marketClaimsByWallet[entry.wallet] || []);
                  const srcLabel = isAnon ? 'A' : (entry.source === 'google' ? 'G' : 'W');
                  const peerColor = isAnon ? undefined : colorFromAddress(entry.wallet);
                  return (
                    <div
                      key={entry.wallet}
                      className={`mm3-irc-peer-row${isAnon && !isYou ? ' is-anon' : ''}`}
                      style={peerColor ? { color: peerColor } : undefined}
                      title={isAnon ? t('irc.readOnly') : entry.wallet}
                    >
                      <span className="mm3-irc-peer-chevron">{isAnon ? '○' : '▶'}</span>
                      {!isAnon && <FlagImg cc={walletFlags[entry.wallet]} style={{ marginRight: '0.18rem' }} />}
                      <span className="mm3-irc-peer-label">{label}</span>
                      {emojis.length > 0 && (
                        <span className="mm3-irc-peer-emojis">{emojis.join('')}</span>
                      )}
                      <span className="mm3-irc-peer-src">{srcLabel}</span>
                    </div>
                  );
                })}
                {visibleCount < connectedWallets.length && (
                  <button
                    className="mm3-irc-show-more"
                    onClick={() => setVisibleCount((v) => v + 5)}
                  >
                    {`+ ${Math.min(5, connectedWallets.length - visibleCount)} ${t('irc.more')}`}
                  </button>
                )}
                {visibleCount > 5 && connectedWallets.length <= visibleCount && (
                  <button
                    className="mm3-irc-show-more"
                    onClick={() => setVisibleCount(5)}
                  >
                    ▲ {t('irc.collapse')}
                  </button>
                )}
              </>
            ) : (
              <div className="pt-1 font-mono text-[0.75rem] uppercase tracking-[0.16em] text-slate-600">
                {t('irc.empty')}
              </div>
            )}
            {anonUsers.length > 0 && (
              <>
                <div className="mm3-irc-anon-label">{t('irc.anonSectLabel')}</div>
                {anonUsers.slice(0, anonVisibleCount).map((entry) => {
                  const isYou = entry.anonId === actorId;
                  return (
                    <div
                      key={entry.anonId}
                      className={`mm3-irc-peer-row is-anon${isYou ? ' is-you' : ''}`}
                      title={t('irc.readOnly')}
                    >
                      <span className="mm3-irc-peer-chevron">○</span>
                      <FlagImg cc={entry.flag} style={{ marginRight: '0.18rem' }} />
                      <span className="mm3-irc-peer-label">{entry.anonId}</span>
                      <span className="mm3-irc-peer-src">A</span>
                    </div>
                  );
                })}
                {anonVisibleCount < anonUsers.length && (
                  <button className="mm3-irc-show-more" onClick={() => setAnonVisibleCount((v) => v + 5)}>
                    {`+ ${Math.min(5, anonUsers.length - anonVisibleCount)} ${t('irc.more')}`}
                  </button>
                )}
                {anonVisibleCount > 5 && anonUsers.length <= anonVisibleCount && (
                  <button className="mm3-irc-show-more" onClick={() => setAnonVisibleCount(5)}>
                    ▲ {t('irc.collapse')}
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
