import { MM3_BLOCK_CHAIN_REQUIREMENTS } from '@/lib/mm3-block-chain'
import { isAnonymousWallet } from '@/lib/is-anonymous-wallet'
import { clampRankLevel } from '@/lib/ranks'

export function normalizeLeaderboardWallet(value) {
  return String(value || '').trim().toLowerCase()
}

/**
 * Merge wallet ranking rows the same way as the web Leaderboard component:
 * union of leaderboard_data, player_progress, pool members, and squeeze wallets.
 */
export function mergeLeaderboardEntries({
  leaderboardRows = [],
  progressRows = [],
  minedBlocks = [],
  poolMembers = [],
  squeezeWallets = [],
  nftjiOwners = [],
} = {}) {
  const minedBlockTotal = MM3_BLOCK_CHAIN_REQUIREMENTS.length

  const lbByWallet = new Map(
    (leaderboardRows || []).map((row) => [normalizeLeaderboardWallet(row.wallet), row])
  )

  const progressByWallet = new Map()
  for (const entry of progressRows || []) {
    const wallet = normalizeLeaderboardWallet(entry.wallet)
    if (!wallet || isAnonymousWallet(wallet)) continue
    progressByWallet.set(wallet, {
      level: clampRankLevel(entry.level ?? 0),
      blockChainPercent: Number(entry.block_chain_percent) || 0,
      mm3Sold: Number(entry.mm3_sold) || 0,
      cny: Number(entry.cny_earned) || 0,
      eur: Number(entry.eur_earned) || 0,
      usd: Number(entry.usd_earned) || 0,
      walletEmojis: Array.isArray(entry.wallet_emojis) ? entry.wallet_emojis : [],
      is_bot: Boolean(entry.is_bot),
    })
  }

  const minedCountByWallet = new Map()
  for (const entry of minedBlocks || []) {
    const wallet = normalizeLeaderboardWallet(entry.wallet)
    if (!wallet) continue
    minedCountByWallet.set(wallet, (minedCountByWallet.get(wallet) || 0) + 1)
  }

  const nftjiOwnerSet = new Set(
    (nftjiOwners || []).map((wallet) => normalizeLeaderboardWallet(wallet)).filter(Boolean)
  )

  const poolMemberWallets = (poolMembers || [])
    .map((entry) => normalizeLeaderboardWallet(entry.wallet))
    .filter(Boolean)

  const squeezeWalletList = (squeezeWallets || [])
    .map((entry) => normalizeLeaderboardWallet(entry.wallet))
    .filter(Boolean)

  const allWallets = new Set([
    ...lbByWallet.keys(),
    ...progressByWallet.keys(),
    ...poolMemberWallets,
    ...squeezeWalletList,
  ].filter((wallet) => wallet && !isAnonymousWallet(wallet)))

  return [...allWallets]
    .map((normalizedWallet) => {
      const lbRow = lbByWallet.get(normalizedWallet)
      const progress = progressByWallet.get(normalizedWallet) || {
        level: 0,
        blockChainPercent: 0,
        mm3Sold: 0,
        cny: 0,
        eur: 0,
        usd: 0,
        walletEmojis: [],
        is_bot: false,
      }
      const totalMm3 = Number(lbRow?.total_eth) || 0
      const minedBlockCount = Number(minedCountByWallet.get(normalizedWallet) || 0)
      const nftjiOwned = (minedBlockCount === 0 && nftjiOwnerSet.has(normalizedWallet)) ? 1 : 0
      const blockChainPercent = Math.round(((minedBlockCount + nftjiOwned) / minedBlockTotal) * 10000) / 100

      return {
        wallet: lbRow?.wallet || normalizedWallet,
        level: progress.level,
        block_chain_percent: blockChainPercent,
        mined_block_count: minedBlockCount,
        available_mm3: totalMm3 - progress.mm3Sold,
        total_correct: Number(lbRow?.total_correct) || 0,
        total_games: Number(lbRow?.total_games) || 0,
        best_streak: Number(lbRow?.highest_streak) || 0,
        cny_balance: progress.cny,
        eur_balance: progress.eur,
        usd_balance: progress.usd,
        nftjis: progress.walletEmojis,
        is_bot: progress.is_bot,
      }
    })
    .sort((a, b) => {
      if (b.block_chain_percent !== a.block_chain_percent) return b.block_chain_percent - a.block_chain_percent
      if (b.mined_block_count !== a.mined_block_count) return b.mined_block_count - a.mined_block_count
      if (b.level !== a.level) return b.level - a.level
      if (b.available_mm3 !== a.available_mm3) return b.available_mm3 - a.available_mm3
      return String(a.wallet).localeCompare(String(b.wallet))
    })
}
