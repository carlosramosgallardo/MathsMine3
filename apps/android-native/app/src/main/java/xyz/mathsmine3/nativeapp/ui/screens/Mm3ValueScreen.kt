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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import xyz.mathsmine3.nativeapp.chart.ChartPoint
import xyz.mathsmine3.nativeapp.chart.ChartRange
import xyz.mathsmine3.nativeapp.chart.HourlyRow
import xyz.mathsmine3.nativeapp.chart.TokenChartData
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors
import kotlin.math.max

@Composable
fun Mm3ValueScreen(
    api: Mm3Api,
    language: String = "en",
) {
    val es = language.startsWith("es", ignoreCase = true)
    var range by remember { mutableStateOf(ChartRange.H24) }
    var hourly by remember { mutableStateOf<List<HourlyRow>>(emptyList()) }
    var minutes by remember { mutableStateOf<List<ChartPoint>>(emptyList()) }
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
                    val v = runCatching { TokenChartData.parseTokenValue(api.tokenValue().readText()) }
                        .getOrNull()
                    Triple(h, m, v)
                }
            }
            result.onSuccess { (h, m, v) ->
                hourly = h
                if (m.isNotEmpty() || range == ChartRange.H1) minutes = m
                if (v != null) liveValue = v
                status = if (es) "live · ${h.size}h" else "live · ${h.size}h"
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

        // H / L
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatChip("H", TokenChartData.formatValue(hi), Mm3Colors.Green)
            StatChip("L", TokenChartData.formatValue(lo), Mm3Colors.Orange)
            StatChip("N", "${points.size}", Mm3Colors.Cyan)
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
                    onSelect = { selectedIndex = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp),
                )
            }
        }

        // Selected point detail
        if (sel != null) {
            Mm3Panel(accent = Mm3Colors.Magenta) {
                Text(
                    if (es) "PUNTO · ${sel.time}" else "POINT · ${sel.time}",
                    color = Mm3Colors.Magenta,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    letterSpacing = 1.sp,
                )
                Text(
                    "${TokenChartData.formatValue(sel.value)} MM3",
                    color = Mm3Colors.Text,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Δ ${TokenChartData.formatDelta(sel.delta)}",
                    color = if (sel.delta >= 0) Mm3Colors.Green else Mm3Colors.Orange,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                )
                Spacer(Modifier.height(4.dp))
                BreakdownLine("mined", sel.minedDelta)
                BreakdownLine("trade", sel.tradeDelta, extra = tradeCounts(sel.tradeWalletCount, sel.tradeGoogleCount))
                BreakdownLine("nftji", sel.nftjiDelta)
                BreakdownLine("dice", sel.nodeDiceDelta)
                BreakdownLine("rl mount", sel.rlMountDelta)
                BreakdownLine("market", sel.marketDelta)
            }
        }
    }
}

@Composable
private fun StatChip(label: String, value: String, color: Color) {
    Column(
        Modifier
            .border(1.dp, color.copy(alpha = 0.3f), RoundedCornerShape(2.dp))
            .background(Mm3Colors.Panel.copy(alpha = 0.9f), RoundedCornerShape(2.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(label, color = color, fontFamily = FontFamily.Monospace, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        Text(value, color = Mm3Colors.Text, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
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
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val padL = 8f
    val padR = 8f
    val padT = 12f
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

        // selection
        val si = selectedIndex.coerceIn(0, points.lastIndex)
        val sx = xAt(si)
        val sy = yAt(points[si].value)
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
