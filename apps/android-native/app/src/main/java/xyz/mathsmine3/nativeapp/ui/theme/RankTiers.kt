package xyz.mathsmine3.nativeapp.ui.theme

import androidx.compose.ui.graphics.Color

data class RankTier(
    val label: String,
    val emoji: String,
    val color: Color,
    val min: Int,
    val max: Int,
)

object RankTiers {
    val all = listOf(
        RankTierSpec("NOVICE", "🧪", Color(0xFF22D3EE), 0, 19),
        RankTierSpec("MINER", "⛏️", Color(0xFF4ADE80), 20, 39),
        RankTierSpec("HACKER", "🧠", Color(0xFFFACC15), 40, 59),
        RankTierSpec("WIZARD", "🪄", Color(0xFFF97316), 60, 79),
        RankTierSpec("LEGEND", "👑", Color(0xFFE879F9), 80, 100),
    )

    fun forLevel(level: Int): RankTierSpec {
        val lv = level.coerceIn(0, 100)
        return all.firstOrNull { lv in it.min..it.max } ?: all.first()
    }
}

data class RankTierSpec(
    val label: String,
    val emoji: String,
    val color: Color,
    val min: Int,
    val max: Int,
)
