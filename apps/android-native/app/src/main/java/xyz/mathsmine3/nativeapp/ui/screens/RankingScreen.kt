package xyz.mathsmine3.nativeapp.ui.screens

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

@Composable
fun RankingScreen(api: Mm3Api) {
    var body by remember { mutableStateOf("loading leaderboard…") }

    LaunchedEffect(Unit) {
        body = withContext(Dispatchers.IO) {
            runCatching { api.leaderboard().readText() }.getOrElse { it.message ?: "error" }
        }
    }

    Mm3Screen(title = "RANKING", subtitle = "GET /api/leaderboard") {
        Mm3Panel(accent = Color(0xFFFBBF24)) {
            Text(body, color = Mm3Colors.Text, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
        }
    }
}
