package xyz.mathsmine3.nativeapp.ui.screens

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

@Composable
fun SqueezingScreen(session: Session, api: Mm3Api) {
    var disputes by remember { mutableStateOf("loading…") }
    var pool by remember { mutableStateOf("—") }

    LaunchedEffect(session.wallet) {
        withContext(Dispatchers.IO) {
            disputes = runCatching { api.disputes().readText() }.getOrElse { it.message ?: "error" }
            val w = session.wallet
            pool = if (w != null) {
                runCatching { api.myPool(w).readText() }.getOrElse { it.message ?: "error" }
            } else {
                "connect wallet to see pool"
            }
        }
    }

    Mm3Screen(title = "SQUEEZING", subtitle = "Pool disputes & membership") {
        Mm3Panel(accent = Mm3Colors.Danger) {
            Text("// my pool", color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
            Text(pool, color = Mm3Colors.Text, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
        }
        Mm3Panel(accent = Mm3Colors.Orange) {
            Text("// disputes", color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
            Text(disputes, color = Mm3Colors.Text, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
        }
    }
}
