/** Maps mm3_mining_events.event_type → token-history breakdown field. */
export const EMPTY_MM3_CHART_DELTAS = Object.freeze({
  mined_delta: 0,
  trade_delta: 0,
  trade_wallet_count: 0,
  trade_google_count: 0,
  nftji_delta: 0,
  node_dice_delta: 0,
  rl_mount_delta: 0,
  market_delta: 0,
})

export function chartDeltaFieldForMiningEvent(eventType) {
  switch (eventType) {
    case 'nftji_claim':
    case 'nftji_level_up':
      return 'nftji_delta'
    case 'node_stormroll':
      return 'node_dice_delta'
    case 'rl_mount_buy':
      return 'rl_mount_delta'
    default:
      return 'market_delta'
  }
}

export function addMiningEventDelta(bucket, eventType, deltaMm3) {
  const field = chartDeltaFieldForMiningEvent(eventType)
  bucket[field] += parseFloat(deltaMm3 || 0)
}
