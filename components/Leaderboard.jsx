'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import supabase from '@/lib/supabaseClient';

export default function Leaderboard({ itemsPerPage = 10 }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const cacheDuration = 60 * 1000;
  const cacheKey = 'leaderboard_data';
  const lastFetchTimeKey = 'leaderboard_last_fetch_time';
  const abortRef = useRef(null);

  /* === wallet helpers === */
  const maskWallet = (wallet) => {
    if (!wallet || wallet.length <= 10) return wallet || '';
    return wallet.slice(0, 5) + '...' + wallet.slice(-5);
  };

  // same deterministic color formula used in PoV
  function colorFromAddress(addr = '') {
    const s = String(addr).toLowerCase().replace(/^0x/, '');
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    const h = hash % 360;     // hue 0..359
    const sat = 70;           // %
    const light = 55;         // %
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

  const fetchLeaderboard = useCallback(async ({ ignoreCache = false } = {}) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      setIsLoading(true);

      if (!ignoreCache) {
        const lastFetchTime = localStorage.getItem(lastFetchTimeKey);
        const currentTime = Date.now();
        if (lastFetchTime && currentTime - lastFetchTime < cacheDuration) {
          const cachedData = JSON.parse(localStorage.getItem(cacheKey));
          if (cachedData) {
            setLeaderboard(cachedData);
            setIsLoading(false);
            return;
          }
        }
      }

      const { data, error } = await supabase
        .from('leaderboard_with_nfts')
        .select('wallet, total_eth, nfts')
        .order('total_eth', { ascending: false });

      if (error) {
        console.error('Failed to load leaderboard:', error);
        setLeaderboard([]);
      } else {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(lastFetchTimeKey, Date.now().toString());
        setLeaderboard(data);
      }
    } catch (e) {
      if (e?.name !== 'AbortError') console.error('Leaderboard fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // initial load
  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // instant refresh after game saved or correct move (with small backoff)
  useEffect(() => {
    const handleRefresh = () => {
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(lastFetchTimeKey);
      fetchLeaderboard({ ignoreCache: true });
      const t1 = setTimeout(() => fetchLeaderboard({ ignoreCache: true }), 1000);
      const t2 = setTimeout(() => fetchLeaderboard({ ignoreCache: true }), 3000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    };
    const onDbUpdated = () => handleRefresh();
    const onCorrect = () => handleRefresh();

    window.addEventListener('mm3-db-updated', onDbUpdated);
    window.addEventListener('mm3-correct', onCorrect);
    return () => {
      window.removeEventListener('mm3-db-updated', onDbUpdated);
      window.removeEventListener('mm3-correct', onCorrect);
    };
  }, [fetchLeaderboard]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = leaderboard.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(leaderboard.length / itemsPerPage);

  return (
    <div className="w-full overflow-auto">
      <table className="table-fixed w-full mx-auto border border-[#22d3ee] rounded-xl text-sm md:text-base">
        <thead className="bg-[#0b0f19] text-[#22d3ee]">
          <tr>
            <th className="border border-[#22d3ee] px-4 py-2 text-left font-mono">Wallet</th>
            <th className="border border-[#22d3ee] px-4 py-2 text-right font-mono">MM3</th>
          </tr>
        </thead>
        <tbody className="bg-[#0b0f19] text-[#22d3ee]">
          {isLoading ? (
            <tr>
              <td colSpan="2" className="border border-[#22d3ee] px-4 py-2 text-center">
                Loading leaderboard...
              </td>
            </tr>
          ) : currentItems.length > 0 ? (
            currentItems.map((entry, index) => {
              const walletColor = colorFromAddress(entry.wallet);
              return (
                <tr key={`${entry.wallet}-${index}`} className="hover:bg-[#1e293b] transition">
                  <td className="border border-[#22d3ee] px-4 py-2 font-mono whitespace-normal break-words">
                    <div className="flex items-center gap-1 flex-wrap">
                      {/* colored wallet */}
                      <span style={{ color: walletColor }} title={entry.wallet}>
                        {maskWallet(entry.wallet)}
                      </span>
                      {/* player NFTs */}
                      {entry.nfts?.map((nft) => (
                        <a href={`/nft/${nft.slug}`} key={nft.slug} title={nft.name}>
                          <img
                            src={nft.image_url}
                            alt={nft.slug}
                            className="h-5 w-5 rounded-sm ml-1 hover:scale-105 transition"
                          />
                        </a>
                      ))}
                    </div>
                  </td>
                  <td className="border border-[#22d3ee] px-4 py-2 font-mono text-right text-sm md:text-base">
                    {entry.total_eth?.toString().match(/^(\d+\.\d{0,8})/)?.[1] || entry.total_eth}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="2" className="border border-[#22d3ee] px-4 py-2 text-center">
                No leaderboard data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex justify-center mt-4 space-x-2">
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 rounded border ${
                currentPage === i + 1
                  ? 'bg-[#22d3ee] text-black font-bold'
                  : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
