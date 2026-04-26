'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { useI18n } from '@/lib/i18n-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { useSound } from '@/lib/sound-context';
import { CNY_TO_EUR, CNY_TO_USD, getSellRateCny } from '@/lib/sell-offer';
import {
  MARKET_COMMANDS,
  computeMarketCommandCode,
  findMarketCommandByText,
  getUtcDayWindow,
} from '@/lib/market-commands';

const ACTIVE_WINDOW_MS = 90_000;
const MAX_SESSION_MESSAGES = 120;

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

function getCommandFormula(command) {
  const raw = String(command || '').trim();
  const parts = raw.split('=>');
  if (parts.length < 2) return raw;
  return parts[1].trim();
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
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
  const normalizedWallet = useMemo(() => String(account || '').toLowerCase(), [account]);
  const [anonId, setAnonId] = useState(() => {
    if (typeof window === 'undefined') return 'anon:000000';
    const k = 'mm3-anon-session';
    const stored = sessionStorage.getItem(k);
    if (stored?.startsWith('anon:')) return stored;
    const id = `anon:${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(k, id);
    return id;
  });
  const [anonFlag, setAnonFlag] = useState('');
  const [anonUsers, setAnonUsers] = useState([]);
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
  const [visibleCount, setVisibleCount] = useState(5);

  const relayRef = useRef(null);
  const previousWalletRef = useRef('');
  const previousPresenceRef = useRef(new Set());
  const presenceBootedRef = useRef(false);
  const endRef = useRef(null);
  const blockByKeyRef = useRef(new Map());

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
    const previousWallet = previousWalletRef.current;
    if (previousWallet && !previousWallet.startsWith('anon:') && previousWallet !== normalizedWallet) {
      sessionStorage.removeItem(sessionKeyForWallet(previousWallet));
    }
    previousWalletRef.current = normalizedWallet;
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
      try {
        const nowIso = new Date().toISOString();
        const [{ data }, { data: ownersData }, { data: commandsData }, { data: pixelsData }] = await Promise.all([
          supabase
            .from('mm3_macro_state')
            .select('ticker_message, ticker_message_en, ticker_message_es')
            .eq('id', 1)
            .maybeSingle(),
          supabase
            .from('player_progress')
            .select('wallet, market_nftmoji_key')
            .not('market_nftmoji_key', 'is', null),
          supabase
            .from('mm3_market_commands')
            .select('nftmoji_key, formula_x, reset_at, wallet')
            .gt('reset_at', nowIso),
          supabase
            .from('mm3_podcast_pixels')
            .select('pixel_key, emoji, grid_row, grid_col'),
        ]);
        welcomeText = tickerFromRow(data, language, welcomeText);

        const ownerCountByKey = new Map();
        for (const entry of ownersData || []) {
          const key = entry.market_nftmoji_key;
          if (!key) continue;
          ownerCountByKey.set(key, (ownerCountByKey.get(key) || 0) + 1);
        }
        const blockByKey = new Map((pixelsData || []).map((entry) => [entry.pixel_key, entry]));
        blockByKeyRef.current = blockByKey;
        const commandByKey = new Map();
        for (const entry of commandsData || []) {
          if (entry.nftmoji_key && entry.reset_at) commandByKey.set(entry.nftmoji_key, entry);
        }

        const shortWallet = (w) => w ? `${String(w).slice(0, 6)}...${String(w).slice(-4)}` : '';
        const ownedEntries = MARKET_COMMANDS.filter((entry) => (ownerCountByKey.get(entry.key) || 0) > 0);
        const ownedKeys = new Set(ownedEntries.map((e) => e.key));

        for (const entry of ownedEntries) {
          const command = commandByKey.get(entry.key);
          const owners = ownerCountByKey.get(entry.key) || 0;
          if (command) {
            const block = blockByKey.get(entry.key);
            const hex = block ? getBlockHex(block.grid_row, block.grid_col) : entry.key;
            const formula = getCommandFormula(entry.command);
            const reset = String(command.reset_at).slice(5, 16);
            const by = shortWallet(command.wallet);
            marketMessages.push(`Market: ${entry.emoji} ${hex} // active // formula=${formula} // x=${command.formula_x ?? 0} // reset=${reset}Z${by ? ` // by ${by}` : ''}`);
          } else {
            const ownerWallets = (ownersData || [])
              .filter((o) => o.market_nftmoji_key === entry.key)
              .map((o) => o.wallet)
              .filter(Boolean);
            const readyList = ownerWallets.map(shortWallet).join(' · ');
            marketMessages.push(`Market: ${entry.emoji} // ${t('podcast.launchReady')}${readyList ? ` // ready: ${readyList}` : ''}`);
            marketMessages.push(t('podcast.launchReadyTeaser'));
          }
        }

        for (const [key, command] of commandByKey.entries()) {
          if (ownedKeys.has(key)) continue;
          const fallback = MARKET_COMMANDS.find((e) => e.key === key);
          const block = blockByKey.get(key);
          const emoji = block?.emoji || fallback?.emoji || '?';
          const hex = block ? getBlockHex(block.grid_row, block.grid_col) : key;
          const formula = getCommandFormula(fallback?.command);
          const reset = String(command.reset_at || '').slice(5, 16);
          const by = shortWallet(command.wallet);
          marketMessages.push(`Market: ${emoji} ${hex} // active // formula=${formula} // x=${command.formula_x ?? 0} // reset=${reset}Z${by ? ` // by ${by}` : ''}`);
        }

        if (marketMessages.length === 0) {
          marketMessages.push(`Market: // no penalties active at this time :: all market commands on standby :: signal may spike without warning`);
        }
      } catch {}

      const stored = safeParseSession(sessionStorage.getItem(storageKey));
      const withoutWelcome = stored.filter((entry) =>
        !(entry.kind === 'system' && (entry.tone === 'accent' || String(entry.id || '').startsWith('market-status:') || String(entry.id || '').startsWith('relay-status:')))
      );
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
        ...withoutWelcome,
      ].slice(-MAX_SESSION_MESSAGES);

      if (cancelled) return;
      setMessages(seeded);
      persistMessages(seeded);
    };

    loadWelcome();
    return () => {
      cancelled = true;
    };
  }, [language, actorId, persistMessages, storageKey, t]);

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

  // Anon Realtime Presence — ephemeral, no DB writes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const channel = supabase
      .channel('mm3-irc-anon-presence')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const seen = new Set();
        const users = [];
        for (const entries of Object.values(state)) {
          for (const u of entries) {
            const id = String(u.anonId || '');
            if (!id.startsWith('anon:') || seen.has(id)) continue;
            seen.add(id);
            const rawFlag = String(u.flag || '');
            users.push({ anonId: id, flag: rawFlag.length === 2 ? rawFlag : '' });
          }
        }
        setAnonUsers(users);
      })
      .on('presence', { event: 'join' }, () => {})
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || normalizedWallet) return;
        if (!anonId.startsWith('anon:')) return;
        await channel.track({ anonId, flag: anonFlag }).catch(() => {});
      });

    return () => {
      supabase.removeChannel(channel);
      setAnonUsers([]);
    };
  }, [anonId, anonFlag, appendMessage, normalizedWallet]);

  const loadMarketClaims = useCallback(async () => {
    try {
      const [{ data: ownersData, error }, { data: pixelsData }] = await Promise.all([
        supabase
          .from('player_progress')
          .select('wallet, market_nftmoji_key')
          .not('market_nftmoji_key', 'is', null),
        supabase
          .from('mm3_podcast_pixels')
          .select('pixel_key, emoji'),
      ]);
      if (error) throw error;

      const emojiByKey = new Map();
      for (const p of pixelsData || []) {
        if (p.pixel_key && p.emoji) emojiByKey.set(p.pixel_key, p.emoji);
      }

      const nextClaims = {};
      for (const entry of ownersData || []) {
        const wallet = String(entry.wallet || '').toLowerCase();
        const key = entry.market_nftmoji_key;
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
    const shortW = (w) => `${String(w).slice(0, 6)}...${String(w).slice(-4)}`;
    const isEs = language === 'es';

    const build = () => {
      const walletParts = connectedWallets.map((u) => shortW(u.wallet));
      const anonParts = anonUsers.map((u) => {
        const cc = u.flag || '';
        const tag = cc.length === 2 ? `[${cc}]` : '[??]';
        const shortId = String(u.anonId || '').split(':')[1] || '?';
        return `${tag} ghost:${shortId}`;
      });
      const all = [...walletParts, ...anonParts];
      const n = all.length;
      const nodeWord = isEs ? (n === 1 ? 'nodo' : 'nodos') : (n === 1 ? 'node' : 'nodes');
      const text = n === 0
        ? (isEs ? 'mainframe // señal silenciosa — sin nodos activos' : 'mainframe // signal quiet — no active nodes')
        : `mainframe // ${n} ${nodeWord} // ${all.join(' · ')}`;
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
  }, [connectedWallets, anonUsers, language, upsertMessage]);

  useEffect(() => {
    const resolveBlock = (nftmojiKey) => {
      const block = blockByKeyRef.current.get(nftmojiKey);
      const fallback = MARKET_COMMANDS.find((e) => e.key === nftmojiKey);
      return {
        emoji: block?.emoji || fallback?.emoji || '?',
        hex: block ? getBlockHex(block.grid_row, block.grid_col) : nftmojiKey,
        formula: getCommandFormula(fallback?.command),
      };
    };

    const channel = supabase
      .channel('mm3-irc-market-commands-watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mm3_market_commands' }, ({ new: rec }) => {
        const { emoji, hex, formula } = resolveBlock(rec.nftmoji_key);
        const reset = String(rec.reset_at || '').slice(5, 16);
        appendMessage(makeMessage({
          id: `market-event:on:${rec.id}`,
          kind: 'system',
          wallet: 'system',
          text: `Market: ${emoji} ${hex} // command active // formula=${formula} // x=${rec.formula_x} // reset=${reset}Z // by ${rec.wallet ? `${String(rec.wallet).slice(0, 6)}...${String(rec.wallet).slice(-4)}` : '?'}`,
          ts: Date.now(),
          tone: 'market',
        }), { silent: false });
        setTimeout(async () => {
          try {
            const { data: penaltyRows } = await supabase
              .from('mm3_command_penalties')
              .select('wallet')
              .eq('command_id', rec.id);
            const count = (penaltyRows || []).length;
            if (count > 0) {
              appendMessage(makeMessage({
                id: `market-penalties:on:${rec.id}`,
                kind: 'system',
                wallet: 'system',
                text: `Market: ${emoji} // ${count} wallets penalized // penalties active until ${reset}Z`,
                ts: Date.now(),
                tone: 'market',
              }), { silent: false });
            }
          } catch {}
        }, 3000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mm3_market_commands' }, async ({ new: rec }) => {
        if (new Date(rec.reset_at) > new Date()) return;
        const { emoji, hex } = resolveBlock(rec.nftmoji_key);
        let releasedInfo = '';
        try {
          const { data: penaltyRows } = await supabase
            .from('mm3_command_penalties')
            .select('wallet')
            .eq('command_id', rec.id);
          const count = (penaltyRows || []).length;
          if (count > 0) releasedInfo = ` // ${count} wallets released`;
        } catch {}
        const expiredPayload = {
          id: `market-event:off:${rec.id}`,
          kind: 'system',
          wallet: 'system',
          text: `Market: ${emoji} ${hex} // command expired // penalties cleared${releasedInfo}`,
          ts: Date.now(),
          tone: 'market',
        };
        appendMessage(makeMessage(expiredPayload), { silent: false });
        relayRef.current?.send({ type: 'broadcast', event: 'message', payload: expiredPayload }).catch(() => {});
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [appendMessage]);

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

  const processMarketCommand = useCallback(async (text) => {
    const commandEntry = findMarketCommandByText(text);
    if (!commandEntry || !normalizedWallet) return false;

    const now = new Date();
    const nowIso = now.toISOString();
    const dayWindow = getUtcDayWindow(now);

    try {
      const [{ data: launcher }, { data: existingCommand }, { data: blockRow }, { data: progressRows }, { data: leaderboardRows }, { data: existingPenalties }] = await Promise.all([
        supabase
          .from('player_progress')
          .select('wallet, market_nftmoji_key')
          .eq('wallet', normalizedWallet)
          .maybeSingle(),
        supabase
          .from('mm3_market_commands')
          .select('id, wallet, reset_at')
          .eq('nftmoji_key', commandEntry.key)
          .gt('reset_at', nowIso)
          .order('executed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('mm3_podcast_pixels')
          .select('pixel_key, emoji, title_en, title_es, price_eur')
          .eq('pixel_key', commandEntry.key)
          .maybeSingle(),
        supabase
          .from('player_progress')
          .select('wallet, level, market_nftmoji_key, eur_earned, usd_earned, cny_earned'),
        supabase
          .from('leaderboard_data')
          .select('wallet'),
        supabase
          .from('mm3_command_penalties')
          .select('wallet')
          .eq('nftmoji_key', commandEntry.key)
          .gte('created_at', dayWindow.startAt),
      ]);

      if (launcher?.market_nftmoji_key !== commandEntry.key) {
        await broadcastSystemMessage(`command rejected // ${normalizedWallet} does not own ${commandEntry.emoji}`, 'leave');
        return true;
      }

      if (existingCommand) {
        const reset = new Date(existingCommand.reset_at).toISOString().slice(11, 16);
        await broadcastSystemMessage(`${commandEntry.emoji} ${t('podcast.launchLocked')} ${reset} UTC`, 'leave');
        return true;
      }

      if (!blockRow) {
        await broadcastSystemMessage(`command rejected // market block missing ${commandEntry.key}`, 'leave');
        return true;
      }

      const { x, code } = computeMarketCommandCode(commandEntry, normalizedWallet, dayWindow.dayKey, now.getTime());
      const { data: insertedCommand, error: commandError } = await supabase
        .from('mm3_market_commands')
        .insert({
          wallet: normalizedWallet,
          nftmoji_key: commandEntry.key,
          command: commandEntry.command,
          numeric_code: code,
          formula_x: x,
          reset_at: dayWindow.resetAt,
        })
        .select('id')
        .single();
      if (commandError) throw commandError;

      const alreadyPenalized = new Set((existingPenalties || []).map((entry) => String(entry.wallet || '').toLowerCase()));
      const progressByWallet = new Map(
        (progressRows || []).map((row) => [String(row.wallet || '').toLowerCase(), row])
      );
      const priceEur = Number(blockRow.price_eur) || 0;
      const priceUsd = priceEur * (CNY_TO_USD / CNY_TO_EUR);
      const priceCny = priceEur / CNY_TO_EUR;
      const penalties = [];
      const balanceUpdates = [];
      for (const prestigeRow of leaderboardRows || []) {
        const wallet = String(prestigeRow.wallet || '').toLowerCase();
        const row = progressByWallet.get(wallet) || { wallet, level: 0, market_nftmoji_key: null };
        if (!wallet || wallet === normalizedWallet) continue;
        if (row.market_nftmoji_key === commandEntry.key) continue;
        if (alreadyPenalized.has(wallet)) continue;
        const rateCny = getSellRateCny(Number(row.level) || 0);
        const penaltyMm3 = rateCny > 0 ? priceEur / (rateCny * CNY_TO_EUR) : 0;
        penalties.push({
          wallet,
          command_id: insertedCommand?.id || null,
          nftmoji_key: commandEntry.key,
          penalty_code: code,
          penalty_value: penaltyMm3,
          penalty_eur: priceEur,
          reason: `${blockRow.emoji || commandEntry.emoji} ${blockRow.title_en || commandEntry.key}`,
          reset_at: dayWindow.resetAt,
        });
        balanceUpdates.push({
          wallet,
          eur_earned: (Number(row.eur_earned) || 0) - priceEur,
          usd_earned: (Number(row.usd_earned) || 0) - priceUsd,
          cny_earned: (Number(row.cny_earned) || 0) - priceCny,
        });
      }

      if (penalties.length > 0) {
        const { error: penaltyError } = await supabase
          .from('mm3_command_penalties')
          .insert(penalties);
        if (penaltyError) throw penaltyError;
        await Promise.all(balanceUpdates.map((payload) =>
          supabase
            .from('player_progress')
            .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: 'wallet', ignoreDuplicates: false })
        ));
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_dirty_at', String(Date.now()));
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet: normalizedWallet, marketCommand: true } }));
      }

      await broadcastSystemMessage(
        `${blockRow.emoji || commandEntry.emoji} ${t('podcast.launchSuccess')} // formula=${getCommandFormula(commandEntry.command)} // x=${x} // ${penalties.length} ${t('podcast.walletsPenalized')} // reset ${dayWindow.resetAt.slice(11, 16)} UTC`,
        'accent'
      );
      return true;
    } catch (err) {
      console.error('market command:', err);
      await broadcastSystemMessage(`${t('podcast.commandFailed')} // ${err?.message || 'market daemon non-zero'}`, 'leave');
      return true;
    }
  }, [broadcastSystemMessage, normalizedWallet, t]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!normalizedWallet) return;
    const text = normalizeRelayMessage(draft);
    if (!text) return;

    const payload = {
      id: `msg:${normalizedWallet}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      wallet: normalizedWallet,
      text,
      ts: Date.now(),
    };

    appendMessage(makeMessage(payload), { silent: false });
    setDraft('');

    try {
      await relayRef.current?.send({
        type: 'broadcast',
        event: 'message',
        payload,
      });
    } catch {}

    const handledMarketCommand = await processMarketCommand(text);
    if (!handledMarketCommand && /^wall\s/i.test(text)) {
      await broadcastSystemMessage(`${IRC_ADMIN_LABEL}:~$ ${t('irc.wallPrompt')}`, 'accent');
    }
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
        .mm3-irc-line.system                       { color: #64748b; }  /* system: slate  */
        .mm3-irc-line.system[data-tone='accent']   { color: #4ade80; text-shadow: 0 0 8px rgba(74,222,128,.18); }  /* welcome: green */
        .mm3-irc-line.system[data-tone='market']   { color: #f59e0b; }  /* market: amber  */
        .mm3-irc-line.system[data-tone='join']     { color: #22d3ee; }  /* join:   cyan   */
        .mm3-irc-line.system[data-tone='leave']    { color: #f87171; }  /* leave:  red    */
        .mm3-irc-line.system[data-tone='ghost']    { color: #44403c; font-style: italic; }  /* ghost: stone */
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
          color: #57534e;
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
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-cyan-500/12 pb-2 font-mono">
            <div>
              <div className="text-[0.66rem] uppercase tracking-[0.22em] text-cyan-300">{t('irc.title')}</div>
              <div className="mt-0.5 text-[0.56rem] uppercase tracking-[0.16em] text-slate-500">#relay-mainframe</div>
            </div>
            <div className="text-right">
              <div className={`text-[0.52rem] uppercase tracking-[0.16em] ${normalizedWallet ? 'text-cyan-700' : 'text-amber-700/70'}`}>
                {!normalizedWallet ? t('irc.readOnly') : (relayReady ? 'live' : 'syncing')}
              </div>
              <div className={`mt-0.5 break-all text-[0.58rem] ${normalizedWallet ? 'text-cyan-200' : 'text-slate-500'}`}>
                {formatIrcWalletLabel(actorId)}
              </div>
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
                  <span className="shrink-0 pt-0.5 text-[0.54rem] uppercase tracking-[0.14em] text-slate-500">
                    {formatRelayTime(message.ts)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mm3-irc-wallet-line">
                      <div className="mm3-irc-wallet-meta">
                        {ownedMarketEmojis.length > 0 ? (
                          <div className="mm3-irc-wallet-emojis" aria-label="market nftmojis">
                            {ownedMarketEmojis.map((emoji, index) => (
                              <span key={`${message.wallet}-${emoji}-${index}`} className="mm3-irc-wallet-emoji">{emoji}</span>
                            ))}
                          </div>
                        ) : null}
                        <div className="mm3-irc-author flex-1 text-[0.56rem] uppercase tracking-[0.13em]">{author}</div>
                      </div>
                    </div>
                    <div className="mm3-irc-msg-text mt-0.5 break-words text-[0.72rem] leading-relaxed">{message.text}</div>
                  </div>
                </div>
              );
            }) : (
              <div className="px-1 py-2 text-[0.66rem] uppercase tracking-[0.14em] text-slate-500">
                {t('irc.empty')}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {normalizedWallet ? (
            <form onSubmit={handleSend} className="mt-2 flex flex-col gap-1.5 sm:flex-row">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t('irc.inputPlaceholder')}
                className="min-w-0 flex-1 rounded-sm border border-cyan-500/15 bg-black/80 px-2.5 py-1.5 font-mono text-[0.72rem] text-cyan-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/45 focus:shadow-[0_0_18px_rgba(34,211,238,0.08)]"
                maxLength={280}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                className="mm3-irc-submit rounded-sm border border-cyan-500/35 px-3 py-1.5 font-mono text-[0.62rem] font-black uppercase tracking-[0.22em] text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100"
                disabled={!relayReady || !normalizeRelayMessage(draft)}
              >
                {t('irc.send')}
              </button>
            </form>
          ) : (
            <div className="mt-2 flex items-center gap-2 border border-amber-500/12 bg-amber-950/10 px-2.5 py-1.5 font-mono">
              <span className="text-amber-600/70 text-[0.5rem]">▶</span>
              <span className="text-[0.56rem] uppercase tracking-[0.2em] text-amber-700/60">{t('irc.readOnlyHint')}</span>
            </div>
          )}
        </section>

        <aside className="mm3-irc-panel rounded-sm p-2.5">
          <div className="border-b border-cyan-500/12 pb-1.5 font-mono">
            <div className="flex items-baseline justify-end gap-0.5">
              <span className="text-[0.52rem] tracking-[0.14em] text-slate-500">{connectedWallets.length}</span>
              <span className="text-[0.52rem] text-slate-700">/</span>
              <span className="text-[0.52rem] tracking-[0.14em] text-slate-600">{connectedWallets.length + anonUsers.length}</span>
            </div>
          </div>

          <div className="mt-1.5">
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
                  return (
                    <div
                      key={entry.wallet}
                      className={`mm3-irc-peer-row${isYou ? ' is-you' : ''}${isAnon && !isYou ? ' is-anon' : ''}`}
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
                    {`+ ${Math.min(5, connectedWallets.length - visibleCount)} more`}
                  </button>
                )}
                {visibleCount > 5 && connectedWallets.length <= visibleCount && (
                  <button
                    className="mm3-irc-show-more"
                    onClick={() => setVisibleCount(5)}
                  >
                    ▲ collapse
                  </button>
                )}
              </>
            ) : (
              <div className="pt-1 font-mono text-[0.52rem] uppercase tracking-[0.16em] text-slate-600">
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
                    {`+ ${Math.min(5, anonUsers.length - anonVisibleCount)} more`}
                  </button>
                )}
                {anonVisibleCount > 5 && anonUsers.length <= anonVisibleCount && (
                  <button className="mm3-irc-show-more" onClick={() => setAnonVisibleCount(5)}>
                    ▲ collapse
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
