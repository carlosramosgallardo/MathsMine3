package xyz.mathsmine3.nativeapp.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import android.graphics.Paint
import android.graphics.Typeface
import xyz.mathsmine3.nativeapp.chart.ChartMarker
import xyz.mathsmine3.nativeapp.chart.ChartMarkerKind
import xyz.mathsmine3.nativeapp.chart.ChartPoint
import xyz.mathsmine3.nativeapp.chart.ChartRange
import xyz.mathsmine3.nativeapp.chart.DiceOverlayBand
import xyz.mathsmine3.nativeapp.chart.HourlyRow
import xyz.mathsmine3.nativeapp.chart.NftEvent
import xyz.mathsmine3.nativeapp.chart.TokenChartData
import xyz.mathsmine3.nativeapp.ui.header.formatWalletLabel
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors
import kotlin.math.max
import kotlin.math.roundToInt

private data class ChartReload(
    val hourly: List<HourlyRow>,
    val minutes: List<ChartPoint>,
    val events: List<NftEvent>,
    val live: Double?,
)

private data class ChartFilters(
    val dice: Boolean = true,
    val mining: Boolean = true,
    val trading: Boolean = true,
    val squeeze: Boolean = true,
    val relaying: Boolean = true,
)

private val CHART_FILTER_KEYS = listOf("dice", "mining", "trading", "squeeze", "relaying")

@Composable
fun Mm3ValueScreen(
    api: Mm3Api,
    language: String = "en",
) {
    val es = language.startsWith("es", ignoreCase = true)
    var range by remember { mutableStateOf(ChartRange.H24) }
    var hourly by remember { mutableStateOf<List<HourlyRow>>(emptyList()) }
    var minutes by remember { mutableStateOf<List<ChartPoint>>(emptyList()) }
    var nftEvents by remember { mutableStateOf<List<NftEvent>>(emptyList()) }
    var filters by remember { mutableStateOf(ChartFilters()) }
    var liveValue by remember { mutableStateOf<Double?>(null) }
    var status by remember { mutableStateOf(if (es) "cargando…" else "loading…") }
    var selectedIndex by remember { mutableIntStateOf(-1) }
    val scope = rememberCoroutineScope()

    fun series(): List<ChartPoint> = TokenChartData.buildSeries(hourly, minutes, range)

    fun reload(full: Boolean = true) {
        scope.launch {
            if (full) status = if (es) "sync…" else "sync…"
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val h = TokenChartData.parseHourly(api.tokenHistory().readText())
                    val m = if (range == ChartRange.H1 || full) {
                        runCatching { TokenChartData.parseMinutes(api.tokenHistoryMinutes().readText()) }
                            .getOrElse { emptyList() }
                    } else minutes
                    val ev = runCatching { TokenChartData.parseNftEvents(api.nftEvents().readText()) }
                        .getOrElse { emptyList() }
                    val v = runCatching { TokenChartData.parseTokenValue(api.tokenValue().readText()) }
                        .getOrNull()
                    ChartReload(h, m, ev, v)
                }
            }
            result.onSuccess { payload ->
                hourly = payload.hourly
                if (payload.minutes.isNotEmpty() || range == ChartRange.H1) minutes = payload.minutes
                nftEvents = payload.events
                if (payload.live != null) liveValue = payload.live
                status = if (es) {
                    "live · ${payload.hourly.size}h · ${payload.events.size} evt"
                } else {
                    "live · ${payload.hourly.size}h · ${payload.events.size} evt"
                }
            }.onFailure {
                status = it.message ?: "error"
            }
        }
    }

    LaunchedEffect(Unit) { reload(true) }

    LaunchedEffect(range) {
        selectedIndex = -1
        if (range == ChartRange.H1 && minutes.isEmpty()) {
            reload(false)
        }
    }

    LaunchedEffect(range) {
        while (isActive) {
            delay(if (range == ChartRange.H1) 15_000 else 30_000)
            reload(full = false)
        }
    }

    val points = series()
    val groupedNft = TokenChartData.groupNftEvents(nftEvents, range)
    val filteredNft = filterNftEvents(groupedNft, filters)
    val nftEventCount = filteredNft.values.sumOf { it.size }
    val (chartMarkers, diceBands) = TokenChartData.buildChartMarkers(
        points = points,
        nftByTime = filteredNft,
        range = range,
        showDice = filters.dice,
    )
    val sel = when {
        selectedIndex in points.indices -> points[selectedIndex]
        points.isNotEmpty() -> points.last()
        else -> null
    }
    val first = points.firstOrNull()?.value ?: 0.0
    val last = points.lastOrNull()?.value ?: 0.0
    val rangeDelta = last - first
    val hi = points.maxOfOrNull { it.value } ?: 0.0
    val lo = points.minOfOrNull { it.value } ?: 0.0
    val up = rangeDelta >= 0
    val accent = if (up) Mm3Colors.Green else Mm3Colors.Orange

    Mm3Screen(
        title = "MM3 CHART",
        subtitle = buildString {
            append(status)
            liveValue?.let { append(" · ${TokenChartData.formatValue(it)} MM3") }
        },
    ) {
        // Δ header
        Mm3Panel(accent = accent) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        TokenChartData.formatDelta(rangeDelta),
                        color = accent,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                    )
                    Text(
                        TokenChartData.formatPct(rangeDelta, first),
                        color = accent.copy(alpha = 0.85f),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                    )
                }
                Text(
                    range.key.uppercase(),
                    color = Mm3Colors.Cyan,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    letterSpacing = 1.sp,
                )
            }
        }

        // Range chips
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            ChartRange.ALL_RANGES.forEach { r ->
                val on = range == r
                Box(
                    Modifier
                        .border(
                            1.dp,
                            if (on) Mm3Colors.Cyan.copy(alpha = 0.7f) else Mm3Colors.Muted.copy(alpha = 0.3f),
                            RoundedCornerShape(2.dp),
                        )
                        .background(
                            if (on) Mm3Colors.Cyan.copy(alpha = 0.15f) else Color.Transparent,
                            RoundedCornerShape(2.dp),
                        )
                        .clickable { range = r }
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                ) {
                    Text(
                        r.key.uppercase(),
                        color = if (on) Mm3Colors.Cyan else Mm3Colors.Muted,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                    )
                }
            }
        }

        // H / L — compact inline chips
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            StatChip("H", TokenChartData.formatValue(hi), Mm3Colors.Green, Modifier.weight(1f))
            StatChip("L", TokenChartData.formatValue(lo), Mm3Colors.Orange, Modifier.weight(1f))
            StatChip("N", "${points.size}", Mm3Colors.Cyan, Modifier.weight(0.55f))
            if (nftEventCount > 0) {
                StatChip("◈", "$nftEventCount", Mm3Colors.Magenta, Modifier.weight(0.7f))
            }
        }

        // Layer filters (match web chart modifiers)
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            CHART_FILTER_KEYS.forEach { key ->
                val on = when (key) {
                    "dice" -> filters.dice
                    "mining" -> filters.mining
                    "trading" -> filters.trading
                    "squeeze" -> filters.squeeze
                    "relaying" -> filters.relaying
                    else -> true
                }
                val label = when (key) {
                    "dice" -> if (es) "dado" else "dice"
                    "mining" -> if (es) "mining" else "mining"
                    "trading" -> if (es) "trade" else "trading"
                    "squeeze" -> if (es) "squeeze" else "squeeze"
                    "relaying" -> if (es) "relay" else "relaying"
                    else -> key
                }
                Box(
                    Modifier
                        .border(
                            1.dp,
                            if (on) Mm3Colors.Cyan.copy(alpha = 0.45f) else Mm3Colors.Muted.copy(alpha = 0.25f),
                            RoundedCornerShape(2.dp),
                        )
                        .background(
                            if (on) Mm3Colors.Cyan.copy(alpha = 0.12f) else Color.Transparent,
                            RoundedCornerShape(2.dp),
                        )
                        .clickable {
                            filters = when (key) {
                                "dice" -> filters.copy(dice = !filters.dice)
                                "mining" -> filters.copy(mining = !filters.mining)
                                "trading" -> filters.copy(trading = !filters.trading)
                                "squeeze" -> filters.copy(squeeze = !filters.squeeze)
                                "relaying" -> filters.copy(relaying = !filters.relaying)
                                else -> filters
                            }
                        }
                        .padding(horizontal = 8.dp, vertical = 5.dp),
                ) {
                    Text(
                        label.uppercase(),
                        color = if (on) Mm3Colors.Cyan else Mm3Colors.Muted,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Black,
                        fontSize = 9.sp,
                        letterSpacing = 0.8.sp,
                    )
                }
            }
        }

        // Canvas chart
        Mm3Panel(accent = Mm3Colors.Cyan) {
            if (points.isEmpty()) {
                Text(
                    if (es) "sin datos · $status" else "no data · $status",
                    color = Mm3Colors.Muted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                )
            } else {
                TokenAreaChart(
                    points = points,
                    selectedIndex = if (selectedIndex in points.indices) selectedIndex else points.lastIndex,
                    lineColor = accent,
                    markers = chartMarkers,
                    diceBands = if (filters.dice) diceBands else emptyList(),
                    onSelect = { selectedIndex = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp),
                )
            }
        }

        // Selected point detail
        if (sel != null) {
            ChartPointDetailPanel(
                point = sel,
                label = sel.time,
                range = range,
                nftEvents = if (filters.dice) filteredNft[sel.time] ?: emptyList() else emptyList(),
                showDice = filters.dice,
                es = es,
            )
        }
    }
}

private fun filterNftEvents(
    grouped: Map<String, List<NftEvent>>,
    filters: ChartFilters,
): Map<String, List<NftEvent>> {
    return grouped.mapValues { (_, list) ->
        list.filter { ev ->
            when (TokenChartData.chartEventCategory(ev.emoji, ev.eventType)) {
                "mining" -> filters.mining
                "trading" -> filters.trading
                "squeeze" -> filters.squeeze
                "relaying" -> filters.relaying
                else -> true
            }
        }
    }.filterValues { it.isNotEmpty() }
}

@Composable
private fun ChartPointDetailPanel(
    point: ChartPoint,
    label: String,
    range: ChartRange,
    nftEvents: List<NftEvent>,
    showDice: Boolean,
    es: Boolean,
) {
    val diceMod = if (showDice) TokenChartData.diceModifierForPoint(label, range) else null
    Mm3Panel(accent = Mm3Colors.Magenta) {
        Text(
            if (es) "⏱ $label" else "⏱ $label",
            color = Mm3Colors.Magenta,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            letterSpacing = 1.sp,
        )
        Text(
            "${TokenChartData.formatValue(point.value)} MM3",
            color = Mm3Colors.Text,
            fontFamily = FontFamily.Monospace,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
        )
        if (point.delta != 0.0) {
            Text(
                "${if (es) "Δ" else "Δ"} ${TokenChartData.formatDelta(point.delta)}",
                color = if (point.delta >= 0) Mm3Colors.Green else Mm3Colors.Orange,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(
            if (es) "DESGLOSE" else "BREAKDOWN",
            color = Mm3Colors.CyanDim,
            fontFamily = FontFamily.Monospace,
            fontSize = 9.sp,
            letterSpacing = 1.sp,
        )
        BreakdownLine(if (es) "mined" else "mined", point.minedDelta)
        BreakdownLine(if (es) "nftji" else "nftji", point.nftjiDelta)
        BreakdownLine("🎲 node", point.nodeDiceDelta)
        BreakdownLine("🚙 rl", point.rlMountDelta)
        BreakdownLine(
            (if (es) "trade" else "trade") + tradeCounts(point.tradeWalletCount, point.tradeGoogleCount),
            point.tradeDelta,
        )
        BreakdownLine(if (es) "market" else "market", point.marketDelta)
        if (showDice) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("🎲", color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                Text(
                    if (diceMod != null) {
                        val sign = if (diceMod >= 0) "+" else ""
                        "$sign${(diceMod * 100).roundToInt()}%"
                    } else {
                        "—"
                    },
                    color = when {
                        diceMod == null -> Mm3Colors.Muted
                        diceMod < 0 -> Mm3Colors.Cyan
                        else -> Color(0xFFFB923C)
                    },
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        if (nftEvents.isNotEmpty()) {
            Spacer(Modifier.height(6.dp))
            Text(
                if (es) "EVENTOS NFTJI" else "NFTJI EVENTS",
                color = Mm3Colors.CyanDim,
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
                letterSpacing = 1.sp,
            )
            nftEvents.take(6).forEach { ev ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(
                        "${ev.emoji} ${formatWalletLabel(ev.wallet)}",
                        color = Mm3Colors.Muted,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        maxLines = 1,
                    )
                    Text(
                        TokenChartData.formatDelta(ev.deltaMm3),
                        color = if (ev.deltaMm3 >= 0) Mm3Colors.Green else Mm3Colors.Orange,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun StatChip(
    label: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier
            .border(1.dp, color.copy(alpha = 0.35f), RoundedCornerShape(2.dp))
            .background(Mm3Colors.Panel.copy(alpha = 0.9f), RoundedCornerShape(2.dp))
            .padding(horizontal = 6.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            color = color,
            fontFamily = FontFamily.Monospace,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            value,
            color = Mm3Colors.Text,
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
            maxLines = 1,
        )
    }
}

@Composable
private fun BreakdownLine(label: String, value: Double, extra: String = "") {
    if (value == 0.0 && extra.isEmpty()) return
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
        Text(
            TokenChartData.formatDelta(value) + extra,
            color = if (value >= 0) Mm3Colors.CyanDim else Mm3Colors.Orange,
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
        )
    }
}

private fun tradeCounts(w: Int, g: Int): String {
    val parts = buildList {
        if (w > 0) add("${w}W")
        if (g > 0) add("${g}G")
    }
    return if (parts.isEmpty()) "" else " (${parts.joinToString(" · ")})"
}

@Composable
private fun TokenAreaChart(
    points: List<ChartPoint>,
    selectedIndex: Int,
    lineColor: Color,
    markers: List<ChartMarker>,
    diceBands: List<DiceOverlayBand>,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    val labelMinGapPx = with(density) { 40.dp.toPx() }
    val labelTextPx = with(density) { 9.sp.toPx() }
    val badgeTextPx = with(density) { 7.sp.toPx() }
    val padL = 8f
    val padR = 8f
    val padT = 18f
    val padB = 28f

    Canvas(
        modifier
            .pointerInput(points) {
                detectTapGestures { offset ->
                    if (points.isEmpty()) return@detectTapGestures
                    val w = size.width - padL - padR
                    val x = (offset.x - padL).coerceIn(0f, w)
                    val idx = if (points.size == 1) 0
                    else ((x / w) * (points.size - 1)).toInt().coerceIn(0, points.lastIndex)
                    onSelect(idx)
                }
            },
    ) {
        val w = size.width - padL - padR
        val h = size.height - padT - padB
        if (w <= 0f || h <= 0f || points.isEmpty()) return@Canvas

        val minV = points.minOf { it.value }
        val maxV = points.maxOf { it.value }
        val span = max(maxV - minV, abs(maxV) * 0.001).coerceAtLeast(1e-12)

        fun xAt(i: Int): Float =
            if (points.size == 1) padL + w / 2f
            else padL + (i.toFloat() / (points.size - 1)) * w

        fun yAt(v: Double): Float =
            padT + h * (1f - ((v - minV) / span).toFloat().coerceIn(0f, 1f))

        // grid
        val grid = Mm3Colors.Cyan.copy(alpha = 0.08f)
        for (i in 0..4) {
            val y = padT + h * (i / 4f)
            drawLine(grid, Offset(padL, y), Offset(padL + w, y), strokeWidth = 1f)
        }

        // 1h dice window bands (subtle fill behind the line)
        diceBands.forEach { band ->
            val x1 = xAt(band.startIndex)
            val x2 = xAt(band.endIndex)
            val bandColor = TokenChartData.chartDiceColor(band.modifier)
            drawRect(
                color = bandColor.copy(alpha = 0.10f),
                topLeft = Offset(x1, padT),
                size = androidx.compose.ui.geometry.Size(
                    (x2 - x1).coerceAtLeast(2f),
                    h,
                ),
            )
        }

        val linePath = Path()
        val fillPath = Path()
        points.forEachIndexed { i, p ->
            val x = xAt(i)
            val y = yAt(p.value)
            if (i == 0) {
                linePath.moveTo(x, y)
                fillPath.moveTo(x, padT + h)
                fillPath.lineTo(x, y)
            } else {
                linePath.lineTo(x, y)
                fillPath.lineTo(x, y)
            }
        }
        fillPath.lineTo(xAt(points.lastIndex), padT + h)
        fillPath.close()

        drawPath(
            fillPath,
            brush = Brush.verticalGradient(
                colors = listOf(lineColor.copy(alpha = 0.35f), lineColor.copy(alpha = 0.02f)),
                startY = padT,
                endY = padT + h,
            ),
        )
        drawPath(
            linePath,
            color = lineColor,
            style = Stroke(width = 2.5f, cap = StrokeCap.Round),
        )

        // Dice-colored line segments inside active windows (1h)
        diceBands.forEach { band ->
            val bandColor = TokenChartData.chartDiceColor(band.modifier)
            val seg = Path()
            for (i in band.startIndex..band.endIndex) {
                val x = xAt(i)
                val y = yAt(points[i].value)
                if (i == band.startIndex) seg.moveTo(x, y) else seg.lineTo(x, y)
            }
            drawPath(
                seg,
                color = bandColor,
                style = Stroke(width = 3f, cap = StrokeCap.Round),
            )
        }

        // Marker hairlines + dots on the series
        markers.forEach { marker ->
            val idx = marker.index.coerceIn(0, points.lastIndex)
            val x = xAt(idx)
            val y = yAt(points[idx].value)
            val isDice = marker.kind != ChartMarkerKind.NFT
            val lineAlpha = if (isDice) 0.55f else 0.35f
            drawLine(
                marker.color.copy(alpha = lineAlpha),
                Offset(x, padT),
                Offset(x, padT + h),
                strokeWidth = if (isDice) 1.5f else 1f,
            )
            drawCircle(marker.color, radius = if (isDice) 4f else 3.5f, center = Offset(x, y))
            drawCircle(Mm3Colors.BgDeep, radius = 1.5f, center = Offset(x, y))
        }

        // Compact labels — skip when markers crowd (selected point always labeled)
        val labelPaint = Paint().apply {
            isAntiAlias = true
            textSize = labelTextPx
            typeface = Typeface.MONOSPACE
        }
        val badgePaint = Paint().apply {
            isAntiAlias = true
            textSize = badgeTextPx
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        }
        var lastLabelX = Float.NEGATIVE_INFINITY
        val sel = selectedIndex.coerceIn(0, points.lastIndex)
        markers
            .sortedBy { it.index }
            .forEach { marker ->
                val idx = marker.index
                val x = xAt(idx)
                val y = yAt(points[idx].value)
                val force = idx == sel
                if (!force && x - lastLabelX < labelMinGapPx) return@forEach

                val label = when (marker.kind) {
                    ChartMarkerKind.NFT -> {
                        if (marker.emojiHint.isNotEmpty()) marker.emojiHint.take(2) else "◈"
                    }
                    ChartMarkerKind.DICE_END -> "0%"
                    ChartMarkerKind.DICE_START, ChartMarkerKind.DICE_HOUR -> {
                        val mod = marker.diceModifier
                        if (mod == null) "🎲"
                        else {
                            val sign = if (mod >= 0) "+" else ""
                            "🎲$sign${(mod * 100).roundToInt()}%"
                        }
                    }
                }

                val labelY = (y - 10f).coerceAtLeast(padT + 8f)
                drawContext.canvas.nativeCanvas.apply {
                    labelPaint.color = android.graphics.Color.argb(
                        230,
                        (marker.color.red * 255).roundToInt(),
                        (marker.color.green * 255).roundToInt(),
                        (marker.color.blue * 255).roundToInt(),
                    )
                    val textW = labelPaint.measureText(label)
                    drawText(label, x - textW / 2f, labelY, labelPaint)
                    if (marker.kind == ChartMarkerKind.NFT && marker.nftCount > 1) {
                        badgePaint.color = android.graphics.Color.argb(
                            255,
                            (marker.color.red * 255).roundToInt(),
                            (marker.color.green * 255).roundToInt(),
                            (marker.color.blue * 255).roundToInt(),
                        )
                        val badge = marker.nftCount.toString()
                        drawText(badge, x + textW / 2f + 2f, labelY - 2f, badgePaint)
                    }
                }
                lastLabelX = x
            }

        // selection cursor
        val sx = xAt(sel)
        val sy = yAt(points[sel].value)
        drawLine(
            lineColor.copy(alpha = 0.45f),
            Offset(sx, padT),
            Offset(sx, padT + h),
            strokeWidth = 1.5f,
        )
        drawCircle(lineColor, radius = 5f, center = Offset(sx, sy))
        drawCircle(Mm3Colors.BgDeep, radius = 2.5f, center = Offset(sx, sy))
    }

    // time labels under chart
    if (points.isNotEmpty()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(top = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(points.first().time, color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 9.sp)
            if (points.size > 2) {
                Text(
                    points[points.size / 2].time,
                    color = Mm3Colors.Muted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 9.sp,
                )
            }
            Text(points.last().time, color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 9.sp)
        }
    }
}

private fun abs(v: Double): Double = if (v < 0) -v else v
