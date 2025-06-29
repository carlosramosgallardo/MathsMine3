'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  if (!wallet || wallet.length <= 10) return wallet;
  return wallet.slice(0, 5) + '...' + wallet.slice(-5);
};

export default function PoVPage() {
  return (
    <WagmiConfig config={wagmiConfig}>
      <PoVClientComponent />
    </WagmiConfig>
  );
}

function PoVClientComponent() {
  const { address, isConnected } = useAccount();
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
          .select('id, question, wallet_address')
          .eq('active', true)
          .order('created_at', { ascending: false });

        if (pollError) throw pollError;

        const { data: votes, error: votesError } = await supabase
          .from('poll_votes')
          .select('*');

        if (votesError) throw votesError;

        const groupedVotes = votes.reduce((acc, vote) => {
          if (!acc[vote.poll_id]) acc[vote.poll_id] = [];
          acc[vote.poll_id].push(vote);
          return acc;
        }, {});

        setPollData(polls);
        setResultsData(groupedVotes);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchPollsAndVotes();
  }, []);

  useEffect(() => {
    async function checkEligibility() {
      if (isConnected && address) {
        const eligible = await checkContributorEligibility(address);
        setCanVote(eligible);
        setEligibilityChecked(true);
      }
    }
    checkEligibility();
  }, [isConnected, address]);

  const handleVote = async (pollId, vote) => {
    if (!isConnected || !address) {
      setStatusMessages((prev) => ({
        ...prev,
        [pollId]: 'Connect your wallet to vote.'
      }));
      return;
    }

    if (!canVote) {
      setStatusMessages((prev) => ({
        ...prev,
        [pollId]: 'You are not eligible to vote. You must have mined at least 0.00001 MM3.'
      }));
      return;
    }

    try {
      const { error } = await supabase
        .from('poll_votes')
        .insert([{ poll_id: pollId, wallet_address: address, vote }]);

      if (error) {
        if (error.code === '23505') {
          setStatusMessages((prev) => ({
            ...prev,
            [pollId]: 'You have already voted in this poll.'
          }));
        } else {
          setStatusMessages((prev) => ({
            ...prev,
            [pollId]: 'Error submitting your vote.'
          }));
        }
      } else {
        setStatusMessages((prev) => ({
          ...prev,
          [pollId]: 'Vote submitted successfully!'
        }));
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setStatusMessages((prev) => ({
        ...prev,
        [pollId]: 'An unexpected error occurred. Please try again.'
      }));
    }
  };

  return (
    <main className="flex flex-col items-center w-full pt-10 pb-20 text-sm font-mono text-gray-300 bg-black">
      <div className="w-full max-w-3xl px-4">
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
                {canVote
                  ? `Connected as: ${maskWallet(address)}`
                  : `Connected as ${maskWallet(address)}. You must have mined at least 0.00001 MM3 to vote.`}
              </p>
            )}

            {pollData.map((poll, index) => {
              const votes = resultsData[poll.id] || [];
              const totalVotes = votes.length;
              const voteCounts = votes.reduce((acc, v) => {
                acc[v.vote] = (acc[v.vote] || 0) + 1;
                return acc;
              }, {});

              return (
                <div
                  key={poll.id}
                  className="p-6 bg-[#0b0f19] border border-[#22d3ee] rounded-lg shadow-lg mb-12 animate-fadeInUp"
                >
                  <h2 className="text-base font-medium mb-1 text-gray-300">{poll.question}</h2>
                  <p className="text-base text-[#22d3ee] mb-4">
                    Created by: {maskWallet(poll.wallet_address)}
                  </p>

                  {eligibilityChecked && canVote && (
                    <div className="flex flex-wrap justify-center gap-4 mb-4">
                      <button
                        onClick={() => handleVote(poll.id, 'yes')}
                        className="px-6 py-2 rounded-lg bg-[#22d3ee] text-black hover:bg-[#1dbbe0] transition"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => handleVote(poll.id, 'no')}
                        className="px-6 py-2 rounded-lg bg-[#1e86d1] text-black hover:bg-[#1a7ebd] transition"
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
                                className={`h-3 rounded transition-all duration-700 ${option === 'yes' ? 'bg-[#22d3ee]' : 'bg-[#1e86d1]'}`}
                                style={{ width: `${percentage}%` }}
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
