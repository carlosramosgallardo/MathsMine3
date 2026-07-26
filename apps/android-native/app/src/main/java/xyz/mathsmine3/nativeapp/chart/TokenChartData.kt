package xyz.mathsmine3.nativeapp.chart

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.Calendar
import java.util.Locale
import kotlin.math.abs

enum class ChartRange(val key: String, val windowMs: Long?) {
    H1("1h", 3_600_000L),
    H24("24h", 86_400_000L),
    D7("7d", 604_800_000L),
    D30("30d", 2_592_000_000L),
    D360("360d", 360L * 86_400_000L),
    ALL("all", null),
    ;

    companion object {
        val ALL_RANGES = entries
        fun fromKey(key: String): ChartRange =
            entries.find { it.key == key } ?: H24
    }
}

data class ChartPoint(
    val time: String,
    val value: Double,
    val delta: Double = 0.0,
    val minedDelta: Double = 0.0,
    val tradeDelta: Double = 0.0,
    val tradeWalletCount: Int = 0,
    val tradeGoogleCount: Int = 0,
    val nftjiDelta: Double = 0.0,
    val nodeDiceDelta: Double = 0.0,
    val rlMountDelta: Double = 0.0,
    val marketDelta: Double = 0.0,
)

data class HourlyRow(
    val hourMs: Long,
    val value: Double,
    val delta: Double,
    val minedDelta: Double,
    val tradeDelta: Double,
    val tradeWalletCount: Int,
    val tradeGoogleCount: Int,
    val nftjiDelta: Double,
    val nodeDiceDelta: Double,
    val rlMountDelta: Double,
    val marketDelta: Double,
)

object TokenChartData {
    fun parseHourly(raw: String): List<HourlyRow> {
        val arr = JSONArray(raw)
        return buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val hour = o.optString("hour")
                val ms = runCatching { Instant.parse(hour).toEpochMilli() }.getOrNull()
                    ?: continue
                add(
                    HourlyRow(
                        hourMs = ms,
                        value = o.optDouble("cumulative_reward", 0.0),
                        delta = o.optDouble("delta", 0.0),
                        minedDelta = o.optDouble("mined_delta", 0.0),
                        tradeDelta = o.optDouble("trade_delta", 0.0),
                        tradeWalletCount = o.optInt("trade_wallet_count", 0),
                        tradeGoogleCount = o.optInt("trade_google_count", 0),
                        nftjiDelta = o.optDouble("nftji_delta", o.optDouble("nftmoji_delta", 0.0)),
                        nodeDiceDelta = o.optDouble("node_dice_delta", 0.0),
                        rlMountDelta = o.optDouble("rl_mount_delta", 0.0),
                        marketDelta = o.optDouble("market_delta", 0.0),
                    ),
                )
            }
        }.sortedBy { it.hourMs }
    }

    fun parseMinutes(raw: String): List<ChartPoint> {
        val arr = JSONArray(raw)
        return buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(
                    ChartPoint(
                        time = o.optString("minute"),
                        value = o.optDouble("value", 0.0),
                        delta = o.optDouble("delta", 0.0),
                        minedDelta = o.optDouble("mined_delta", 0.0),
                        tradeDelta = o.optDouble("trade_delta", 0.0),
                        tradeWalletCount = o.optInt("trade_wallet_count", 0),
                        tradeGoogleCount = o.optInt("trade_google_count", 0),
                        nftjiDelta = o.optDouble("nftji_delta", 0.0),
                        nodeDiceDelta = o.optDouble("node_dice_delta", 0.0),
                        rlMountDelta = o.optDouble("rl_mount_delta", 0.0),
                        marketDelta = o.optDouble("market_delta", 0.0),
                    ),
                )
            }
        }
    }

    fun parseTokenValue(raw: String): Double {
        val o = JSONObject(raw)
        val total = o.optDouble("total_eth", Double.NaN)
        if (!total.isNaN() && total != 0.0) return total
        return o.optDouble("value", 0.0)
    }

    fun buildSeries(
        hourly: List<HourlyRow>,
        minutes: List<ChartPoint>,
        range: ChartRange,
        nowMs: Long = System.currentTimeMillis(),
    ): List<ChartPoint> {
        if (range == ChartRange.H1) {
            if (minutes.isNotEmpty()) return minutes
            if (hourly.isEmpty()) return emptyList()
            val lastVal = hourly.last().value
            if (lastVal == 0.0) return emptyList()
            return buildList {
                for (i in 60 downTo 0 step 5) {
                    val d = LocalDateTime.ofInstant(
                        Instant.ofEpochMilli(nowMs - i * 60_000L),
                        ZoneId.systemDefault(),
                    )
                    add(
                        ChartPoint(
                            time = "%02d:%02d".format(d.hour, d.minute),
                            value = lastVal,
                            delta = 0.0,
                        ),
                    )
                }
            }
        }

        if (hourly.isEmpty()) return emptyList()
        val cutoff = range.windowMs
        val sorted = hourly.filter { row ->
            cutoff == null || nowMs - row.hourMs <= cutoff
        }
        if (sorted.isEmpty()) return emptyList()

        if (range == ChartRange.H24) {
            return build24h(sorted)
        }

        // Group by local day for 7d / 30d / 360d / all
        val zone = ZoneId.systemDefault()
        val map = linkedMapOf<String, Double>()
        val daily = linkedMapOf<String, MutableList<Double>>()
        sorted.forEach { row ->
            val local = Instant.ofEpochMilli(row.hourMs).atZone(zone).toLocalDate()
            val key = local.toString()
            map[key] = row.value
            val bucket = daily.getOrPut(key) {
                mutableListOf(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
            }
            // 0 delta, 1 mined, 2 trade, 3 nftji, 4 node, 5 rl, 6 market, 7 wallet, 8 google
            bucket[0] = bucket[0] + row.delta
            bucket[1] = bucket[1] + row.minedDelta
            bucket[2] = bucket[2] + row.tradeDelta
            bucket[3] = bucket[3] + row.nftjiDelta
            bucket[4] = bucket[4] + row.nodeDiceDelta
            bucket[5] = bucket[5] + row.rlMountDelta
            bucket[6] = bucket[6] + row.marketDelta
            bucket[7] = bucket[7] + row.tradeWalletCount
            bucket[8] = bucket[8] + row.tradeGoogleCount
        }
        return map.entries.sortedBy { it.key }.mapIndexed { i, (day, value) ->
            val b = daily[day] ?: listOf(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
            val prev = map.entries.sortedBy { it.key }.getOrNull(i - 1)?.value ?: value
            ChartPoint(
                time = day.substring(5), // MM-DD
                value = value,
                delta = if (b[0] != 0.0) b[0] else value - prev,
                minedDelta = b[1],
                tradeDelta = b[2],
                nftjiDelta = b[3],
                nodeDiceDelta = b[4],
                rlMountDelta = b[5],
                marketDelta = b[6],
                tradeWalletCount = b[7].toInt(),
                tradeGoogleCount = b[8].toInt(),
            )
        }
    }

    private fun build24h(sorted: List<HourlyRow>): List<ChartPoint> {
        val zone = ZoneId.systemDefault()
        val lastLocal = Instant.ofEpochMilli(sorted.last().hourMs).atZone(zone)
        val allSameDay = sorted.all {
            Instant.ofEpochMilli(it.hourMs).atZone(zone).toLocalDate() == lastLocal.toLocalDate()
        }
        if (!allSameDay) {
            return sorted.mapIndexed { i, row ->
                val d = Instant.ofEpochMilli(row.hourMs).atZone(zone)
                val prev = sorted.getOrNull(i - 1)?.value ?: row.value
                ChartPoint(
                    time = "%02d:00".format(d.hour),
                    value = row.value,
                    delta = if (row.delta != 0.0) row.delta else row.value - prev,
                    minedDelta = row.minedDelta,
                    tradeDelta = row.tradeDelta,
                    tradeWalletCount = row.tradeWalletCount,
                    tradeGoogleCount = row.tradeGoogleCount,
                    nftjiDelta = row.nftjiDelta,
                    nodeDiceDelta = row.nodeDiceDelta,
                    rlMountDelta = row.rlMountDelta,
                    marketDelta = row.marketDelta,
                )
            }
        }

        val cal = Calendar.getInstance()
        cal.timeInMillis = sorted.last().hourMs
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        val endHour = cal.timeInMillis
        cal.set(Calendar.HOUR_OF_DAY, 0)
        val start = cal.timeInMillis

        val valueByHour = sorted.associate { row ->
            val d = Instant.ofEpochMilli(row.hourMs).atZone(zone)
            "%02d:00".format(d.hour) to row
        }

        var carry = sorted.first().value
        val filled = mutableListOf<ChartPoint>()
        var ts = start
        while (ts <= endHour) {
            val d = Instant.ofEpochMilli(ts).atZone(zone)
            val key = "%02d:00".format(d.hour)
            val row = valueByHour[key]
            val next = row?.value ?: carry
            filled += ChartPoint(
                time = key,
                value = next,
                delta = row?.delta ?: 0.0,
                minedDelta = row?.minedDelta ?: 0.0,
                tradeDelta = row?.tradeDelta ?: 0.0,
                tradeWalletCount = row?.tradeWalletCount ?: 0,
                tradeGoogleCount = row?.tradeGoogleCount ?: 0,
                nftjiDelta = row?.nftjiDelta ?: 0.0,
                nodeDiceDelta = row?.nodeDiceDelta ?: 0.0,
                rlMountDelta = row?.rlMountDelta ?: 0.0,
                marketDelta = row?.marketDelta ?: 0.0,
            )
            carry = next
            ts += 3_600_000L
        }
        return filled
    }

    fun formatValue(value: Double): String {
        val abs = abs(value)
        return when {
            abs == 0.0 -> "0"
            abs < 0.0001 -> String.format(Locale.US, "%.8f", value)
            abs < 0.01 -> String.format(Locale.US, "%.6f", value)
            abs < 1 -> String.format(Locale.US, "%.4f", value)
            else -> String.format(Locale.US, "%.2f", value)
        }
    }

    fun formatDelta(delta: Double): String {
        val sign = if (delta >= 0) "+" else ""
        return "$sign${formatValue(delta)}"
    }

    fun formatPct(delta: Double, base: Double): String {
        if (base == 0.0) return "—"
        val pct = (delta / abs(base)) * 100.0
        val sign = if (pct >= 0) "+" else ""
        return String.format(Locale.US, "%s%.2f%%", sign, pct)
    }
}
