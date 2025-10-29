'use client';

import { useState, useEffect, useCallback } from 'react';
import { WagmiConfig, createConfig, http, useAccount } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import supabase from '@/lib/supabaseClient';
import { checkContributorEligibility } from '@/app/pov/lib/contributors';

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
  const h = hash % 360, sat = 70, light = 55;
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

// helpers para el color del ORB persistido
const isHex = (v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test((v || '').replace('#', ''));
const normHex = (v) => (v?.startsWith?.('#') ? v : `#${v || ''}`);

export default function PoAPage() {
  return (
    <WagmiConfig config={wagmiConfig}>
      <PoAClientComponent />
    </WagmiConfig>
  );
}

function PoAClientComponent() {
  const { address, isConnected } = useAccount();

  // Acento global (OrbToken/marcos)
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

  const frameAccent = (typeof orbColor === 'string' && orbColor.toLowerCase() !== '#000000')
    ? orbColor
    : '#22d3ee';

  // === estado PoA ===
  const [question, setQuestion] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [canAsk, setCanAsk] = useState(false);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [hasCreatedPoll, setHasCreatedPoll] = useState(false);

  useEffect(() => {
    async function checkEligibilityAndPoll() {
      if (!isConnected || !address) {
        setEligibilityChecked(false);
        setCanAsk(false);
        setHasCreatedPoll(false);
        return;
      }

      const eligible = await checkContributorEligibility(address);
      setCanAsk(eligible);
      setEligibilityChecked(true);

      const { data, error } = await supabase
        .from('polls')
        .select('id')
        .eq('wallet_address', address)
        .maybeSingle();

      if (error) {
        console.error('Error checking poll existence:', error);
      } else if (data) {
        setHasCreatedPoll(true);
      } else {
        setHasCreatedPoll(false);
      }
    }

    checkEligibilityAndPoll();
  }, [isConnected, address]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isConnected || !address) {
      setStatusMessage('Connect your wallet to create a poll.');
      return;
    }

    const wordCount = question.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 20) {
      setStatusMessage('The question must not exceed 20 words.');
      return;
    }

    if (hasCreatedPoll) {
      setStatusMessage('Only one poll per wallet is allowed.');
      return;
    }

    try {
      const { error } = await supabase
        .from('polls')
        .insert([{ question, wallet_address: address }]);

      if (error) {
        setStatusMessage('Error submitting your poll.');
        console.error(error);
      } else {
        setStatusMessage('Poll created successfully!');
        setQuestion('');
        setHasCreatedPoll(true);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setStatusMessage('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <main className="flex flex-col items-center w-full px-4 pt-10 pb-20 text-sm font-mono text-gray-300 bg-black min-h-screen">
      {/* El acento global solo para marcos */}
      <div className="max-w-3xl w-full" style={{ '--mm3-accent': frameAccent }}>
        {!isConnected && (
          <p className="text-base text-gray-300 text-center mb-2">
            Connect your wallet to create a poll. To participate, you must have mined at least 0.00001 MM3.
          </p>
        )}

        {isConnected && eligibilityChecked && !canAsk && (
          <p className="text-base text-gray-300 text-center mb-2">
            Connected as:{' '}
            <span style={{ color: colorFromAddress(address), fontWeight: 600 }}>
              {maskWallet(address)}
            </span>
            . You must have mined at least 0.00001 MM3 to create a poll.
          </p>
        )}

        {isConnected && eligibilityChecked && canAsk && (
          <>
            {hasCreatedPoll ? (
              <p className="text-base text-gray-300 text-center mb-4">
                Connected as:{' '}
                <span style={{ color: colorFromAddress(address), fontWeight: 600 }}>
                  {maskWallet(address)}
                </span>
                . Your poll has been published and is now available on PoV.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <textarea
                  className="w-full p-2 rounded border border-gray-600 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:border-gray-400"
                  placeholder="Write your yes/no question (max. 20 words). Only one poll per wallet is allowed."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded border border-gray-600 bg-black text-white hover:bg-gray-900 transition"
                >
                  Submit Poll
                </button>
              </form>
            )}
          </>
        )}

        {statusMessage && (
          <p className="mt-4 text-sm text-red-500">{statusMessage}</p>
        )}
      </div>
    </main>
  );
}
