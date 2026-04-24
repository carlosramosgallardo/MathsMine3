'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { useI18n } from '@/lib/i18n-context';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { useSound } from '@/lib/sound-context';

const ACTIVE_WINDOW_MS = 90_000;
const MAX_SESSION_MESSAGES = 120;
const IRC_ADMIN_WALLET = '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab';

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
  return normalized === IRC_ADMIN_WALLET ? 'root' : shortenWallet(normalized);
}

function formatChatAuthor(wallet, normalizedWallet, youLabel) {
  const normalized = String(wallet || '').toLowerCase();
  const baseLabel = normalized === IRC_ADMIN_WALLET ? 'root' : normalized;
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
  const storageKey = useMemo(() => (normalizedWallet ? sessionKeyForWallet(normalizedWallet) : ''), [normalizedWallet]);

  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [connectedWallets, setConnectedWallets] = useState([]);
  const [marketClaimsByWallet, setMarketClaimsByWallet] = useState({});
  const [relayReady, setRelayReady] = useState(false);

  const relayRef = useRef(null);
  const previousWalletRef = useRef('');
  const previousPresenceRef = useRef(new Set());
  const presenceBootedRef = useRef(false);
  const endRef = useRef(null);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const previousWallet = previousWalletRef.current;
    if (previousWallet && previousWallet !== normalizedWallet) {
      sessionStorage.removeItem(sessionKeyForWallet(previousWallet));
    }

    if (!normalizedWallet) {
      previousWalletRef.current = '';
      setMessages([]);
      setConnectedWallets([]);
      setRelayReady(false);
      presenceBootedRef.current = false;
      previousPresenceRef.current = new Set();
      return;
    }

    previousWalletRef.current = normalizedWallet;
  }, [normalizedWallet]);

  useEffect(() => {
    if (typeof window === 'undefined' || !normalizedWallet || !storageKey) return;
    let cancelled = false;

    const loadWelcome = async () => {
      let welcomeText = t('irc.welcomeFallback');
      try {
        const { data } = await supabase
          .from('mm3_macro_state')
          .select('ticker_message, ticker_message_en, ticker_message_es')
          .eq('id', 1)
          .maybeSingle();
        welcomeText = tickerFromRow(data, language, welcomeText);
      } catch {}

      const stored = safeParseSession(sessionStorage.getItem(storageKey));
      const withoutWelcome = stored.filter((entry) => !(entry.kind === 'system' && entry.tone === 'accent'));
      const seeded = [
        makeMessage({
          id: `welcome:${normalizedWallet}`,
          kind: 'system',
          wallet: 'system',
          text: welcomeText,
          tone: 'accent',
        }),
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
  }, [language, normalizedWallet, persistMessages, storageKey, t]);

  useEffect(() => {
    if (!normalizedWallet) return;
    const relay = supabase
      .channel('mm3-irc-relay', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        const text = normalizeRelayMessage(payload?.text);
        const wallet = String(payload?.wallet || '').toLowerCase();
        if (!text || !wallet) return;
        appendMessage(
          makeMessage({
            id: payload?.id || `relay:${wallet}:${payload?.ts || Date.now()}`,
            kind: 'chat',
            wallet,
            text,
            ts: payload?.ts || Date.now(),
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
  }, [appendMessage, normalizedWallet]);

  const loadMarketClaims = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mm3_podcast_pixels')
        .select('claimed_by, emoji, claimed_at')
        .not('claimed_by', 'is', null)
        .order('claimed_at', { ascending: true });
      if (error) throw error;

      const nextClaims = {};
      for (const entry of data || []) {
        const wallet = String(entry.claimed_by || '').toLowerCase();
        const emoji = String(entry.emoji || '').trim();
        if (!wallet || !emoji) continue;
        if (!nextClaims[wallet]) nextClaims[wallet] = [];
        if (!nextClaims[wallet].includes(emoji)) nextClaims[wallet].push(emoji);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mm3_podcast_pixels' }, loadMarketClaims)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMarketClaims]);

  const loadPresence = useCallback(async () => {
    if (!normalizedWallet) return;
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
          if (!previousPresence.has(wallet) && wallet !== normalizedWallet) {
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
          if (!nextPresence.has(wallet) && wallet !== normalizedWallet) {
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
  }, [appendMessage, normalizedWallet, t]);

  useEffect(() => {
    if (!normalizedWallet) return;
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
  }, [loadPresence, normalizedWallet]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

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
  };

  if (!normalizedWallet) {
    return (
      <div className="rounded-md border border-cyan-500/20 bg-black/90 px-4 py-5 font-mono text-cyan-300">
        <style>{`
          .mm3-irc-note {
            background:
              linear-gradient(180deg, rgba(34,211,238,0.06), transparent 60%),
              rgba(0,0,0,0.92);
            box-shadow: inset 0 0 18px rgba(34,211,238,0.05);
          }
        `}</style>
        <div className="mm3-irc-note space-y-3 rounded-sm border border-cyan-500/15 px-4 py-5">
          <div className="text-[0.72rem] uppercase tracking-[0.22em] text-cyan-400">{t('irc.title')}</div>
          <div className="text-[0.9rem] font-semibold text-cyan-200">{t('irc.connectRequired')}</div>
          <div className="text-[0.72rem] uppercase tracking-[0.14em] text-slate-500">{t('irc.connectHint')}</div>
        </div>
      </div>
    );
  }

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
        .mm3-irc-line.system {
          color: #94a3b8;
        }
        .mm3-irc-line.system[data-tone='accent'] {
          color: #4ade80;
          text-shadow: 0 0 8px rgba(74, 222, 128, 0.18);
        }
        .mm3-irc-line.system[data-tone='join'] {
          color: #67e8f9;
        }
        .mm3-irc-line.system[data-tone='leave'] {
          color: #fda4af;
        }
        .mm3-irc-line.self .mm3-irc-author {
          color: #4ade80;
        }
        .mm3-irc-line.other .mm3-irc-author {
          color: #e879f9;
        }
        .mm3-irc-author {
          word-break: break-all;
        }
        .mm3-irc-wallet-line {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.45rem;
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
          justify-content: flex-start;
          gap: 0.16rem;
          min-width: fit-content;
          flex-shrink: 0;
        }
        .mm3-irc-wallet-emoji {
          font-size: 0.76rem;
          line-height: 1;
          filter: drop-shadow(0 0 6px rgba(34, 211, 238, 0.16));
        }
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
              <div className="text-[0.52rem] uppercase tracking-[0.16em] text-cyan-700">{relayReady ? 'live' : 'syncing'}</div>
              <div className="mt-0.5 break-all text-[0.58rem] text-cyan-200">{formatIrcWalletLabel(normalizedWallet)}</div>
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
                    <div className="mt-0.5 break-words text-[0.72rem] leading-relaxed text-slate-200">{message.text}</div>
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
        </section>

        <aside className="mm3-irc-panel rounded-sm p-2.5">
          <div className="border-b border-cyan-500/12 pb-2 font-mono">
            <div className="text-[0.64rem] uppercase tracking-[0.22em] text-cyan-300">Connected</div>
            <div className="mt-0.5 text-[0.54rem] uppercase tracking-[0.15em] text-slate-500">
              {connectedWallets.length} connected
            </div>
          </div>

          <div className="mt-2.5 space-y-1.5">
            {connectedWallets.length > 0 ? connectedWallets.map((entry) => (
              <div
                key={entry.wallet}
                className="rounded-sm border border-cyan-500/10 bg-black/55 px-2 py-1.5 font-mono"
                title={entry.wallet}
              >
                <div className="mm3-irc-wallet-line">
                  <div className="mm3-irc-wallet-meta">
                    {(marketClaimsByWallet[entry.wallet] || []).length > 0 ? (
                      <div className="mm3-irc-wallet-emojis">
                        {marketClaimsByWallet[entry.wallet].map((emoji, index) => (
                          <span key={`${entry.wallet}-${emoji}-${index}`} className="mm3-irc-wallet-emoji">{emoji}</span>
                        ))}
                      </div>
                    ) : null}
                    <div className="break-all text-[0.6rem] text-cyan-200">
                      {entry.wallet === normalizedWallet ? `${formatIrcWalletLabel(entry.wallet)} (${t('irc.you')})` : formatIrcWalletLabel(entry.wallet)}
                    </div>
                  </div>
                </div>
                <div className="mt-1 text-[0.5rem] uppercase tracking-[0.14em] text-slate-500">
                  {entry.source === 'google' ? 'google' : 'wallet'}
                </div>
              </div>
            )) : (
              <div className="rounded-sm border border-cyan-500/10 bg-black/55 px-2 py-2.5 text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">
                {t('irc.empty')}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
