/**
 * AI-team bot wallets → mining pool codes. Mirrors BOT_POOLS in
 * app/ai-team/page.jsx (the four autonomous wallets, maps M2-M5): keep both
 * in sync if a bot rotates pools. Used by the mining NPC labels and the home
 * lineup tags so the bots advertise their pool like real players do.
 */
export const AI_TEAM_POOL_BY_WALLET = Object.freeze({
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528': 'FHNN6', // M2
  '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202': 'FHNN6', // M3
  '0xd6c6c15060b27406d956c7e99e520cc810b44233': '8FR49', // M4
  '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab': '8FR49', // M5
})

export function aiTeamPoolCode(wallet) {
  return AI_TEAM_POOL_BY_WALLET[String(wallet || '').toLowerCase()] || null
}
