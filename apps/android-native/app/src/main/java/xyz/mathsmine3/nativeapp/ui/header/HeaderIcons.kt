package xyz.mathsmine3.nativeapp.ui.header

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Matches web `PowerIcon` in components/AuthBar.jsx (SVG stroke power button).
 * Unicode ⏻ (U+23FB) is missing from most Android fonts, so we draw it explicitly.
 */
@Composable
fun PowerIcon(
    connected: Boolean = true,
    size: Dp = 15.dp,
    modifier: Modifier = Modifier,
) {
    val color = if (connected) Color(0xFF22D3EE) else Color(0xFF475569)
    Box(
        modifier
            .size(size)
            .drawBehind {
                val scale = this.size.width / 24f
                val stroke = 2.2f * scale
                val style = Stroke(width = stroke, cap = StrokeCap.Round)

                drawLine(
                    color = color,
                    start = Offset(12f * scale, 2f * scale),
                    end = Offset(12f * scale, 12f * scale),
                    strokeWidth = stroke,
                    cap = StrokeCap.Round,
                )

                // SVG path: M18.36 6.64a9 9 0 1 1-12.73 0  (circle r=9 centered at 12,12)
                drawArc(
                    color = color,
                    startAngle = -40f,
                    sweepAngle = 260f,
                    useCenter = false,
                    topLeft = Offset(3f * scale, 3f * scale),
                    size = Size(18f * scale, 18f * scale),
                    style = style,
                )
            },
    )
}
