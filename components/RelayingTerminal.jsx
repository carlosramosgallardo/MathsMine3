'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import { useI18n } from '@/lib/i18n-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { useSound } from '@/lib/sound-context';
import { CNY_TO_EUR, CNY_TO_USD, getSellRateCny } from '@/lib/sell-offer';
import {
  computeMarketCommandCode,
  commandKey,
  marketCommandFromBlock,
  normalizeCommandText,
  getUtcDayWindow,
} from '@/lib/mining-commands';
import { formatBlockRequirement, MM3_BLOCK_REQUIREMENT_BY_HEX, normalizeBlockHex } from '@/lib/mm3-block-chain';
import { useIrcPresence } from '@/lib/relaying-presence-context';
import { groupPresenceEntries } from '@/lib/presence-display';
import { colorFromAddress, colorFromPool } from '@/lib/wallet-colors';
import { formatWalletLabel } from '@/lib/wallet-format';

const ACTIVE_WINDOW_MS = 90_000;
const MAX_SESSION_MESSAGES = 500;
const MAX_CHAT_HISTORY = 500;
const IRC_FILTER_TYPES = ['welcome', 'mining', 'mainframe', 'squeezing', 'donations', 'bots'];
const DEFAULT_IRC_FILTERS = IRC_FILTER_TYPES.reduce((acc, key) => ({ ...acc, [key]: false }), {});

function flagImgUrl(cc) {
  if (!cc || cc.length !== 2) return null;
  return `https://flagcdn.com/16x12/${cc.toLowerCase()}.png`;
}

function FlagImg({ cc, style }) {
  const url = flagImgUrl(cc);
  if (!url) return <span style={style}>👻</span>;
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
const IRC_ADMIN_LABEL = 'freakingAI@MM3·:~$';
const IRC_BOT_WALLETS = new Set([
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202',
  '0xd6c6c15060b27406d956c7e99e520cc810b44233',
  '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab',
]);

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

function filterKeyForWallet(wallet) {
  return `mm3-irc-filters-v2-${String(wallet || '').toLowerCase()}`;
}

function makeMessage({ id, kind = 'chat', wallet = 'system', text = '', ts = Date.now(), tone = 'neutral', replaceGroup = '', replaceBatchId = '' }) {
  return { id, kind, wallet, text, ts, tone, replaceGroup, replaceBatchId };
}

function stableHash(value) {
  let h = 2166136261;
  const str = String(value || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function sortMessagesByTime(messages) {
  return [...messages].sort((a, b) =>
    (Number(a.ts) || 0) - (Number(b.ts) || 0) ||
    String(a.id || '').localeCompare(String(b.id || ''))
  );
}

function formatRelayTime(ts, language = 'en') {
  try {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    const dd = p(d.getDate());
    const mm = p(d.getMonth() + 1);
    const yy = String(d.getFullYear()).slice(2);
    const date = language === 'es' ? `${dd}/${mm}/${yy}` : `${mm}/${dd}/${yy}`;
    return `${date} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch {
    return '--:--:--';
  }
}

function formatResetIn(value, language = 'en') {
  try {
    const ms = new Date(value).getTime() - Date.now();
    const isEs = language === 'es';
    if (Number.isNaN(ms) || ms <= 0) return isEs ? 'ahora' : 'now';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const prefix = isEs ? 'en' : 'in';
    if (h > 0) return `${prefix} ${h}h${m > 0 ? ` ${m}m` : ''}`;
    if (m > 0) return `${prefix} ${m}m`;
    return `${prefix} ${s}s`;
  } catch {
    return '--';
  }
}

function normalizeRelayMessage(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 280);
}

function getSlashHead(value) {
  return String(value || '').trim().replace(/^\/+/, '').split(/\s+/)[0].toLowerCase();
}

function shortenWallet(value) {
  const wallet = String(value || '');
  if (wallet.length <= 18) return wallet;
  return formatWalletLabel(wallet);
}

function shortenMarketWallet(value) {
  const wallet = String(value || '');
  if (!wallet) return '';
  if (wallet.length <= 14) return wallet;
  return formatWalletLabel(wallet);
}

function formatIrcWalletLabel(wallet) {
  const normalized = String(wallet || '').toLowerCase();
  if (IRC_BOT_WALLETS.has(normalized)) return shortenWallet(normalized);
  return normalized === IRC_ADMIN_WALLET ? IRC_ADMIN_LABEL : shortenWallet(normalized);
}

function formatChatAuthor(wallet, normalizedWallet, youLabel) {
  const normalized = String(wallet || '').toLowerCase();
  const label = formatWalletLabel(normalized);
  const baseLabel = IRC_BOT_WALLETS.has(normalized) ? `${label}(bot)@MM3·:~$` : normalized === IRC_ADMIN_WALLET ? IRC_ADMIN_LABEL : `${label}@MM3·:~$`;
  return normalized === normalizedWallet ? `${baseLabel} (${youLabel})` : baseLabel;
}

function formatSystemAuthor(tone) {
  if (tone === 'kernelpanic') return 'root@mm3';
  if (tone === 'realchain') return 'MathsMine3@ETH·:~$';
  if (tone === 'market') return 'mining@MM3·:~$';
  if (tone === 'squeeze') return 'squeezing@MM3·:~$';
  if (tone === 'ghost' || tone === 'join' || tone === 'leave') return 'mainframe@MM3·:~$';
  if (tone === 'command') return 'cmd@MM3·:~$';
  if (tone === 'accent') return 'welcome@MM3·:~$';
  return 'system@MM3·:~$';
}

function getMessageFilterType(message) {
  if (message?.tone === 'bot' || IRC_BOT_WALLETS.has(String(message?.wallet || '').toLowerCase())) return 'bots';
  if (message?.kind !== 'system') return null;
  if (message.tone === 'accent') return 'welcome';
  if (message.tone === 'market') return 'mining';
  if (message.tone === 'squeeze') return 'squeezing';
  if (message.tone === 'realchain') return 'donations';
  if (message.tone === 'ghost' || message.tone === 'join' || message.tone === 'leave') return 'mainframe';
  return null;
}

function formatWelcomeText(value) {
  const parts = String(value || '')
    .replace(/#/g, ' ')
    .split('//')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' >> ') : 'MATHSMINE3';
}

function formatSystemPromptText(value) {
  return String(value || '').replace(/^\/\/\s*/, '');
}

function getStatusSignature(messages) {
  return messages
    .map((message) => String(message?.text || '').replace(/ >> reset (?:in|en) \d+(?:h(?: \d+m)?|m|s)$/i, ' >> reset'))
    .join('\n');
}

function localizeLegacySystemPromptText(value, language) {
  let text = formatSystemPromptText(value);
  const isEs = language === 'es';
  const legacyPairs = [
    {
      es: 'ERR: intento de hackeo del sistema',
      en: 'ERR: system hack attempt',
    },
    {
      es: 'comando no encontrado',
      en: 'command not found',
    },
    {
      es: 'índice cmd no disponible',
      en: 'cmd index unavailable',
    },
  ];

  for (const { es, en } of legacyPairs) {
    const esThenEn = `${es} / ${en}`;
    const enThenEs = `${en} / ${es}`;
    if (text.startsWith(esThenEn)) {
      return `${isEs ? es : en}${text.slice(esThenEn.length)}`;
    }
    if (text.startsWith(enThenEs)) {
      return `${isEs ? es : en}${text.slice(enThenEs.length)}`;
    }
  }

  if (text.startsWith('code ok >>') || text.startsWith('código ok >>')) {
    text = text.replace(/^(code ok|código ok)/, isEs ? 'código ok' : 'code ok');
    text = text.replace(/ >> (penalty reset|penalización reset)$/i, ` >> ${isEs ? 'penalización reset' : 'penalty reset'}`);
  }

  return text;
}

function tickerFromRow(row, language, fallback) {
  const localized = language === 'es' ? row?.ticker_message_es : row?.ticker_message_en;
  return String(localized || row?.ticker_message || fallback || '').trim() || fallback;
}

function isErrorOrPenaltyMessage(text, tone) {
  const t = String(text || '').replace(/^\/\/\s*/, '').trim();
  if (tone === 'command') {
    return /^(ERR:|access denied|acceso denegado|command not found|comando no encontrado|command failed|comando fallido|cmd index unavailable|índice cmd no disponible)/i.test(t);
  }
  if (tone === 'market') {
    return /^exec\b/i.test(t);
  }
  return false;
}

function renderIrcTextLinks(displayText, tone, onWalletClick, blockMap, onBlockClick, poolCodes, onPoolClick, onChainClick) {
  const str = String(displayText);
  const regex = /(chain:\d+(?:\.\d+)?%|0x[a-f0-9]{40}|#[0-9A-F]{3}|mm3-\d{3}|\b[A-Z0-9]{5}\b)(?![0-9A-Fa-f])/gi;
  if (!regex.test(str)) return str;
  regex.lastIndex = 0;
  const parts = [];
  let last = 0;
  let match;
  while ((match = regex.exec(str)) !== null) {
    if (match.index > last) parts.push(str.slice(last, match.index));
    const token = match[1];
    const normalizedToken = token.toLowerCase();
    const poolToken = token.toUpperCase();
    const blockLink = blockMap?.get(poolToken) || blockMap?.get(normalizedToken) || blockMap?.get(token);
    if (normalizedToken.startsWith('chain:') && onChainClick) {
      parts.push(
        <span
          key={`ch-${match.index}`}
          className="mm3-irc-chain-link"
          onClick={onChainClick}
        >
          {token}
        </span>
      );
    } else if (normalizedToken.startsWith('0x')) {
      const addr = normalizedToken;
      parts.push(
        <span
          key={`wa-${match.index}`}
          className="mm3-irc-wallet-link"
          style={{ color: colorFromAddress(addr) }}
          onClick={() => onWalletClick?.(addr)}
        >
          {formatWalletLabel(addr)}
        </span>
      );
    } else if (blockLink) {
      parts.push(
        <span
          key={`bh-${match.index}`}
          className="mm3-irc-block-link"
          onClick={() => onBlockClick?.(blockLink.key)}
        >
          {blockLink.label}
        </span>
      );
    } else if (poolCodes?.has(poolToken)) {
      parts.push(
        <span
          key={`po-${match.index}`}
          className="mm3-irc-pool-link"
          style={{ color: colorFromPool(poolToken) }}
          onClick={() => onPoolClick?.(poolToken)}
        >
          {token}
        </span>
      );
    } else {
      parts.push(token);
    }
    last = match.index + token.length;
  }
  if (last < str.length) parts.push(str.slice(last));
  return <>{parts}</>;
}

export default function RelayingTerminal({ accent = '#22d3ee' }) {
  const { t, language } = useI18n();
  const router = useRouter();
  const { account } = useActiveWallet();
  const { playIrcMessage } = useSound();
  const normalizedWallet = useMemo(() => String(account || '').toLowerCase(), [account]);
  const { anonIrcUsers: anonUsers, trackAnon, untrackAnon, channelStatus } = useIrcPresence();
  const [anonId, setAnonId] = useState('anon:000000');
  const [anonFlag, setAnonFlag] = useState('');
  const [anonVisibleCount, setAnonVisibleCount] = useState(5);
  const [walletFlag, setWalletFlag] = useState('');
  const [walletFlags, setWalletFlags] = useState({});
  const actorId = normalizedWallet || anonId;
  const storageKey = useMemo(() => sessionKeyForWallet(actorId), [actorId]);
  const filterStorageKey = useMemo(() => filterKeyForWallet(actorId), [actorId]);

  const [draft, setDraft] = useState('');
  const [atSuggestions, setAtSuggestions] = useState([]);
  const [atSuggestIdx, setAtSuggestIdx] = useState(0);
  const [messages, setMessages] = useState([]);
  const [messageFilters, setMessageFilters] = useState(DEFAULT_IRC_FILTERS);
  const [connectedWallets, setConnectedWallets] = useState([]);
  const [marketClaimsByWallet, setMarketClaimsByWallet] = useState({});
  const [poolCodes, setPoolCodes] = useState(() => new Set());
  const [relayReady, setRelayReady] = useState(false);
  const [presenceReady, setPresenceReady] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);
  const relayGroups = useMemo(() => groupPresenceEntries(connectedWallets, (entry) => entry.wallet), [connectedWallets]);

  const relayRef = useRef(null);
  const previousPresenceRef = useRef(new Set());
  const presenceBootedRef = useRef(false);
  const endRef = useRef(null);
  const blockByKeyRef = useRef(new Map());
  const inputRef = useRef(null);
  const lastRelayStatusRef = useRef('');
  const lastMarketStatusRef = useRef('');
  const pendingEmptyPresenceRef = useRef(false);
  const refreshMarketStatusRef = useRef(null);
  const welcomeTsRef = useRef(Date.now());
  const relayStatusBootedRef = useRef(false);
  const presenceDeltaRef = useRef({ joined: [], left: [] });

  const filterLabels = useMemo(() => (
    language === 'es'
      ? {
          welcome: 'welcome',
          mining: 'mining',
          mainframe: 'mainframe',
          squeezing: 'squeezing',
          donations: 'donations ETH',
          bots: 'bots',
        }
      : {
          welcome: 'welcome',
          mining: 'mining',
          mainframe: 'mainframe',
          squeezing: 'squeezing',
          donations: 'donations ETH',
          bots: 'bots',
        }
  ), [language]);

  useEffect(() => {
    if (typeof window === 'undefined' || !filterStorageKey) return;
    try {
      const parsed = JSON.parse(localStorage.getItem(filterStorageKey) || 'null');
      setMessageFilters({ ...DEFAULT_IRC_FILTERS, ...(parsed && typeof parsed === 'object' ? parsed : {}) });
    } catch {
      setMessageFilters(DEFAULT_IRC_FILTERS);
    }
  }, [filterStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !filterStorageKey) return;
    localStorage.setItem(filterStorageKey, JSON.stringify(messageFilters));
  }, [filterStorageKey, messageFilters]);

  const toggleMessageFilter = useCallback((key) => {
    setMessageFilters((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }, []);

  const visibleMessages = useMemo(() => messages.filter((message) => {
    const filterType = getMessageFilterType(message);
    return !filterType || messageFilters[filterType] !== false;
  }), [messages, messageFilters]);

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
      const base = message.replaceGroup
        ? current.filter((entry) => entry.replaceGroup !== message.replaceGroup || entry.replaceBatchId === message.replaceBatchId)
        : current;
      const next = sortMessagesByTime([...base, message]).slice(-MAX_SESSION_MESSAGES);
      persistMessages(next);
      return next;
    });
    if (!options.silent) {
      playIrcMessage();
    }
  }, [persistMessages, playIrcMessage]);

  const appendAndBroadcastMessage = useCallback((message, options = {}) => {
    appendMessage(message, options);
    relayRef.current?.send({ type: 'broadcast', event: 'message', payload: message }).catch(() => {});
  }, [appendMessage]);

  const buildMarketStatusLines = useCallback(({ ownersData = [], commandsData = [], blocksData = [], penaltiesData = [] }) => {
    const blocks = blocksData || [];
    const blockByKey = new Map(blocks.map((entry) => [entry.block_key, entry]));
    blockByKeyRef.current = blockByKey;

    const commandEntries = blocks.map(marketCommandFromBlock).filter(Boolean);
    const commandEntryByKey = new Map(commandEntries.map((entry) => [entry.key, entry]));
    const ownerWalletsByKey = new Map();
    for (const entry of ownersData || []) {
      const key = entry.mining_nftji_key;
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
      const affected = affectedWallets.map(formatWalletLabel).join(' · ') || '0';
      activeLines.push(
        `${label.active} >> ${emoji} ${hex} >> ${t('relaying.by')} ${formatWalletLabel(command.wallet)} >> ${label.affected}: ${affected} >> ${label.reset} ${formatResetIn(command.reset_at, language)}`
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
      const readyWallets = ownerWallets.map(formatWalletLabel).join(' · ');
      readyLines.push(`${label.ready} >> ${entry.emoji} ${hex} >> ${label.wallets}: ${readyWallets}`);
    }

    return readyLines.length > 0 ? readyLines : [t('relaying.marketNoPenalties')];
  }, [language, t]);

  // Derive stable anon ID from external IP (client-only, no DB, cached in sessionStorage)
  useEffect(() => {
    if (normalizedWallet || typeof window === 'undefined') return;
    const META_KEY = 'mm3-anon-meta';
    const sessionId = sessionStorage.getItem('mm3-anon-session');
    const fallbackId = sessionId?.startsWith('anon:')
      ? sessionId
      : `anon:${Math.random().toString(36).slice(2, 8)}`;
    setAnonId(fallbackId);
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
        const id = ip ? hashIpToId(ip) : fallbackId;
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
    relayStatusBootedRef.current = false;
    lastRelayStatusRef.current = '';

    const loadWelcome = async () => {
      let welcomeText = t('relaying.welcomeFallback');
      const marketMessages = [];
      let chatHistory = [];

      try {
        const nowIso = new Date().toISOString();
        // Separate queries: if macro or owners fail, we still want the chat history
        const [ircRes, squeezeRes, kernelpanicRes, macroRes, ownersRes, commandsRes, blocksRes, penaltiesRes] = await Promise.all([
          supabase
            .from('mm3_relaying_messages')
            .select('wallet, text, ts, kind, tone')
            .order('ts', { ascending: false })
            .limit(MAX_CHAT_HISTORY),
          supabase
            .from('mm3_relaying_messages')
            .select('wallet, text, ts, kind, tone')
            .eq('tone', 'squeeze')
            .order('ts', { ascending: false })
            .limit(100),
          supabase
            .from('mm3_relaying_messages')
            .select('wallet, text, ts, kind, tone')
            .eq('tone', 'kernelpanic')
            .order('ts', { ascending: false })
            .limit(20),
          supabase
            .from('mm3_macro_state')
            .select('ticker_message, ticker_message_en, ticker_message_es')
            .eq('id', 1)
            .maybeSingle(),
          supabase
            .from('player_progress')
            .select('wallet, mining_nftji_key')
            .not('mining_nftji_key', 'is', null),
          supabase
            .from('mm3_mining_commands')
            .select('id, nftji_key, formula_x, reset_at, wallet')
            .gt('reset_at', nowIso),
          supabase
            .from('mm3_mining_blocks')
            .select('block_key, emoji, grid_row, grid_col, title_en, title_es, price_eur, market_command, is_active'),
          supabase
            .from('mm3_command_penalties')
            .select('command_id, nftji_key, wallet')
            .is('redeemed_at', null),
        ]);

        const dbMessages = ircRes.data || [];
        // Merge squeeze and kernelpanic traces (fetched independently so they never get buried by bot messages)
        const squeezeMessages = squeezeRes.data || [];
        const kernelpanicMessages = kernelpanicRes.data || [];
        const allDbMessages = [...dbMessages];
        const existingTs = new Set(dbMessages.map((m) => String(m.ts)));
        for (const m of squeezeMessages) {
          if (!existingTs.has(String(m.ts))) allDbMessages.push(m);
        }
        for (const m of kernelpanicMessages) {
          if (!existingTs.has(String(m.ts))) { existingTs.add(String(m.ts)); allDbMessages.push(m); }
        }
        allDbMessages.sort((a, b) => Number(a.ts) - Number(b.ts));
        chatHistory = allDbMessages;

        const { data } = macroRes;
        const { data: ownersData } = ownersRes;
        const { data: commandsData } = commandsRes;
        const { data: blocksData } = blocksRes;
        const { data: penaltiesData } = penaltiesRes;

        welcomeText = tickerFromRow(data, language, welcomeText);
        marketMessages.push(...buildMarketStatusLines({ ownersData, commandsData, blocksData, penaltiesData }));
        lastMarketStatusRef.current = getStatusSignature(marketMessages.map((text) => ({ text })));

        const stored = safeParseSession(sessionStorage.getItem(storageKey));
        const withoutWelcome = stored.filter((entry) =>
          !(entry.kind === 'system' && (
            entry.tone === 'accent' ||
            entry.replaceGroup === 'market-status' ||
            entry.replaceGroup === 'relay-status' ||
            String(entry.id || '').startsWith('market-status:') ||
            String(entry.id || '').startsWith('relay-status:')
          ))
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
              text: `${formatWelcomeText(welcomeText)} >> ${actorId}`,
              ts: welcomeTsRef.current,
              tone: 'accent',
              replaceGroup: 'welcome',
              replaceBatchId: `welcome:${actorId}`,
            }),
            ...marketMessages.map((text, i) => makeMessage({
              id: `market-status:${i}:${actorId}`,
              kind: 'system',
              wallet: 'system',
              text,
              ts: welcomeTsRef.current + 2 + i,
              tone: 'market',
              replaceGroup: 'market-status',
              replaceBatchId: `market-boot:${actorId}`,
            })),
            ...finalUnique,
          ].filter((entry, index, arr) => {
            if (!entry.replaceGroup) return true;
            return arr.findIndex((candidate) =>
              candidate.replaceGroup === entry.replaceGroup &&
              candidate.replaceBatchId === entry.replaceBatchId &&
              candidate.id === entry.id
            ) === index;
          });
          const sortedSeeded = sortMessagesByTime(seeded).slice(-MAX_SESSION_MESSAGES);

          if (cancelled) return current;
          persistMessages(sortedSeeded);
          return sortedSeeded;
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
            replaceGroup: payload?.replaceGroup || '',
            replaceBatchId: payload?.replaceBatchId || '',
          }),
          { silent: false }
        );
      })
      .on('broadcast', { event: 'market-status-refresh' }, () => {
        refreshMarketStatusRef.current?.();
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
          .select('wallet, mining_nftji_key')
          .not('mining_nftji_key', 'is', null),
        supabase
          .from('mm3_mining_blocks')
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
        const key = entry.mining_nftji_key;
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
    const timer = setInterval(loadMarketClaims, 120_000);
    window.addEventListener('focus', loadMarketClaims);
    window.addEventListener('mm3-db-updated', loadMarketClaims);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', loadMarketClaims);
      window.removeEventListener('mm3-db-updated', loadMarketClaims);
    };
  }, [loadMarketClaims]);

  const loadPoolCodes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mm3_wallet_pools')
        .select('pool_code');
      if (error) throw error;
      setPoolCodes(new Set((data || []).map((row) => String(row.pool_code || '').toUpperCase()).filter(Boolean)));
    } catch {
      setPoolCodes(new Set());
    }
  }, []);

  useEffect(() => {
    loadPoolCodes();
    const timer = setInterval(loadPoolCodes, 300_000);
    window.addEventListener('focus', loadPoolCodes);
    window.addEventListener('mm3-db-updated', loadPoolCodes);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', loadPoolCodes);
      window.removeEventListener('mm3-db-updated', loadPoolCodes);
    };
  }, [loadPoolCodes]);

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

      const stableWallets = uniqueWallets.sort((a, b) => a.wallet.localeCompare(b.wallet));
      if (stableWallets.length === 0 && previousPresenceRef.current.size > 0 && !pendingEmptyPresenceRef.current) {
        pendingEmptyPresenceRef.current = true;
        return;
      }
      pendingEmptyPresenceRef.current = false;

      setConnectedWallets(stableWallets);

      const nextPresence = new Set(stableWallets.map((entry) => entry.wallet));
      const previousPresence = previousPresenceRef.current;

      if (presenceBootedRef.current) {
        const joined = [...nextPresence].sort().filter(
          (w) => !previousPresence.has(w) && w !== actorId && !w.startsWith('anon:')
        );
        const left = [...previousPresence].sort().filter(
          (w) => !nextPresence.has(w) && w !== actorId && !w.startsWith('anon:')
        );
        presenceDeltaRef.current = { joined, left };
      } else {
        presenceDeltaRef.current = { joined: [], left: [] };
      }

      previousPresenceRef.current = nextPresence;
      presenceBootedRef.current = true;
      setPresenceReady(true);
    } catch {
      setConnectedWallets([]);
      setPresenceReady(true);
    }
  }, [actorId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    loadPresence();
    const timer = setInterval(loadPresence, 30_000);
    window.addEventListener('focus', loadPresence);
    window.addEventListener('mm3-presence-changed', loadPresence);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', loadPresence);
      window.removeEventListener('mm3-presence-changed', loadPresence);
    };
  }, [loadPresence]);

  useEffect(() => {
    const build = () => {
      if (!presenceReady) return;
      const walletParts = connectedWallets.map((u) => formatWalletLabel(u.wallet));
      const n = walletParts.length;
      const walletLabel = t('relaying.wallets');
      const listPart = n === 0
        ? t('relaying.mainframeQuiet')
        : t('relaying.mainframeNodes').replace('{count}', n).replace('{walletLabel}', walletLabel) + walletParts.join(' · ');

      const { joined, left } = presenceDeltaRef.current;
      presenceDeltaRef.current = { joined: [], left: [] };

      const text = listPart;

      const signature = walletParts.join('|');
      if (signature === lastRelayStatusRef.current && joined.length === 0 && left.length === 0) return;
      lastRelayStatusRef.current = signature;

      const isFirstRelay = !relayStatusBootedRef.current;
      relayStatusBootedRef.current = true;
      const statusHash = stableHash(`${signature}:${text}`);

      const relayStatusMessage = makeMessage({
        id: `relay-status:${statusHash}`,
        kind: 'system',
        wallet: 'system',
        text,
        ts: isFirstRelay ? welcomeTsRef.current + 1 : Date.now() + 100,
        tone: 'ghost',
        replaceGroup: 'relay-status',
        replaceBatchId: `relay:${statusHash}`,
      });

      appendMessage(relayStatusMessage, { silent: false });
    };

    build();
  }, [appendAndBroadcastMessage, appendMessage, connectedWallets, language, presenceReady, t]);

  // Generate all current market status messages
  const generateMarketStatusMessages = useCallback(async (actorIdForId) => {
    const marketMessages = [];
    try {
      const nowIso = new Date().toISOString();
      const [{ data: ownersData }, { data: commandsData }, { data: blocksData }, { data: penaltiesData }] = await Promise.all([
        supabase
          .from('player_progress')
          .select('wallet, mining_nftji_key')
          .not('mining_nftji_key', 'is', null),
          supabase
            .from('mm3_mining_commands')
            .select('id, nftji_key, formula_x, reset_at, wallet')
            .gt('reset_at', nowIso),
        supabase
          .from('mm3_mining_blocks')
          .select('block_key, emoji, grid_row, grid_col, title_en, title_es, price_eur, market_command, is_active'),
        supabase
          .from('mm3_command_penalties')
          .select('command_id, nftji_key, wallet')
          .is('redeemed_at', null),
      ]);
      marketMessages.push(...buildMarketStatusLines({ ownersData, commandsData, blocksData, penaltiesData }));
    } catch {}

    const ts = Date.now();
    return marketMessages.map((text, i) => makeMessage({
      id: `market-status:${ts}:${i}:${actorIdForId}`,
      kind: 'system',
      wallet: 'system',
      text,
      ts: ts + i,
      tone: 'market',
    }));
  }, [buildMarketStatusLines]);

  // Append market status traces when the state changes (keeps all user messages intact)
  const refreshMarketStatus = useCallback(async () => {
    const newMarketMessages = await generateMarketStatusMessages(actorId);
    if (newMarketMessages.length > 0) {
      const signature = getStatusSignature(newMarketMessages);
      if (signature === lastMarketStatusRef.current) return;
      lastMarketStatusRef.current = signature;
      const signatureHash = stableHash(signature);
      const statusTs = Date.now();
      newMarketMessages.forEach((message, index) => {
        const payload = {
          ...message,
          id: `market-status:${signatureHash}:${index}`,
          ts: statusTs + index,
          replaceGroup: 'market-status',
          replaceBatchId: `market:${signatureHash}`,
        };
        appendAndBroadcastMessage(payload, { silent: false });
      });
    }
  }, [appendAndBroadcastMessage, generateMarketStatusMessages, actorId]);

  useEffect(() => {
    refreshMarketStatusRef.current = refreshMarketStatus;
  }, [refreshMarketStatus]);

  // Seed market status once; later database events append fresh traces.
  useEffect(() => {
    refreshMarketStatus();
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
      ? { exec: 'exec', affected: 'afectadas', buy: 'compra', resell: 'reventa', reset: 'penalización reset' }
      : { exec: 'exec', affected: 'affected', buy: 'buy', resell: 'resell', reset: 'penalty reset' };

    let pendingTimeouts = [];
    const scheduleTimeout = (fn, delay) => {
      const id = setTimeout(fn, delay);
      pendingTimeouts.push(id);
      return id;
    };

    const channel = supabase
      .channel('mm3-irc-market-commands-watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mm3_mining_commands' }, ({ new: rec }) => {
        const { emoji, hex } = resolveBlock(rec.nftji_key);
        const reset = formatResetIn(rec.reset_at, language);
        scheduleTimeout(async () => {
          try {
            const { data: penaltyRows } = await supabase
              .from('mm3_command_penalties')
              .select('wallet')
              .eq('command_id', rec.id);
            const affected = (penaltyRows || []).map((row) => formatWalletLabel(row.wallet)).join(' · ') || '0';
            appendAndBroadcastMessage(makeMessage({
              id: `market-event:on:${rec.id}`,
              kind: 'system',
              wallet: 'system',
              text: `${traceLabel.exec} >> ${emoji} ${hex} >> ${t('relaying.by')} ${formatWalletLabel(rec.wallet)} >> ${traceLabel.affected}: ${affected} >> reset ${reset}`,
              ts: Date.now(),
              tone: 'market',
            }), { silent: false });
          } catch {}
          refreshMarketStatus();
        }, 3000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mm3_mining_commands' }, async ({ new: rec }) => {
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
          text: `${traceLabel.reset} >> ${emoji} ${hex} >> ${releasedInfo} ${t('relaying.walletsReleased')}`,
          ts: Date.now(),
          tone: 'market',
        };
        appendAndBroadcastMessage(makeMessage(expiredPayload), { silent: false });
        // After detail trace, refresh grouped market status for all users
        scheduleTimeout(() => refreshMarketStatus(), 500);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mm3_mining_events' }, ({ new: rec }) => {
        if (rec?.event_type === 'nftji_claim') {
          window.dispatchEvent(new CustomEvent('mm3-db-updated'));
          return;
        }
        if (!['mining_buy', 'mining_resell'].includes(rec?.event_type)) return;
        const { emoji, hex } = resolveBlockByEmoji(rec.emoji);
        const action = rec.event_type === 'mining_buy' ? traceLabel.buy : traceLabel.resell;
        appendAndBroadcastMessage(makeMessage({
          id: `market-event:${rec.event_type}:${rec.id || rec.created_at || Date.now()}`,
          kind: 'system',
          wallet: 'system',
          text: `${action} >> ${emoji}${hex ? ` ${hex}` : ''} >> ${formatWalletLabel(rec.wallet)}`,
          ts: Date.now(),
          tone: 'market',
        }), { silent: false });
        scheduleTimeout(() => refreshMarketStatus(), 500);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mm3_relaying_messages',
        filter: 'tone=in.(market,realchain,kernelpanic,squeeze,join,leave,bot)',
      }, ({ new: rec }) => {
        const sourceTone = String(rec?.tone || '').toLowerCase();
        if (!['market', 'realchain', 'kernelpanic', 'squeeze', 'join', 'leave', 'bot'].includes(sourceTone)) return;
        const text = normalizeRelayMessage(rec?.text);
        if (!text) return;
        const isBot = sourceTone === 'bot';
        const fallbackWallet = sourceTone === 'realchain' ? 'realchain' : 'system';
        appendMessage(makeMessage({
          id: `db:${rec.wallet || fallbackWallet}:${rec.ts || rec.created_at || Date.now()}`,
          kind: isBot ? 'chat' : (rec.kind || 'system'),
          wallet: String(rec.wallet || fallbackWallet).toLowerCase(),
          text,
          ts: isNaN(Number(rec.ts)) ? new Date(rec.ts || rec.created_at || Date.now()).getTime() : Number(rec.ts),
          tone: isBot ? 'neutral' : sourceTone,
        }), { silent: false });
        if (sourceTone === 'market') scheduleTimeout(() => refreshMarketStatus(), 500);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mm3_command_penalties' }, ({ new: rec }) => {
        if (!rec?.redeemed_at || !rec?.attempted_at) return;
        scheduleTimeout(() => refreshMarketStatus(), 500);
      })
      .subscribe();

    return () => {
      pendingTimeouts.forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [appendAndBroadcastMessage, refreshMarketStatus, supabase, language, t]);

  const [chipMode, setChipMode] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = new URLSearchParams(window.location.search);
    const command = query.get('command');
    const chip = query.get('chip');
    if (chip) {
      setChipMode(true);
      if (command) setDraft(decodeURIComponent(command.replace(/\+/g, ' ')));
    } else if (normalizedWallet && command) {
      setDraft(command);
    }
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
      .from('mm3_mining_blocks')
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
    return entries.find((entry) => commandKey(entry.command) === normalized) || null;
  }, [loadMarketCommandEntries]);

  const showMarketCommandHelp = useCallback(async () => {
    try {
      const entries = await loadMarketCommandEntries();
      const moneyEntries = entries.filter((e) => e.effect !== 'mm3');
      const mm3Entries = entries.filter((e) => e.effect === 'mm3');
      const toLine = (entry) => {
        const block = blockByKeyRef.current.get(entry.key);
        const row = block?.grid_row ?? entry.grid_row;
        const col = block?.grid_col ?? entry.grid_col;
        const hex = row !== undefined && col !== undefined ? getBlockHex(row, col) : entry.key;
        return `${entry.emoji}  ${hex}   ${entry.command}`;
      };
      const helpLines = [
        language === 'es'
          ? `índice cmd :: ${entries.length} cmds cargados :: /?`
          : `cmd index :: ${entries.length} cmds loaded :: /?`,
        language === 'es'
          ? `numeric_code :: código 5 dígitos >> introducir en bloque Mining para cancelar penalización`
          : `numeric_code :: 5-digit code >> enter in Mining block detail to redeem penalty`,
        language === 'es'
          ? `mine block :: /mine block #029 >> mina un bloque libre si tu wallet y el valor global MM3 cumplen el requisito`
          : `mine block :: /mine block #029 >> mine a free board block if wallet level and global MM3 value meet the requirement`,
        language === 'es'
          ? `buy :: /buy #029 >> compra un bloque NFTJI libre (máx 1 por wallet)`
          : `buy :: /buy #029 >> purchase a free NFTJI block (max 1 per wallet)`,
        language === 'es'
          ? `resell :: /resell #029 >> revende el NFTJI que posees y recupera el 50% del precio`
          : `resell :: /resell #029 >> resell the NFTJI you own and recover 50% of the price`,
        language === 'es'
          ? `chain :: mina 1 bloque de la cadena Mining hoy >> recompensa €10 diaria`
          : `chain :: mine 1 Mining block chain cell today >> €10 daily reward`,
        t('relaying.execCmd'),
        language === 'es'
          ? `── MONEY RAIL ─── penalización en fiat ──────────────────────`
          : `── MONEY RAIL ─── penalty debits fiat ───────────────────────`,
        ...moneyEntries.map(toLine),
        language === 'es'
          ? `── MM3 RAIL ───── penalización en MM3 ───────────────────────`
          : `── MM3 RAIL ───── penalty debits MM3 ────────────────────────`,
        ...mm3Entries.map(toLine),
      ];
      helpLines.forEach((line, index) => {
        appendMessage(makeMessage({
          id: `sys:help:${Date.now()}:${index}`,
          kind: 'system',
          wallet: 'system',
          ts: Date.now() + index,
          tone: 'command',
          text: line,
        }), { silent: true });
      });
    } catch (err) {
      appendMessage(makeMessage({
        id: `sys:help:${Date.now()}`,
        kind: 'system',
        wallet: 'system',
        ts: Date.now(),
        tone: 'command',
        text: language === 'es'
          ? `índice cmd no disponible :: ${err?.message || 'mining DB offline'}`
          : `cmd index unavailable :: ${err?.message || 'mining DB offline'}`,
      }), { silent: true });
    }
  }, [appendMessage, language, loadMarketCommandEntries]);

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
          .select('wallet, mining_nftji_key, mm3_sold')
          .eq('wallet', normalizedWallet)
          .maybeSingle(),
        supabase
          .from('mm3_mining_commands')
          .select('id, wallet, reset_at')
          .eq('nftji_key', commandEntry.key)
          .gt('reset_at', nowIso)
          .order('executed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('mm3_mining_blocks')
          .select('block_key, emoji, grid_row, grid_col, title_en, title_es, price_eur, market_command')
          .eq('block_key', commandEntry.key)
          .maybeSingle(),
      ]);

      if (launcher?.mining_nftji_key !== commandEntry.key) {
        const hex = blockRow ? getBlockHex(blockRow.grid_row, blockRow.grid_col) : commandEntry.key;
        const emoji = blockRow?.emoji || commandEntry.emoji;
        await broadcastSystemMessage(`${t('relaying.commandRejected')} >> ${formatWalletLabel(normalizedWallet)} ${t('relaying.doesNotOwn')} ${hex}${emoji}`, 'command');
        return true;
      }

      if (existingCommand) {
        const reset = formatResetIn(existingCommand.reset_at, language);
        await broadcastSystemMessage(`${commandEntry.emoji} ${t('mining.launchLocked')} ${reset}`, 'command');
        return true;
      }

      if (!blockRow) {
        await broadcastSystemMessage(`${t('relaying.commandRejected')} >> ${t('relaying.noBlock')} ${commandEntry.key}`, 'command');
        return true;
      }

      const { x, code } = computeMarketCommandCode(commandEntry, normalizedWallet, dayWindow.dayKey, now.getTime());
      const { data: insertedCommand, error: commandError } = await supabase
        .from('mm3_mining_commands')
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
        .select('wallet, level, mining_nftji_key, eur_earned, usd_earned, cny_earned, mm3_sold')
        .limit(1000);
      if (progressError) throw new Error(`allProgress: ${progressError.message}`);

      const exemptWallets = new Set([normalizedWallet]);
      {
        const { data: pr } = await supabase
          .from('mm3_wallet_pool_members').select('pool_code').eq('wallet', normalizedWallet).maybeSingle();
        if (pr?.pool_code) {
          const { data: pm } = await supabase
            .from('mm3_wallet_pool_members').select('wallet').eq('pool_code', pr.pool_code);
          for (const m of pm || []) exemptWallets.add(String(m.wallet || '').toLowerCase());
        }
      }

      const priceEur = Number(blockRow.price_eur) || 0;
      const priceUsd = priceEur * (CNY_TO_USD / CNY_TO_EUR);
      const priceCny = priceEur / CNY_TO_EUR;
      const isMm3Command = commandEntry.effect === 'mm3';
      const penalties = [];
      const balanceUpdates = [];

      for (const row of allProgress || []) {
        const wallet = String(row.wallet || '').toLowerCase();
        if (!wallet || exemptWallets.has(wallet)) continue;
        if (row.mining_nftji_key === commandEntry.key) continue;
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
        `exec >> ${blockRow.emoji || commandEntry.emoji} >> cmd=${commandEntry.command} >> nonce=${x} >> ${penalties.length} ${t('mining.walletsPenalized')} >> reset ${formatResetIn(dayWindow.resetAt, language)}`,
        'market'
      );
      relayRef.current?.send({ type: 'broadcast', event: 'market-status-refresh', payload: { ts: Date.now() } }).catch(() => {});
      return true;
    } catch (err) {
      console.error('market command:', err);
      await broadcastSystemMessage(`${t('mining.commandFailed')} >> ${err?.message || 'mining daemon non-zero'}`, 'command');
      return true;
    }
  }, [broadcastSystemMessage, findMarketCommandInDb, language, normalizedWallet, t]);

  // /buy #hex — purchase a free NFTJI mining block (same backend as mine block)
  const processBuyNftjiCommand = useCallback(async (text) => {
    const match = String(text || '').trim().match(/^\/buy\s+(#?[0-9a-f]{1,3})$/i);
    if (!match || !normalizedWallet) return false;

    const blockHex = normalizeBlockHex(match[1]);
    const res = await fetch('/api/mine-block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: normalizedWallet, blockHex }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      if (data.trace) {
        appendAndBroadcastMessage(makeMessage({
          id: `db:system:${data.ts || Date.now()}`,
          kind: 'system', wallet: 'system',
          ts: Number(data.ts) || Date.now(),
          tone: 'market', text: data.trace,
        }), { silent: false });
        relayRef.current?.send({ type: 'broadcast', event: 'market-status-refresh', payload: { ts: Date.now() } }).catch(() => {});
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_dirty_at', String(Date.now()));
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet: normalizedWallet, minedBlock: blockHex } }));
      }
      return true;
    }
    const errMap = {
      requirements_not_met: language === 'es'
        ? `buy rechazado :: ${blockHex} requiere nivel o MM3 insuficiente`
        : `buy rejected :: ${blockHex} requires higher level or MM3`,
      already_mined: language === 'es'
        ? `buy rechazado :: ${blockHex} ya tiene dueño`
        : `buy rejected :: ${blockHex} already owned`,
      nftji_offline: language === 'es'
        ? `buy offline :: NFTJI no activo`
        : `buy offline :: NFTJI inactive`,
      already_owns_nftji: language === 'es'
        ? `buy rechazado :: revende tu NFTJI antes de comprar otro`
        : `buy rejected :: resell your NFTJI before buying another`,
      insufficient_funds: language === 'es'
        ? `buy rechazado :: fondos insuficientes`
        : `buy rejected :: insufficient funds`,
      block_not_mineable: language === 'es'
        ? `buy rechazado :: ${blockHex} no es un bloque NFTJI`
        : `buy rejected :: ${blockHex} is not an NFTJI block`,
    };
    appendMessage(makeMessage({
      id: `sys:buy:${Date.now()}`, kind: 'system', wallet: 'system',
      ts: Date.now(), tone: 'command',
      text: errMap[data.error] || (language === 'es' ? `buy rechazado :: ${blockHex}` : `buy rejected :: ${blockHex}`),
    }), { silent: true });
    return true;
  }, [appendAndBroadcastMessage, appendMessage, language, normalizedWallet]);

  // /resell #hex — resell an owned NFTJI mining block
  const processResellNftjiCommand = useCallback(async (text) => {
    const match = String(text || '').trim().match(/^\/resell\s+(#?[0-9a-f]{1,3})$/i);
    if (!match || !normalizedWallet) return false;

    const blockHex = normalizeBlockHex(match[1]);
    const res = await fetch('/api/resell-nftji', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: normalizedWallet, blockHex }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      if (data.trace) {
        appendAndBroadcastMessage(makeMessage({
          id: `db:system:${data.ts || Date.now()}`,
          kind: 'system', wallet: 'system',
          ts: Number(data.ts) || Date.now(),
          tone: 'market', text: data.trace,
        }), { silent: false });
        relayRef.current?.send({ type: 'broadcast', event: 'market-status-refresh', payload: { ts: Date.now() } }).catch(() => {});
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_dirty_at', String(Date.now()));
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet: normalizedWallet, special: true, market: true } }));
      }
      return true;
    }
    const errMap = {
      not_owned: language === 'es'
        ? `resell rechazado :: ${blockHex} no es tuyo`
        : `resell rejected :: ${blockHex} not owned by you`,
      block_not_nftji: language === 'es'
        ? `resell rechazado :: ${blockHex} no es un bloque NFTJI`
        : `resell rejected :: ${blockHex} is not an NFTJI block`,
    };
    appendMessage(makeMessage({
      id: `sys:resell:${Date.now()}`, kind: 'system', wallet: 'system',
      ts: Date.now(), tone: 'command',
      text: errMap[data.error] || (language === 'es' ? `resell rechazado :: ${blockHex}` : `resell rejected :: ${blockHex}`),
    }), { silent: true });
    return true;
  }, [appendAndBroadcastMessage, appendMessage, language, normalizedWallet]);

  const processMineBlockCommand = useCallback(async (text) => {
    const match = String(text || '').trim().match(/^\/mine\s+block\s+(#?[0-9a-f]{1,3})$/i);
    if (!match || !normalizedWallet) return false;

    const blockHex = normalizeBlockHex(match[1]);
    const requirement = MM3_BLOCK_REQUIREMENT_BY_HEX.get(blockHex);
    if (!requirement) {
      appendMessage(makeMessage({
        id: `sys:mine:${Date.now()}`,
        kind: 'system',
        wallet: 'system',
        ts: Date.now(),
        tone: 'command',
        text: language === 'es'
          ? `mine block rechazado :: ${blockHex || match[1]} no pertenece a la cadena minable`
          : `mine block rejected :: ${blockHex || match[1]} is not in the mineable chain`,
      }), { silent: true });
      return true;
    }

    const res = await fetch('/api/mine-block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: normalizedWallet, blockHex }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      if (data.trace) {
        appendAndBroadcastMessage(makeMessage({
          id: `db:system:${data.ts || Date.now()}`,
          kind: 'system',
          wallet: 'system',
          ts: Number(data.ts) || Date.now(),
          tone: 'market',
          text: data.trace,
        }), { silent: false });
        relayRef.current?.send({ type: 'broadcast', event: 'market-status-refresh', payload: { ts: Date.now() } }).catch(() => {});
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_dirty_at', String(Date.now()));
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet: normalizedWallet, minedBlock: blockHex } }));
      }
      return true;
    }

    const textByError = {
      requirements_not_met: language === 'es'
        ? `mine block rechazado :: ${blockHex} requiere ${data.requirement || formatBlockRequirement(requirement)}`
        : `mine block rejected :: ${blockHex} requires ${data.requirement || formatBlockRequirement(requirement)}`,
      already_mined: language === 'es'
        ? `mine block rechazado :: ${blockHex} ya minado por ${formatWalletLabel(data.owner || '')}`
        : `mine block rejected :: ${blockHex} already mined by ${formatWalletLabel(data.owner || '')}`,
      nftji_offline: language === 'es'
        ? `mine block offline :: NFTJI no activo`
        : `mine block offline :: NFTJI inactive`,
      already_owns_nftji: language === 'es'
        ? `mine block rechazado :: revende tu NFTJI antes de minar otro`
        : `mine block rejected :: resell your NFTJI before mining another`,
      insufficient_funds: language === 'es'
        ? `mine block rechazado :: fondos insuficientes para este NFTJI`
        : `mine block rejected :: insufficient funds for this NFTJI`,
      block_chain_not_installed: language === 'es'
        ? `mine block offline :: tabla mm3_mined_blocks no instalada`
        : `mine block offline :: mm3_mined_blocks table not installed`,
    };
    appendMessage(makeMessage({
      id: `sys:mine:${Date.now()}`,
      kind: 'system',
      wallet: 'system',
      ts: Date.now(),
      tone: 'command',
      text: textByError[data.error] || (language === 'es' ? `mine block rechazado :: ${blockHex}` : `mine block rejected :: ${blockHex}`),
    }), { silent: true });
    return true;
  }, [appendAndBroadcastMessage, appendMessage, language, normalizedWallet]);

  const handleSend = async (event) => {
    event.preventDefault();
    const text = normalizeRelayMessage(draft);
    if (!text) return;

    // Allow anon to use /rm -rf MM3_BLOCK_CHAIN when arriving via chip link
    const isRmRfCommand = /^\/rm\s+-rf\s+MM3_BLOCK_CHAIN$/i.test(text);
    if (!normalizedWallet && !(chipMode && isRmRfCommand)) return;

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

      // /rm -rf MM3_BLOCK_CHAIN — kernel panic chain wipe
      if (isRmRfCommand) {
        const query = new URLSearchParams(window.location.search);
        const chip = Number(query.get('chip')) || 1;
        try {
          const res = await fetch('/api/rm-rf-chain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chip, wallet: normalizedWallet || 'anon' }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            const cooldownMsg = data.error === 'cooldown_active'
              ? (language === 'es'
                ? `acceso denegado :: chip #${chip} en cooldown :: cadena ya reseteada :: espera 24h`
                : `access denied :: chip #${chip} on cooldown :: chain already wiped :: wait 24h`)
              : (language === 'es'
                ? `error :: /rm -rf MM3_BLOCK_CHAIN rechazado :: ${data.error || 'internal'}`
                : `error :: /rm -rf MM3_BLOCK_CHAIN rejected :: ${data.error || 'internal'}`);
            appendMessage(makeMessage({
              id: `sys:rmrf:${Date.now()}`,
              kind: 'system', wallet: 'system', ts: Date.now(), tone: 'command',
              text: cooldownMsg,
            }), { silent: true });
          } else {
            const trace = language === 'es' ? data.trace_es : data.trace_en;
            await broadcastSystemMessage(trace, 'kernelpanic');
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { chainReset: true } }));
            }
          }
        } catch {
          appendMessage(makeMessage({
            id: `sys:rmrf:${Date.now()}`,
            kind: 'system', wallet: 'system', ts: Date.now(), tone: 'command',
            text: language === 'es' ? 'error :: fallo de red :: /rm -rf MM3_BLOCK_CHAIN' : 'error :: network failure :: /rm -rf MM3_BLOCK_CHAIN',
          }), { silent: true });
        }
        return;
      }

      // /exec @wallet — relay exec link
      if (cmdName === 'exec') {
        const match = afterSlash.match(/^exec\s+@(\S+)/i);
        if (!match) {
          appendMessage(makeMessage({
            id: `sys:exec:${Date.now()}`,
            kind: 'system', wallet: 'system', ts: Date.now(), tone: 'command',
            text: language === 'es' ? 'uso: /exec @wallet' : 'usage: /exec @wallet',
          }), { silent: true });
          return;
        }
        const targetRaw = match[1].toLowerCase();
        const targetWallet = targetRaw.startsWith('0x') ? targetRaw : null;
        const onlineWallet = connectedWallets.find((u) => u.wallet === targetWallet || formatWalletLabel(u.wallet) === targetRaw);
        if (!onlineWallet) {
          appendMessage(makeMessage({
            id: `sys:exec:${Date.now()}`,
            kind: 'system', wallet: 'system', ts: Date.now(), tone: 'command',
            text: t('relaying.execTargetOffline'),
          }), { silent: true });
          return;
        }
        try {
          const res = await fetch('/api/relay/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet: normalizedWallet, targetWallet: onlineWallet.wallet }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            const errMap = {
              exec_self: t('relaying.execSelf'),
              target_offline: t('relaying.execTargetOffline'),
              cooldown_active: t('relaying.execCooldown'),
            };
            appendMessage(makeMessage({
              id: `sys:exec:${Date.now()}`,
              kind: 'system', wallet: 'system', ts: Date.now(), tone: 'command',
              text: errMap[data.error] || t('relaying.execFailed'),
            }), { silent: true });
          } else {
            const trace = `🔁 relay exec >> ${formatWalletLabel(normalizedWallet)} → ${formatWalletLabel(onlineWallet.wallet)} >> execs: #${data.originExecs.toString(16).toUpperCase()} + #${data.targetExecs.toString(16).toUpperCase()} >> lv.${data.level} >> Δmm3:${data.relayDelta >= 0 ? '+' : ''}${Number(data.relayDelta || 0).toFixed(6)}`;
            await broadcastSystemMessage(trace, 'market');
            try {
              await supabase.from('mm3_relaying_messages').insert({
                wallet: 'system', text: trace, ts: Date.now(), kind: 'system', tone: 'market',
              });
            } catch {}
            if (typeof window !== 'undefined') {
              localStorage.setItem('lb_dirty_at', String(Date.now()));
              window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet: normalizedWallet, relayExec: true } }));
            }
          }
        } catch {
          appendMessage(makeMessage({
            id: `sys:exec:${Date.now()}`,
            kind: 'system', wallet: 'system', ts: Date.now(), tone: 'command',
            text: t('relaying.execFailed'),
          }), { silent: true });
        }
        return;
      }

      if (await processBuyNftjiCommand(text)) {
        return;
      }

      if (await processResellNftjiCommand(text)) {
        return;
      }

      if (await processMineBlockCommand(text)) {
        return;
      }

      // Public Mining commands are loaded from DB and can use any slash name.
      if (await processMarketCommand(text)) {
        return;
      }

      try {
        const entries = await loadMarketCommandEntries();
        const normalizedText = normalizeCommandText(text);
        const malformedPublicCommand = entries.find((entry) => {
          const commandHead = getSlashHead(entry.command);
          if (!commandHead) return false;
          if (commandKey(entry.command) === normalizedText) return false;
          return cmdName === commandHead || cmdName.startsWith(commandHead);
        });
        if (malformedPublicCommand) {
          const hackText = language === 'es'
            ? `ERR: intento de hackeo del sistema >> wallet=${formatWalletLabel(normalizedWallet)} >> input=${text} >> expected=${malformedPublicCommand.command}`
            : `ERR: system hack attempt >> wallet=${formatWalletLabel(normalizedWallet)} >> input=${text} >> expected=${malformedPublicCommand.command}`;
          await broadcastSystemMessage(hackText, 'command');
          try {
            await supabase.from('mm3_relaying_messages').insert({
              wallet: 'system', text: hackText, ts: Date.now(), kind: 'system', tone: 'command',
            });
          } catch {}
          return;
        }
      } catch {}

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
            await broadcastSystemMessage(trace, 'command');
            try {
              await supabase.from('mm3_relaying_messages').insert({
                wallet: 'system', text: trace, ts: Date.now(), kind: 'system', tone: 'command',
              });
            } catch {}
            if (typeof window !== 'undefined') {
              localStorage.setItem('lb_dirty_at', String(Date.now()));
              window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet: normalizedWallet } }));
            }
          } else {
            const errorMsg = language === 'es'
              ? ({
                  level_too_low: `acceso denegado :: nivel insuficiente para /${cmdName}`,
                  command_not_active: 'acceso denegado :: comando Mining público no activo hoy para este bloque',
                  already_executed_today: 'acceso denegado :: cuota diaria del comando agotada',
                }[data.error] || `acceso denegado :: /${cmdName} rechazado`)
              : ({
                  level_too_low: `access denied :: level insufficient for /${cmdName}`,
                  command_not_active: 'access denied :: public Mining command not active for this block today',
                  already_executed_today: 'access denied :: command quota exhausted for today',
                }[data.error] || `access denied :: /${cmdName} rejected`);
            appendMessage(makeMessage({
              id: `sys:err:${Date.now()}`,
              kind: 'system', wallet: 'system', ts: Date.now(), tone: 'command',
              text: errorMsg,
            }), { silent: true });
          }
          return;
        }
      } catch {}

      // Unknown command — local error only
      appendMessage(makeMessage({
        id: `sys:err:${Date.now()}`,
        kind: 'system', wallet: 'system', ts: Date.now(), tone: 'command',
        text: language === 'es'
          ? `comando no encontrado :: /${cmdName || '?'} :: usa /?`
          : `command not found :: /${cmdName || '?'} :: type /?`,
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
      await supabase.from('mm3_relaying_messages').insert({
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
            overflow: hidden;
          }
          /* Aside: one-line strip showing only the wallet count */
          .mm3-irc-shell > aside {
            order: -1;
            flex: 0 0 auto;
            padding: 0.22rem 0.5rem;
          }
          /* Hide the wallet name list — only the count header stays */
          .mm3-irc-aside-inner {
            display: none;
          }
          /* Chat section: grows to fill remaining height */
          .mm3-irc-shell > section {
            flex: 1 1 0;
            min-height: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            padding: 0.4rem 0.55rem calc(0.4rem + env(safe-area-inset-bottom, 0px));
          }
          /* Section header and form: fixed size */
          .mm3-irc-shell > section > div:first-child,
          .mm3-irc-shell > section > form,
          .mm3-irc-shell > section > div:last-child {
            flex: 0 0 auto;
          }
          /* Filters: single scrollable row — no line wrap */
          .mm3-irc-filters {
            flex-wrap: nowrap;
            overflow-x: auto;
            scrollbar-width: none;
            gap: 0.22rem;
            margin: 0 0 0.28rem;
            padding: 0 0.1rem 0.22rem;
          }
          .mm3-irc-filters::-webkit-scrollbar { display: none; }
          /* Compact send form on mobile */
          .mm3-irc-shell > section > form { margin-top: 0.25rem; }
          .mm3-irc-submit {
            padding-top: 0.3rem !important;
            padding-bottom: 0.3rem !important;
            font-size: 0.63rem !important;
          }
          .mm3-irc-shell > section > form input {
            padding-top: 0.3rem !important;
            padding-bottom: 0.3rem !important;
            font-size: 0.80rem !important;
          }
          /* Remove border-b from channel header row on mobile */
          .mm3-irc-header-row {
            border-bottom: none !important;
            padding-bottom: 0.4rem;
          }
          /* Chat log: takes all leftover space inside section */
          .mm3-relaying-chat-log {
            flex: 1 1 0;
            min-height: 0;
            max-height: none;
            overflow-y: auto;
          }
          .mm3-irc-peer-row {
            padding-top: 0.06rem;
            padding-bottom: 0.06rem;
            font-size: 0.58rem;
          }
          .mm3-irc-group-label {
            margin-top: 0.12rem;
            font-size: 0.46rem;
          }
        }
        .mm3-relaying-panel {
          border: 1px solid rgba(34, 211, 238, 0.16);
          background: rgba(0,0,0,0.86);
        }
        .mm3-relaying-chat-log {
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
        .mm3-irc-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin: -0.1rem 0 0.45rem;
          padding: 0 0.15rem 0.35rem;
          border-bottom: 1px solid rgba(34, 211, 238, 0.10);
          font-family: var(--font-geist-mono), monospace;
        }
        .mm3-irc-filter {
          display: inline-flex;
          align-items: center;
          gap: 0.28rem;
          border: 1px solid rgba(34, 211, 238, 0.16);
          background: rgba(2, 6, 23, 0.55);
          padding: 0.22rem 0.42rem;
          color: rgba(165, 243, 252, 0.78);
          font-size: 0.58rem;
          font-weight: 900;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          cursor: pointer;
          user-select: none;
        }
        .mm3-irc-filter input {
          width: 0.72rem;
          height: 0.72rem;
          accent-color: #22d3ee;
        }
        .mm3-irc-filter[data-active='false'] {
          color: rgba(100, 116, 139, 0.82);
          border-color: rgba(100, 116, 139, 0.18);
          opacity: 0.68;
        }
        .mm3-irc-line {
          border-bottom: 1px solid rgba(34, 211, 238, 0.06);
        }
        .mm3-irc-line:last-child {
          border-bottom: none;
        }
        /* ── IRC fixed colour palette ── */
        .mm3-irc-line.system                       {
          color: #f8fafc;
          text-shadow: 0 0 8px rgba(248, 250, 252, 0.12);
        }
        .mm3-irc-line.system[data-tone='accent']   {
          color: var(--irc-accent, #22d3ee);
          text-shadow: 0 0 8px color-mix(in srgb, var(--irc-accent, #22d3ee) 18%, transparent);
        }
        .mm3-irc-line.system[data-tone='market']   {
          color: #facc15;
          text-shadow: 0 0 8px rgba(250, 204, 21, 0.16);
        }
        .mm3-irc-line.system[data-tone='squeeze']  {
          color: #22d3ee;
          text-shadow: 0 0 8px rgba(34, 211, 238, 0.18);
        }
        .mm3-irc-line.system[data-tone='realchain'] {
          color: #a78bfa;
          text-shadow: 0 0 10px rgba(167, 139, 250, 0.28);
        }
        .mm3-irc-line.system[data-tone='kernelpanic'] {
          color: #ef4444;
          text-shadow: 0 0 12px rgba(239, 68, 68, 0.45);
        }
        .mm3-irc-line.system[data-tone='command']  {
          color: #4ade80;
          text-shadow: 0 0 8px rgba(74, 222, 128, 0.18);
        }
        .mm3-irc-line.system[data-tone='ghost']    { color: #f8fafc; }
        .mm3-irc-line.system[data-tone='join']     { color: #4ade80; text-shadow: 0 0 8px rgba(74, 222, 128, 0.18); }
        .mm3-irc-line.system[data-tone='leave']    { color: #1d4ed8; text-shadow: 0 0 8px rgba(29, 78, 216, 0.22); }
        .mm3-irc-line.system > span,
        .mm3-irc-line.system .mm3-irc-author       { color: inherit; }
        .mm3-irc-line.system[data-error='true'] .mm3-irc-msg-text {
          color: #f87171;
          text-shadow: 0 0 8px rgba(248, 113, 113, 0.22);
        }
        .mm3-irc-line.self   .mm3-irc-msg-text,
        .mm3-irc-line.other  .mm3-irc-msg-text     { color: #e2e8f0; }
        .mm3-irc-line.system .mm3-irc-msg-text     { color: inherit; }
        .mm3-irc-line.system[data-error='true'] .mm3-irc-msg-text {
          color: #f87171;
          text-shadow: 0 0 8px rgba(248, 113, 113, 0.22);
        }
        .mm3-irc-line { word-break: break-word; overflow-wrap: break-word; }
        .mm3-irc-author { word-break: break-all; }
        .mm3-irc-line.chat .mm3-irc-author,
        .mm3-irc-line.self .mm3-irc-author,
        .mm3-irc-line.other .mm3-irc-author {
          cursor: pointer;
        }
        @media (max-width: 639px) {
          .mm3-irc-time   { letter-spacing: 0.04em; font-size: 0.66rem; }
          .mm3-irc-author { letter-spacing: 0.02em !important; font-size: 0.66rem !important; }
          .mm3-irc-msg-text { font-size: 0.86rem !important; }
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
        .mm3-irc-group-label {
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
        .mm3-irc-wallet-link {
          cursor: pointer;
          text-decoration: none;
          font-weight: 600;
          letter-spacing: 0.04em;
          transition: opacity 0.12s;
        }
        .mm3-irc-wallet-link:hover {
          opacity: 0.7;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .mm3-irc-block-link {
          cursor: pointer;
          color: #facc15;
          font-weight: 700;
          letter-spacing: 0.05em;
          transition: opacity 0.12s, text-shadow 0.12s;
        }
        .mm3-irc-block-link:hover {
          opacity: 0.8;
          text-decoration: underline;
          text-underline-offset: 2px;
          text-shadow: 0 0 6px #facc1588;
        }
        .mm3-irc-pool-link {
          cursor: pointer;
          color: #22d3ee;
          font-weight: 800;
          letter-spacing: 0.05em;
          transition: opacity 0.12s, text-shadow 0.12s;
        }
        .mm3-irc-pool-link:hover {
          opacity: 0.8;
          text-decoration: underline;
          text-underline-offset: 2px;
          text-shadow: 0 0 6px rgba(34, 211, 238, 0.45);
        }
        .mm3-irc-chain-link {
          cursor: pointer;
          color: #4ade80;
          font-weight: 700;
          letter-spacing: 0.04em;
          transition: opacity 0.12s, text-shadow 0.12s;
        }
        .mm3-irc-chain-link:hover {
          opacity: 0.8;
          text-decoration: underline;
          text-underline-offset: 2px;
          text-shadow: 0 0 6px rgba(74, 222, 128, 0.5);
        }
      `}</style>

      <div className="mm3-irc-shell">
        <section className="mm3-relaying-panel rounded-sm p-2.5">
          <div className="mm3-irc-header-row max-sm:portrait:hidden mb-2 flex items-center justify-between gap-1 sm:border-b sm:border-cyan-500/12 pb-2 font-mono">
            <div className="shrink-0 text-[0.70rem] sm:text-[0.80rem] uppercase tracking-[0.16em] text-slate-500">#relay-mainframe</div>
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
              <span className={`shrink-0 text-[0.65rem] sm:text-[0.75rem] uppercase tracking-[0.16em] ${normalizedWallet ? 'text-cyan-700' : 'text-amber-700/70'}`}>
                {!normalizedWallet ? t('relaying.readOnly') : (relayReady ? t('relaying.live') : t('relaying.syncing'))}
              </span>
              <span className={`truncate text-[0.72rem] sm:text-[0.82rem] ${normalizedWallet ? 'text-cyan-200' : 'text-slate-500'}`}>
                {formatIrcWalletLabel(actorId)}
              </span>
            </div>
          </div>

          <div className="mm3-irc-filters" aria-label="IRC message filters">
            {IRC_FILTER_TYPES.map((key) => (
              <label key={key} className="mm3-irc-filter" data-active={messageFilters[key] !== false}>
                <input
                  type="checkbox"
                  checked={messageFilters[key] !== false}
                  onChange={() => toggleMessageFilter(key)}
                />
                <span>{filterLabels[key]}</span>
              </label>
            ))}
          </div>

          <div className="mm3-relaying-chat-log rounded-sm border border-cyan-500/12 px-2.5 py-1.5 font-mono">
            {visibleMessages.length > 0 ? visibleMessages.map((message) => {
              const isSelf = message.kind === 'chat' && message.wallet === normalizedWallet;
              const lineMode = message.kind === 'system' ? 'system' : isSelf ? 'self' : 'other';
              const isSystem = message.kind === 'system';
              const ownedMarketEmojis = message.kind === 'chat' ? (marketClaimsByWallet[message.wallet] || []) : [];
              const author = isSystem
                ? formatSystemAuthor(message.tone)
                : formatChatAuthor(message.wallet, normalizedWallet, t('relaying.you'));
              const displayText = isSystem
                ? `#${localizeLegacySystemPromptText(message.text, language)}`
                : `#${message.text}`;
              const isErrorOrPenalty = isSystem && isErrorOrPenaltyMessage(message.text, message.tone);
              const handleWalletClick = (addr) => {
                if (typeof window === 'undefined') return;
                localStorage.setItem('mm3_leaderboard_wallet', addr);
                router.push('/ranking');
              };
              const handlePoolClick = (poolCode) => {
                if (typeof window === 'undefined') return;
                localStorage.setItem('mm3_leaderboard_pool', String(poolCode || '').toUpperCase());
                router.push('/ranking');
              };
              const handleBlockHexClick = (blockKey) => {
                router.push(`/mining?block=${blockKey}`);
              };
              const handleChainClick = message.wallet && message.wallet !== 'system' ? async () => {
                try {
                  const { data } = await supabase
                    .from('mm3_mined_blocks')
                    .select('block_hex')
                    .eq('wallet', String(message.wallet).toLowerCase())
                    .order('chain_index', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  if (data?.block_hex) {
                    const idx = parseInt(String(data.block_hex).replace(/^#/, ''), 16);
                    if (Number.isFinite(idx)) router.push(`/mining?block=ph-${Math.floor(idx / 28)}-${idx % 28}`);
                  }
                } catch (e) { console.error('chain click:', e); }
              } : undefined;
              const blockLinkMap = (() => {
                const map = new Map();
                for (const [key, block] of blockByKeyRef.current) {
                  const fallbackLink = { key, label: block.emoji ? `${block.emoji} ${key}` : key };
                  map.set(String(key).toLowerCase(), fallbackLink);
                  if (block.grid_row != null && block.grid_col != null) {
                    const hex = getBlockHex(block.grid_row, block.grid_col);
                    const label = `${block.emoji || ''} ${hex}`.trim();
                    const link = { key, label };
                    map.set(String(key).toLowerCase(), link);
                    map.set(hex, link);
                    map.set(hex.toLowerCase(), link);
                  }
                }
                return map;
              })();

              return (
                <div
                  key={message.id}
                  className={`mm3-irc-line ${lineMode} px-1 py-1.5`}
                  data-tone={message.tone}
                  data-error={isErrorOrPenalty ? 'true' : undefined}
                >
                  <span className="mm3-irc-time text-[0.76rem] uppercase tracking-[0.14em] text-slate-500">
                    {formatRelayTime(message.ts, language)}
                  </span>
                  {' '}
                  {message.kind === 'chat' && (
                    <>
                      <span className="inline-flex items-center gap-[0.12rem]">
                        <FlagImg cc={walletFlags[message.wallet]} style={{ height: '0.65rem' }} />
                        {ownedMarketEmojis.map((emoji, index) => (
                          <span key={`${message.wallet}-${emoji}-${index}`} className="mm3-irc-wallet-emoji">{emoji}</span>
                        ))}
                      </span>
                      {' '}
                    </>
                  )}
                  <span
                    className="mm3-irc-author text-[0.80rem] uppercase tracking-[0.13em]"
                    style={message.kind === 'chat' ? { color: colorFromAddress(message.wallet) } : undefined}
                    title={message.kind === 'chat' ? message.wallet : undefined}
                    onClick={message.kind === 'chat' ? () => handleWalletClick(message.wallet) : undefined}
                    role={message.kind === 'chat' ? 'button' : undefined}
                  >{author}</span>
                  {' '}
                  <span className="mm3-irc-msg-text text-[0.95rem] leading-relaxed">
                    {renderIrcTextLinks(displayText, message.tone, handleWalletClick, blockLinkMap, handleBlockHexClick, poolCodes, handlePoolClick, handleChainClick)}
                  </span>
                </div>
              );
            }) : (
              <div className="px-1 py-2 text-[0.88rem] uppercase tracking-[0.14em] text-slate-500">
                {messages.length > 0
                  ? (language === 'es' ? 'activa filtros para ver trazas del sistema' : 'enable filters to show system traces')
                  : t('relaying.empty')}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {(normalizedWallet || chipMode) ? (
            <form onSubmit={handleSend} className="mt-2 flex flex-col gap-1">
              {chipMode && !normalizedWallet && (
                <div className="flex items-center gap-2 border border-red-500/20 bg-red-950/10 px-2.5 py-1 font-mono mb-1">
                  <span className="text-red-500/70 text-[0.5rem]">▶</span>
                  <span className="text-[0.72rem] uppercase tracking-[0.18em] text-red-700/70">
                    {language === 'es' ? 'modo kernel :: anónimo :: solo /rm -rf MM3_BLOCK_CHAIN' : 'kernel mode :: anonymous :: only /rm -rf MM3_BLOCK_CHAIN'}
                  </span>
                </div>
              )}
              {atSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 rounded-sm border border-cyan-500/20 bg-black/90 px-2 py-1">
                  {atSuggestions.map((w, i) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        const parts = draft.split('@');
                        const newDraft = parts.slice(0, -1).join('@') + `@${w} `;
                        setDraft(newDraft);
                        setAtSuggestions([]);
                        inputRef.current?.focus();
                      }}
                      className="font-mono text-[0.68rem] uppercase tracking-[0.12em] transition"
                      style={{ color: i === atSuggestIdx ? '#22d3ee' : 'rgba(100,116,139,0.75)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 0.2rem' }}
                    >
                      @{formatWalletLabel(w)}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => {
                    if (chipMode && !normalizedWallet) return;
                    const val = event.target.value;
                    setDraft(val);
                    const atMatch = val.match(/@(\S*)$/);
                    if (atMatch) {
                      const query = atMatch[1].toLowerCase();
                      const suggestions = connectedWallets
                        .filter((u) => u.wallet !== normalizedWallet && (query === '' || u.wallet.includes(query) || formatWalletLabel(u.wallet).toLowerCase().includes(query)))
                        .slice(0, 6)
                        .map((u) => u.wallet);
                      setAtSuggestions(suggestions);
                      setAtSuggestIdx(0);
                    } else {
                      setAtSuggestions([]);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (atSuggestions.length === 0) return;
                    if (event.key === 'ArrowDown') { event.preventDefault(); setAtSuggestIdx((i) => (i + 1) % atSuggestions.length); }
                    else if (event.key === 'ArrowUp') { event.preventDefault(); setAtSuggestIdx((i) => (i - 1 + atSuggestions.length) % atSuggestions.length); }
                    else if (event.key === 'Tab' || event.key === 'Enter' && atSuggestions.length > 0) {
                      event.preventDefault();
                      const w = atSuggestions[atSuggestIdx];
                      const parts = draft.split('@');
                      setDraft(parts.slice(0, -1).join('@') + `@${w} `);
                      setAtSuggestions([]);
                    } else if (event.key === 'Escape') {
                      setAtSuggestions([]);
                    }
                  }}
                  placeholder={t('relaying.inputPlaceholder')}
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
                  {t('relaying.send')}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-2 flex items-center gap-2 border border-amber-500/12 bg-amber-950/10 px-2.5 py-1.5 font-mono">
              <span className="text-amber-600/70 text-[0.5rem]">▶</span>
              <span className="text-[0.80rem] uppercase tracking-[0.2em] text-amber-700/60">{t('relaying.readOnlyHint')}</span>
            </div>
          )}
        </section>

        <aside className="mm3-relaying-panel rounded-sm p-2.5">
          <div className="border-b border-cyan-500/12 pb-1.5 font-mono">
            <div className="flex items-baseline justify-end gap-[3px] text-[0.70rem] font-black tabular-nums">
              <span className="text-slate-600 text-[0.58rem]">WALLETS</span>
              <span className="text-emerald-400">{relayGroups.wallets.length}</span>
              <span className="text-slate-700 mx-[1px]">·</span>
              <span className="text-slate-600 text-[0.58rem]">ANON</span>
              <span className="text-cyan-700">{anonUsers.length}</span>
            </div>
          </div>

          <div className="mm3-irc-aside-inner mt-1.5">
            {relayGroups.wallets.length > 0 ? (
              <>
                <div className="mm3-irc-group-label">WALLETS</div>
                {relayGroups.wallets.slice(0, visibleCount).map((entry) => {
                  const isYou = entry.wallet === actorId;
                  const isAnon = entry.source === 'anon' || entry.wallet.startsWith('anon:');
                  const label = isYou
                    ? `${formatIrcWalletLabel(entry.wallet)} (${t('relaying.you')})`
                    : formatIrcWalletLabel(entry.wallet);
                  const emojis = isAnon ? [] : (marketClaimsByWallet[entry.wallet] || []);
                  const srcLabel = isAnon ? 'A' : (entry.source === 'google' ? 'G' : 'W');
                  const peerColor = isAnon ? undefined : colorFromAddress(entry.wallet);
                  return (
                    <div
                      key={entry.wallet}
                      className={`mm3-irc-peer-row${isAnon && !isYou ? ' is-anon' : ''}`}
                      style={peerColor ? { color: peerColor } : undefined}
                      title={isAnon ? t('relaying.readOnly') : entry.wallet}
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
                {visibleCount < relayGroups.wallets.length && (
                  <button
                    className="mm3-irc-show-more"
                    onClick={() => setVisibleCount((v) => v + 5)}
                  >
                    {`+ ${Math.min(5, relayGroups.wallets.length - visibleCount)} ${t('relaying.more')}`}
                  </button>
                )}
                {visibleCount > 5 && relayGroups.wallets.length <= visibleCount && (
                  <button
                    className="mm3-irc-show-more"
                    onClick={() => setVisibleCount(5)}
                  >
                    ▲ {t('relaying.collapse')}
                  </button>
                )}
              </>
            ) : (
              <div className="pt-1 font-mono text-[0.75rem] uppercase tracking-[0.16em] text-slate-600">
                {t('relaying.empty')}
              </div>
            )}
            {anonUsers.length > 0 && (
              <>
                <div className="mm3-irc-group-label">ANONYMOUS</div>
                {anonUsers.slice(0, anonVisibleCount).map((entry) => {
                  const isYou = entry.anonId === actorId;
                  return (
                    <div
                      key={entry.anonId}
                      className={`mm3-irc-peer-row is-anon${isYou ? ' is-you' : ''}`}
                      title={t('relaying.readOnly')}
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
                    {`+ ${Math.min(5, anonUsers.length - anonVisibleCount)} ${t('relaying.more')}`}
                  </button>
                )}
                {anonVisibleCount > 5 && anonUsers.length <= anonVisibleCount && (
                  <button className="mm3-irc-show-more" onClick={() => setAnonVisibleCount(5)}>
                    ▲ {t('relaying.collapse')}
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
