package xyz.mathsmine3.nativeapp.ui.header

import androidx.compose.ui.graphics.Color
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.round

/** Port of lib/dice.js — deterministic hourly dice window. */
data class DiceWindow(
    val startMs: Long,
    val endMs: Long,
    val modifier: Double,
)

data class DiceState(
    val active: Boolean,
    val modifier: Double,
    val color: Color,
    val secsLeft: Int,
)

object Dice {
    private val COLOR_CHEAP = Color(0xFF22D3EE)
    private val COLOR_PRICEY = Color(0xFFFB923C)
    private val COLOR_INACTIVE = Color(0xFF334155)

    fun windowForHour(hourStartMs: Long): DiceWindow {
        val seed = (hourStartMs / 3_600_000L).toInt()
        val r1 = seededRand(seed * 1664525 + 1013904223)
        val r3 = seededRand(seed * 6364136 + 1442695041)
        val startSecond = floor(r1 * 2699).toInt() + 1
        val modifier = round((r3 - 0.5) * 100.0) / 100.0
        val startMs = hourStartMs + startSecond * 1000L
        return DiceWindow(startMs, startMs + 15 * 60 * 1000L, modifier)
    }

    fun state(nowMs: Long = System.currentTimeMillis()): DiceState {
        val hourStart = floor(nowMs / 3_600_000.0).toLong() * 3_600_000L
        val win = windowForHour(hourStart)
        val active = nowMs >= win.startMs && nowMs < win.endMs
        return DiceState(
            active = active,
            modifier = win.modifier,
            color = if (!active) COLOR_INACTIVE else if (win.modifier < 0) COLOR_CHEAP else COLOR_PRICEY,
            secsLeft = if (active) ((win.endMs - nowMs + 999) / 1000).toInt() else 0,
        )
    }

    private fun seededRand(n: Int): Double {
        var s = n xor 0xdeadbeef.toInt()
        s = (s xor (s ushr 16)) * 0x45d9f3b
        s = (s xor (s ushr 16)) * 0x45d9f3b
        val out = ((s xor (s ushr 16)).toLong() and 0xFFFFFFFFL)
        return out / 4294967296.0
    }
}

fun colorFromAddress(addr: String): Color {
    val safe = addr.lowercase().removePrefix("0x")
    var hash = 0
    for (ch in safe) {
        hash = hash * 31 + ch.code
    }
    // Match JS `>>> 0` + `% 360` — Kotlin `%` can be negative.
    val hue = ((hash.toLong() and 0xFFFFFFFFL) % 360L).toFloat()
    return Color.hsl(hue, 0.70f, 0.55f)
}

fun colorFromPool(poolCode: String): Color =
    colorFromAddress("pool:${poolCode.uppercase()}")


fun formatWalletLabel(value: String): String {
    val wallet = value.trim()
    if (wallet.length <= 7) return wallet
    return "${wallet.take(3)}.${wallet.takeLast(3)}"
}

fun formatCompactNum(value: Double): String {
    val abs = abs(value)
    return when {
        abs >= 1_000_000 -> String.format(java.util.Locale.US, "%.2fM", value / 1_000_000)
        abs >= 1_000 -> String.format(java.util.Locale.US, "%.1fk", value / 1_000)
        abs >= 100 -> String.format(java.util.Locale.US, "%.0f", value)
        abs >= 10 -> String.format(java.util.Locale.US, "%.1f", value)
        else -> String.format(java.util.Locale.US, "%.2f", value)
    }
}

fun currencySymbol(currency: String): String = when (currency.uppercase()) {
    "USD" -> "$"
    "CNY" -> "¥"
    else -> "€"
}

fun formatMoney(value: Double, currency: String): String {
    val abs = abs(value)
    val digits = when {
        abs == 0.0 -> 2
        abs < 0.0001 -> 8
        abs < 0.01 -> 6
        abs < 1 -> 4
        else -> 2
    }
    val body = String.format(java.util.Locale.US, "%.${digits}f", value)
    return "${currencySymbol(currency)}$body"
}

fun formatMm3(value: Double): String {
    val abs = abs(value)
    return when {
        abs == 0.0 -> "0.00000000"
        abs < 0.0001 -> String.format(java.util.Locale.US, "%.8f", value)
        else -> String.format(java.util.Locale.US, "%.6f", value)
    }
}

fun localClockText(): String {
    val now = java.time.LocalTime.now()
    return now.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss"))
}
