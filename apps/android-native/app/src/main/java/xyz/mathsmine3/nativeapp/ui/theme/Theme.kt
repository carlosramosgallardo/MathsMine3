package xyz.mathsmine3.nativeapp.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

object Mm3Colors {
    val Cyan = Color(0xFF22D3EE)
    val CyanDim = Color(0xFF67E8F9)
    val Green = Color(0xFF4ADE80)
    val Yellow = Color(0xFFFACC15)
    val Orange = Color(0xFFF97316)
    val Magenta = Color(0xFFE879F9)
    val Bg = Color(0xFF070B0F)
    val BgDeep = Color(0xFF030609)
    val Panel = Color(0xFF0C141C)
    val PanelSoft = Color(0xFF101A23)
    val Line = Color(0x5222D3EE) // ~32% cyan
    val Text = Color(0xFFD7F9FF)
    val Muted = Color(0xFF91A2B7)
    val Danger = Color(0xFFF87171)
    val Grid = Color(0x0D7DD3FC) // ~5% sky
}

private val Scheme = darkColorScheme(
    primary = Mm3Colors.Cyan,
    onPrimary = Mm3Colors.Bg,
    secondary = Mm3Colors.CyanDim,
    background = Mm3Colors.Bg,
    onBackground = Mm3Colors.Text,
    surface = Mm3Colors.Panel,
    onSurface = Mm3Colors.Text,
    surfaceVariant = Mm3Colors.PanelSoft,
    outline = Mm3Colors.Line,
    error = Mm3Colors.Danger,
)

private val Mono = FontFamily.Monospace

private val Type = Typography(
    displayLarge = TextStyle(fontFamily = Mono, fontWeight = FontWeight.Bold, fontSize = 28.sp, color = Mm3Colors.Cyan, letterSpacing = 1.sp),
    headlineMedium = TextStyle(fontFamily = Mono, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Mm3Colors.Cyan),
    headlineSmall = TextStyle(fontFamily = Mono, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Mm3Colors.Cyan),
    titleMedium = TextStyle(fontFamily = Mono, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Mm3Colors.Text),
    titleSmall = TextStyle(fontFamily = Mono, fontWeight = FontWeight.Medium, fontSize = 12.sp, color = Mm3Colors.CyanDim),
    bodyLarge = TextStyle(fontFamily = Mono, fontSize = 14.sp, color = Mm3Colors.Text, lineHeight = 20.sp),
    bodyMedium = TextStyle(fontFamily = Mono, fontSize = 12.sp, color = Mm3Colors.Text, lineHeight = 18.sp),
    bodySmall = TextStyle(fontFamily = Mono, fontSize = 11.sp, color = Mm3Colors.Muted, lineHeight = 16.sp),
    labelLarge = TextStyle(fontFamily = Mono, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Mm3Colors.Cyan),
    labelMedium = TextStyle(fontFamily = Mono, fontSize = 11.sp, color = Mm3Colors.Muted),
)

@Composable
fun Mm3Theme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Scheme, typography = Type, content = content)
}
