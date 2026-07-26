package xyz.mathsmine3.nativeapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

/** Portal grid + radial glow — same idea as body background on the web. */
fun Modifier.mm3PortalBackground(): Modifier = this
    .background(Mm3Colors.Bg)
    .drawBehind {
        val step = 32.dp.toPx()
        val grid = Mm3Colors.Grid
        var x = 0f
        while (x < size.width) {
            drawLine(grid, Offset(x, 0f), Offset(x, size.height), strokeWidth = 1f)
            x += step
        }
        var y = 0f
        while (y < size.height) {
            drawLine(grid, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
            y += step
        }
    }

@Composable
fun Mm3Screen(
    title: String,
    subtitle: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .mm3PortalBackground()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            "▸ $title",
            style = TextStyle(
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = Mm3Colors.Cyan,
                letterSpacing = 1.sp,
            ),
        )
        subtitle?.let {
            Text(it, color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
        content()
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
fun Mm3Panel(
    modifier: Modifier = Modifier,
    accent: Color = Mm3Colors.Cyan,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .fillMaxWidth()
            .border(1.dp, accent.copy(alpha = 0.35f), RoundedCornerShape(2.dp))
            .background(Mm3Colors.Panel.copy(alpha = 0.92f), RoundedCornerShape(2.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        content = content,
    )
}

@Composable
fun Mm3Button(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = Mm3Colors.Cyan,
    enabled: Boolean = true,
    filled: Boolean = true,
) {
    val bg = when {
        !enabled -> Mm3Colors.PanelSoft
        filled -> accent.copy(alpha = 0.18f)
        else -> Color.Transparent
    }
    val border = if (enabled) accent.copy(alpha = 0.55f) else Mm3Colors.Muted.copy(alpha = 0.3f)
    Box(
        modifier
            .fillMaxWidth()
            .height(44.dp)
            .border(1.dp, border, RoundedCornerShape(2.dp))
            .background(bg, RoundedCornerShape(2.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text.uppercase(),
            color = if (enabled) accent else Mm3Colors.Muted,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            letterSpacing = 1.sp,
        )
    }
}

@Composable
fun Mm3Field(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true,
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label.uppercase(), color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
        Box(
            Modifier
                .fillMaxWidth()
                .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.35f), RoundedCornerShape(2.dp))
                .background(Mm3Colors.BgDeep, RoundedCornerShape(2.dp))
                .padding(horizontal = 10.dp, vertical = 12.dp),
        ) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = singleLine,
                textStyle = TextStyle(
                    fontFamily = FontFamily.Monospace,
                    fontSize = 13.sp,
                    color = Mm3Colors.Text,
                ),
                cursorBrush = SolidColor(Mm3Colors.Cyan),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
fun Mm3PortalCard(
    icon: String,
    name: String,
    desc: String,
    accent: Color,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .border(1.dp, accent.copy(alpha = 0.4f), RoundedCornerShape(2.dp))
            .background(Mm3Colors.Panel.copy(alpha = 0.9f), RoundedCornerShape(2.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(icon, fontSize = 22.sp, modifier = Modifier.width(36.dp))
        Spacer(Modifier.width(8.dp))
        Column(Modifier.weight(1f)) {
            Text(
                name.uppercase(),
                color = accent,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                letterSpacing = 1.sp,
            )
            Text(desc, color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
        Text("›", color = accent, fontSize = 18.sp)
    }
}

@Composable
fun Mm3TopBar(
    wallet: String?,
    onAuthClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Mm3Colors.BgDeep.copy(alpha = 0.95f))
            .border(width = Dp.Hairline, color = Mm3Colors.Cyan.copy(alpha = 0.25f))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("⬡", color = Mm3Colors.Cyan, fontSize = 18.sp)
        Spacer(Modifier.width(8.dp))
        Column(Modifier.weight(1f)) {
            Text(
                "MATHSMINE3",
                color = Mm3Colors.Cyan,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                letterSpacing = 2.sp,
            )
            Text(
                if (wallet != null) shorten(wallet) else "guest · connect to play",
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
            )
        }
        Box(
            Modifier
                .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.45f), RoundedCornerShape(2.dp))
                .clickable(onClick = onAuthClick)
                .padding(horizontal = 10.dp, vertical = 6.dp),
        ) {
            Text(
                if (wallet != null) "ACCOUNT" else "CONNECT",
                color = Mm3Colors.Cyan,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
            )
        }
    }
}

private fun shorten(w: String): String =
    if (w.length > 12) "${w.take(6)}…${w.takeLast(4)}" else w
