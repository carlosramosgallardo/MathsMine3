package xyz.mathsmine3.nativeapp.trading

import kotlin.math.max
import kotlin.math.round

data class SellQuote(
    val level: Int,
    val totalMm3: Double,
    val rateCny: Double,
    val rateEur: Double,
    val rateUsd: Double,
    val commissionRate: Double,
    val commissionMm3: Double,
    val netMm3: Double,
    val grossCny: Double,
    val grossEur: Double,
    val grossUsd: Double,
    val commissionCny: Double,
    val commissionEur: Double,
    val commissionUsd: Double,
    val netCny: Double,
    val netEur: Double,
    val netUsd: Double,
)

object SellQuotes {
    private const val CNY_TO_EUR = 0.128
    private const val CNY_TO_USD = 0.139

    private data class Tier(val min: Int, val max: Int, val rateCny: Int)

    private val tiers = listOf(
        Tier(0, 19, 80),
        Tier(20, 39, 260),
        Tier(40, 59, 780),
        Tier(60, 79, 2400),
        Tier(80, 100, 8000),
    )

    fun clampLevel(level: Int): Int = level.coerceIn(0, 100)

    fun sellRateCny(level: Int): Double {
        val lv = clampLevel(level)
        val tier = tiers.first { lv in it.min..it.max }
        val intra = lv - tier.min
        return tier.rateCny + intra * max(5.0, round(tier.rateCny * 0.08))
    }

    fun rateByCurrency(level: Int, currency: String): Double {
        val cny = sellRateCny(level)
        return when (currency.uppercase()) {
            "USD" -> cny * CNY_TO_USD
            "CNY" -> cny
            else -> cny * CNY_TO_EUR
        }
    }

    fun commissionRate(amountMm3: Double): Double {
        val safe = max(0.0, amountMm3)
        return when {
            safe < 0.0001 -> 0.01
            safe < 0.001 -> 0.018
            safe < 0.01 -> 0.032
            safe < 0.1 -> 0.055
            safe < 1.0 -> 0.085
            else -> 0.12
        }
    }

    fun getSellQuote(level: Int, totalMm3: Double, zeroCommission: Boolean = false): SellQuote {
        val lv = clampLevel(level)
        val total = max(0.0, totalMm3)
        val rateCny = sellRateCny(lv)
        val commissionRate = if (zeroCommission) 0.0 else commissionRate(total)
        val commissionMm3 = total * commissionRate
        val netMm3 = max(0.0, total - commissionMm3)
        val grossCny = total * rateCny
        val commissionCny = grossCny * commissionRate
        val netCny = max(0.0, grossCny - commissionCny)
        return SellQuote(
            level = lv,
            totalMm3 = total,
            rateCny = rateCny,
            rateEur = rateCny * CNY_TO_EUR,
            rateUsd = rateCny * CNY_TO_USD,
            commissionRate = commissionRate,
            commissionMm3 = commissionMm3,
            netMm3 = netMm3,
            grossCny = grossCny,
            grossEur = grossCny * CNY_TO_EUR,
            grossUsd = grossCny * CNY_TO_USD,
            commissionCny = commissionCny,
            commissionEur = commissionCny * CNY_TO_EUR,
            commissionUsd = commissionCny * CNY_TO_USD,
            netCny = netCny,
            netEur = netCny * CNY_TO_EUR,
            netUsd = netCny * CNY_TO_USD,
        )
    }
}
