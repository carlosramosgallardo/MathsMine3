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

data class BuyQuote(
    val level: Int,
    val funds: Double,
    val grossMm3: Double,
    val netMm3: Double,
    val rateCny: Double,
    val rateCurrency: Double,
    val commissionRate: Double,
    val commissionMm3: Double,
    val grossCny: Double,
    val grossEur: Double,
    val grossUsd: Double,
)

object SellQuotes {
    private const val CNY_TO_EUR = 0.128
    private const val CNY_TO_USD = 0.139
    private const val BUY_RATE_PREMIUM = 1.18
    private const val MIN_TRADE_MM3 = 0.00001

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

    fun buyCommissionRate(amountMm3: Double): Double {
        val safe = max(0.0, amountMm3)
        return when {
            safe < 0.0001 -> 0.03
            safe < 0.001 -> 0.045
            safe < 0.01 -> 0.07
            safe < 0.1 -> 0.1
            safe < 1.0 -> 0.14
            else -> 0.18
        }
    }

    fun buyRateByCurrency(level: Int, currency: String): Double =
        rateByCurrency(level, currency) * BUY_RATE_PREMIUM

    fun getBuyQuote(
        level: Int,
        funds: Double,
        currency: String = "EUR",
        zeroCommission: Boolean = false,
    ): BuyQuote {
        val lv = clampLevel(level)
        val safeFunds = max(0.0, funds)
        val rateCny = sellRateCny(lv) * BUY_RATE_PREMIUM
        val rateCurrency = when (currency.uppercase()) {
            "USD" -> rateCny * CNY_TO_USD
            "CNY" -> rateCny
            else -> rateCny * CNY_TO_EUR
        }
        val grossMm3 = if (rateCurrency > 0) safeFunds / rateCurrency else 0.0
        val commissionRate = if (zeroCommission) 0.0 else buyCommissionRate(grossMm3)
        val commissionMm3 = grossMm3 * commissionRate
        val netMm3 = max(0.0, grossMm3 - commissionMm3)
        return BuyQuote(
            level = lv,
            funds = safeFunds,
            grossMm3 = grossMm3,
            netMm3 = netMm3,
            rateCny = rateCny,
            rateCurrency = rateCurrency,
            commissionRate = commissionRate,
            commissionMm3 = commissionMm3,
            grossCny = grossMm3 * rateCny,
            grossEur = grossMm3 * rateCny * CNY_TO_EUR,
            grossUsd = grossMm3 * rateCny * CNY_TO_USD,
        )
    }

    /** Smallest fiat spend that yields at least MIN_TRADE_MM3 after buy fees. */
    fun minimumBuyFunds(level: Int, currency: String, zeroCommission: Boolean = false): Double {
        var low = 0.0
        var high = max(buyRateByCurrency(level, currency) * MIN_TRADE_MM3 * 2, 0.00000001)
        repeat(24) {
            val quote = getBuyQuote(level, high, currency, zeroCommission)
            if (quote.netMm3 >= MIN_TRADE_MM3) return@repeat
            high *= 2
        }
        repeat(24) {
            val mid = (low + high) / 2
            val quote = getBuyQuote(level, mid, currency, zeroCommission)
            if (quote.netMm3 >= MIN_TRADE_MM3) high = mid else low = mid
        }
        return high
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
