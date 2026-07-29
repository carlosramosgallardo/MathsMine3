package xyz.mathsmine3.nativeapp.chart

import androidx.compose.ui.graphics.Color
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDateTime
import java.time.LocalDate
import java.time.ZoneId
import xyz.mathsmine3.nativeapp.ui.header.Dice
import java.util.Calendar
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

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

data class NftEvent(
    val wallet: String,
    val deltaMm3: Double,
    val emoji: String,
    val eventType: String,
    val createdMs: Long,
)

enum class ChartMarkerKind {
    NFT,
    DICE_START,
    DICE_END,
    DICE_HOUR,
}

data class ChartMarker(
    val index: Int,
    val kind: ChartMarkerKind,
    val color: Color,
    val nftCount: Int = 0,
    val emojiHint: String = "",
    val diceModifier: Double? = null,
    val diceEnd: Boolean = false,
)

data class DiceOverlayBand(
    val startIndex: Int,
    val endIndex: Int,
    val modifier: Double,
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
  private val COLOR_CYAN = Color(0xFF22D3EE)
  private val COLOR_UP = Color(0xFF4ADE80)
  private val LIFE_NFTJI_ACCENT = Color(0xFF38BDF8)
  private val CRIT_NFTJI_ACCENT = Color(0xFFEF4444)

  fun chartDiceColor(modifier: Double): Color =
    if (modifier < 0) COLOR_CYAN else Color(0xFFFB923C)

  fun emojiColor(emoji: String): Color = when (emoji) {
    "🎲" -> Color(0xFF38BDF8)
    "🏎️", "🚙" -> Color(0xFF0EA5E9)
    "⬡" -> Color(0xFFFACC15)
    "🧿" -> Color(0xFFC084FC)
    "🎰" -> Color(0xFFF59E0B)
    "🍀" -> COLOR_UP
    "❤️" -> LIFE_NFTJI_ACCENT
    "⚔️" -> CRIT_NFTJI_ACCENT
    "🔰" -> Color(0xFF3B82F6)
    "📈" -> Color(0xFF22C55E)
    "📉" -> Color(0xFFF43F5E)
    else -> COLOR_CYAN
  }

  fun groupColor(events: List<NftEvent>): Color {
    if (events.any { it.emoji == "🧿" }) return Color(0xFFC084FC)
    if (events.any { it.emoji == "🎰" }) return Color(0xFFF59E0B)
    if (events.any { it.emoji == "❤️" }) return LIFE_NFTJI_ACCENT
    if (events.any { it.emoji == "🍀" }) return COLOR_UP
    if (events.any { it.emoji == "⚔️" }) return CRIT_NFTJI_ACCENT
    if (events.any { it.emoji == "🔰" }) return Color(0xFF3B82F6)
    if (events.any { it.emoji == "📈" }) return Color(0xFF22C55E)
    if (events.any { it.emoji == "📉" }) return Color(0xFFF43F5E)
    return COLOR_CYAN
  }

  fun indexForTime(points: List<ChartPoint>, timeKey: String): Int =
    points.indexOfFirst { it.time == timeKey }

  fun closestMinuteIndex(points: List<ChartPoint>, hour: Int, minute: Int): Int? {
    if (points.isEmpty()) return null
    val target = hour * 60 + minute
  var best = -1
  var bestDist = Int.MAX_VALUE
  points.forEachIndexed { i, p ->
    val parts = p.time.split(":")
    val h = parts.getOrNull(0)?.toIntOrNull() ?: return@forEachIndexed
    val m = parts.getOrNull(1)?.toIntOrNull() ?: 0
    val v = h * 60 + m
    val dist = abs(v - target)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return if (best >= 0) best else null
  }

  fun buildChartMarkers(
    points: List<ChartPoint>,
    nftByTime: Map<String, List<NftEvent>>,
    range: ChartRange,
    showDice: Boolean,
    nowMs: Long = System.currentTimeMillis(),
  ): Pair<List<ChartMarker>, List<DiceOverlayBand>> {
    if (points.isEmpty()) return emptyList<ChartMarker>() to emptyList()

    val markers = mutableListOf<ChartMarker>()
    val bands = mutableListOf<DiceOverlayBand>()

    nftByTime.forEach { (time, evts) ->
      val idx = indexForTime(points, time)
      if (idx >= 0 && evts.isNotEmpty()) {
        val emojis = evts.map { it.emoji }.distinct().take(3).joinToString("")
        markers += ChartMarker(
          index = idx,
          kind = ChartMarkerKind.NFT,
          color = groupColor(evts),
          nftCount = evts.size,
          emojiHint = emojis,
        )
      }
    }

    if (!showDice) return markers to bands

    when (range) {
      ChartRange.H1 -> {
        val chartRangeStart = nowMs - 3_600_000L
        val nowHour = (nowMs / 3_600_000L) * 3_600_000L
        for (offset in 0 downTo -1) {
          val hourStart = nowHour + offset * 3_600_000L
          val win = Dice.windowForHour(hourStart)
          if (win.endMs <= chartRangeStart || win.startMs > nowMs) continue

          val startMinute = ((win.startMs % 3_600_000L) / 60_000L).toInt()
          val startHour = ((win.startMs / 3_600_000L) % 24).toInt()
          val endMinute = ((win.endMs % 3_600_000L) / 60_000L).toInt()
          val endHour = ((win.endMs / 3_600_000L) % 24).toInt()

          val startIdx = closestMinuteIndex(points, startHour, startMinute)
          val endIdx = when {
            win.endMs > nowMs -> points.lastIndex
            else -> closestMinuteIndex(points, endHour, endMinute)
          }

          if (startIdx != null && endIdx != null && endIdx > startIdx) {
            bands += DiceOverlayBand(startIdx, endIdx, win.modifier)
          }
          if (startIdx != null) {
            markers += ChartMarker(
              index = startIdx,
              kind = ChartMarkerKind.DICE_START,
              color = chartDiceColor(win.modifier),
              diceModifier = win.modifier,
            )
          }
          if (win.endMs <= nowMs && endIdx != null) {
            markers += ChartMarker(
              index = endIdx,
              kind = ChartMarkerKind.DICE_END,
              color = Color(0xFF475569),
              diceModifier = win.modifier,
              diceEnd = true,
            )
          }
        }
      }
      ChartRange.H24 -> {
        points.forEachIndexed { i, p ->
          val mod = diceModifierForPoint(p.time, range, nowMs)
          if (mod != null) {
            markers += ChartMarker(
              index = i,
              kind = ChartMarkerKind.DICE_HOUR,
              color = chartDiceColor(mod),
              diceModifier = mod,
            )
          }
        }
      }
      ChartRange.D7, ChartRange.D30, ChartRange.D360 -> {
        points.forEachIndexed { i, p ->
          val mod = diceModifierForPoint(p.time, range, nowMs)
          if (mod != null) {
            markers += ChartMarker(
              index = i,
              kind = ChartMarkerKind.DICE_HOUR,
              color = chartDiceColor(mod),
              diceModifier = mod,
            )
          }
        }
      }
      ChartRange.ALL -> Unit
    }

    return markers to bands
  }

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

    fun parseNftEvents(raw: String): List<NftEvent> {
        val arr = JSONArray(raw)
        return buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val created = o.optString("created_at")
                val ms = runCatching { Instant.parse(created).toEpochMilli() }.getOrNull() ?: continue
                add(
                    NftEvent(
                        wallet = o.optString("wallet"),
                        deltaMm3 = o.optDouble("delta_mm3", 0.0),
                        emoji = o.optString("emoji", "🔮"),
                        eventType = o.optString("event_type"),
                        createdMs = ms,
                    ),
                )
            }
        }
    }

    fun chartEventCategory(emoji: String, eventType: String): String {
        if (eventType == "relaying" || emoji == "🔁") return "relaying"
        if (emoji == "⚔️" || emoji == "🔰") return "squeeze"
        if (emoji == "📈" || emoji == "📉") return "trading"
        return "mining"
    }

    fun groupNftEvents(
        events: List<NftEvent>,
        range: ChartRange,
        nowMs: Long = System.currentTimeMillis(),
    ): Map<String, List<NftEvent>> {
        if (events.isEmpty()) return emptyMap()
        val cutoff = range.windowMs
        val zone = ZoneId.systemDefault()
        val filtered = events.filter { ev ->
            cutoff == null || nowMs - ev.createdMs <= cutoff
        }
        val grouped = linkedMapOf<String, MutableList<NftEvent>>()
        filtered.forEach { ev ->
            val zdt = Instant.ofEpochMilli(ev.createdMs).atZone(zone)
            val key = when (range) {
                ChartRange.H1 -> "%02d:%02d".format(zdt.hour, zdt.minute)
                ChartRange.H24 -> "%02d:00".format(zdt.hour)
                else -> zdt.toLocalDate().toString().substring(5) // MM-DD
            }
            grouped.getOrPut(key) { mutableListOf() }.add(ev)
        }
        return grouped
    }

    fun diceModifierForPoint(time: String, range: ChartRange, nowMs: Long = System.currentTimeMillis()): Double? {
        val zone = ZoneId.systemDefault()
        val today = Instant.ofEpochMilli(nowMs).atZone(zone).toLocalDate()
        return when (range) {
            ChartRange.H1 -> {
                val parts = time.split(":")
                val hour = parts.getOrNull(0)?.toIntOrNull() ?: return null
                val hourStart = today.atTime(hour, 0).atZone(zone).toInstant().toEpochMilli()
                Dice.windowForHour(hourStart).modifier
            }
            ChartRange.H24 -> {
                val hour = time.take(2).toIntOrNull() ?: return null
                val hourStart = today.atTime(hour, 0).atZone(zone).toInstant().toEpochMilli()
                Dice.windowForHour(hourStart).modifier
            }
            else -> {
                val parts = time.split("-")
                if (parts.size != 2) return null
                val month = parts[0].toIntOrNull() ?: return null
                val day = parts[1].toIntOrNull() ?: return null
                val date = LocalDate.of(today.year, month, day)
                val hourStart = date.atTime(12, 0).atZone(zone).toInstant().toEpochMilli()
                Dice.windowForHour(hourStart).modifier
            }
        }
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
