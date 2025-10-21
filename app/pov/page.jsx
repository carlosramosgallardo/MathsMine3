'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { WagmiConfig, createConfig, http, useAccount } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import supabase from '@/lib/supabaseClient';
import { checkContributorEligibility } from './lib/contributors';

const chains = [mainnet];
const wagmiConfig = createConfig({
  chains,
  transports: {
    [mainnet.id]: http(),
  },
});

const maskWallet = (wallet) => {
  if (!wallet || wallet.length <= 10) return wallet || '';
  return wallet.slice(0, 5) + '...' + wallet.slice(-5);
};

// === Color determinístico por wallet (mismo en toda la web) ===
function colorFromAddress(addr = '') {
  const s = (addr || '').toLowerCase().replace(/^0x/, '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const h = hash % 360;   // hue 0..359
  const sat = 70;         // %
  const light = 55;       // %
  return hslToHex(h, sat, light);
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// helpers para el color del ORB (persistido en Supabase)
const isHex = (v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test((v || '').replace('#', ''));
const normHex = (v) => (v?.startsWith?.('#') ? v : `#${v || ''}`);

export default function PoVPage() {
  return (
    <WagmiConfig config={wagmiConfig}>
      <PoVClientComponent />
    </WagmiConfig>
  );
}

function PoVClientComponent() {
  const { address, isConnected } = useAccount();

  // Acento global (OrbToken / marcos / barra "Yes")
  const [orbColor, setOrbColor] = useState('#000000');

  const loadOrbColor = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mm3_visual_state')
        .select('color_hex')
        .eq('id', 1)
        .maybeSingle();
      if (!error && data?.color_hex && isHex(data.color_hex)) {
        setOrbColor(normHex(data.color_hex));
      }
    } catch (_) {}
  }, []);

  useEffect(() => { loadOrbColor(); }, [loadOrbColor]);

  const frameAccent =
    (typeof orbColor === 'string' && orbColor.toLowerCase() !== '#000000')
      ? orbColor
      : '#22d3ee';

  // Estado PoV
  const [pollData, setPollData] = useState([]);
  const [resultsData, setResultsData] = useState({});
  const [statusMessages, setStatusMessages] = useState({});
  const [canVote, setCanVote] = useState(false);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);

  useEffect(() => {
    const fetchPollsAndVotes = async () => {
      try {
        const { data: polls, error: pollError } = await supabase
          .from('polls')
          .select('id, question, wallet_address, active, created_at')
          .eq('active', true)
          .order('created_at', { ascending: false });
        if (pollError) throw pollError;

        const { data: votes, error: votesError } = await supabase
          .from('poll_votes')
          .select('*');
        if (votesError) throw votesError;

        const groupedVotes = (votes || []).reduce((acc, vote) => {
          if (!acc[vote.poll_id]) acc[vote.poll_id] = [];
          acc[vote.poll_id].push(vote);
          return acc;
        }, {});
        setPollData(polls || []);
        setResultsData(groupedVotes);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchPollsAndVotes();
  }, []);

  useEffect(() => {
    async function checkEligibility() {
      if (!isConnected || !address) {
        setEligibilityChecked(false);
        setCanVote(false);
        return;
      }
      const eligible = await checkContributorEligibility(address);
      setCanVote(eligible);
      setEligibilityChecked(true);
    }
    checkEligibility();
  }, [isConnected, address]);

  // color del creador (determinístico)
  const creatorColors = useMemo(() => {
    const set = new Set((pollData || []).map(p => (p.wallet_address || '').toLowerCase()));
    const map = {};
    for (const w of set) map[w] = colorFromAddress(w);
    return map;
  }, [pollData]);

  const handleVote = async (pollId, vote) => {
    if (!isConnected || !address) {
      setStatusMessages((prev) => ({ ...prev, [pollId]: 'Connect your wallet to vote.' }));
      return;
    }
    if (!canVote) {
      setStatusMessages((prev) => ({
        ...prev,
        [pollId]: 'You are not eligible to vote. You must have mined at least 0.00001 MM3.',
      }));
      return;
    }

    try {
      const { error } = await supabase
        .from('poll_votes')
        .insert([{ poll_id: pollId, wallet_address: address, vote }]);

      if (error) {
        if (error.code === '23505') {
          setStatusMessages((prev) => ({ ...prev, [pollId]: 'You have already voted in this poll.' }));
        } else {
          setStatusMessages((prev) => ({ ...prev, [pollId]: 'Error submitting your vote.' }));
        }
      } else {
        setStatusMessages((prev) => ({ ...prev, [pollId]: 'Vote submitted successfully!' }));
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setStatusMessages((prev) => ({ ...prev, [pollId]: 'An unexpected error occurred. Please try again.' }));
    }
  };

  return (
    <main className="flex flex-col items-center w-full pt-10 pb-20 text-sm font-mono text-gray-300 bg-black min-h-screen">
      {/* El acento global solo para marcos/barras */}
      <div className="w-full max-w-3xl px-4" style={{ '--mm3-accent': frameAccent }}>
        {!isConnected && (
          <p className="text-base text-gray-300 text-center mb-2">
            Connect your wallet to participate. To vote, you must have mined at least 0.00001 MM3.
          </p>
        )}

        {pollData.length === 0 ? (
          <p className="text-gray-300">Loading poll data...</p>
        ) : (
          <>
            {eligibilityChecked && isConnected && (
              <p className="text-base text-gray-300 text-center mb-6">
                Connected as:{' '}
                <span style={{ color: colorFromAddress(address), fontWeight: 600 }}>
                  {maskWallet(address)}
                </span>
                {canVote ? null : <>. You must have mined at least 0.00001 MM3 to vote.</>}
              </p>
            )}

            {pollData.map((poll) => {
              const votes = resultsData[poll.id] || [];
              const totalVotes = votes.length;
              const voteCounts = votes.reduce((acc, v) => {
                acc[v.vote] = (acc[v.vote] || 0) + 1;
                return acc;
              }, {});
              const creatorAddr = (poll.wallet_address || '').toLowerCase();
              const creatorColor = creatorColors[creatorAddr] || colorFromAddress(creatorAddr);

              return (
                <div
                  key={poll.id}
                  className="p-6 bg-[#0b0f19] border rounded-lg shadow-lg mb-12 animate-fadeInUp"
                  style={{ borderColor: frameAccent }}
                >
                  <h2 className="text-base font-medium mb-1 text-gray-300">{poll.question}</h2>

                  <p className="text-base mb-4 text-white">
                    Created by:{' '}
                    <span style={{ color: creatorColor, fontWeight: 600 }}>
                      {maskWallet(poll.wallet_address)}
                    </span>
                  </p>

                  {eligibilityChecked && canVote && (
                    <div className="flex flex-wrap justify-center gap-4 mb-4">
                      <button
                        onClick={() => handleVote(poll.id, 'yes')}
                        className="px-6 py-2 rounded-lg text-black transition"
                        style={{ backgroundColor: frameAccent }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => handleVote(poll.id, 'no')}
                        className="px-6 py-2 rounded-lg text-black transition"
                        style={{ backgroundColor: '#1e86d1' }}
                      >
                        No
                      </button>
                    </div>
                  )}

                  {totalVotes > 0 && (
                    <div className="space-y-2 mt-6">
                      {['yes', 'no'].map((option) => {
                        const count = voteCounts[option] || 0;
                        const percentage = ((count / totalVotes) * 100).toFixed(1);
                        return (
                          <div key={option} className="text-left">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="capitalize text-blue-100">{option}</span>
                              <span className="text-blue-100">
                                {count} votes ({percentage}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded h-3">
                              <div
                                className="h-3 rounded transition-all duration-700"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: option === 'yes' ? frameAccent : '#1e86d1',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {statusMessages[poll.id] && (
                    <p className="mt-4 text-sm text-gray-400">{statusMessages[poll.id]}</p>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
