package xyz.mathsmine3.nativeapp.ui.screens

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.WalletBody
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.ui.components.Mm3Button
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

@Composable
fun DailyScreen(session: Session, api: Mm3Api) {
    var result by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Mm3Screen(title = "DAILY TASKS", subtitle = "POST /api/daily-tasks/claim · UTC day") {
        Mm3Panel(accent = Mm3Colors.Magenta) {
            Text(
                "wallet · ${session.wallet ?: "not connected"}",
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
            )
            Mm3Button(
                text = "Claim rewards",
                accent = Mm3Colors.Magenta,
                onClick = {
                    val w = session.wallet
                    if (w == null) {
                        result = "connect wallet first"
                        return@Mm3Button
                    }
                    scope.launch {
                        result = withContext(Dispatchers.IO) {
                            runCatching { api.claimDaily(WalletBody(w)).readText() }
                                .getOrElse { it.message ?: "error" }
                        }
                    }
                },
            )
            result?.let {
                Text(it, color = Mm3Colors.CyanDim, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
            }
        }
    }
}
