-- Canonical rank ladder for MathsMine3.
-- CI compares these bands to lib/ranks.js and Android RankTiers.kt.

local ranks = {
  {
    min = 0,
    max = 19,
    label = "NOVICE",
    emoji = "🧪",
    color = "#22d3ee",
  },
  {
    min = 20,
    max = 39,
    label = "MINER",
    emoji = "⛏️",
    color = "#4ade80",
  },
  {
    min = 40,
    max = 59,
    label = "HACKER",
    emoji = "🧠",
    color = "#facc15",
  },
  {
    min = 60,
    max = 79,
    label = "WIZARD",
    emoji = "🪄",
    color = "#f97316",
  },
  {
    min = 80,
    max = 100,
    label = "LEGEND",
    emoji = "👑",
    color = "#e879f9",
  },
}

return ranks
