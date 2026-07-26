package xyz.mathsmine3.nativeapp.ui.screens

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
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
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.realtime.SupabaseRealtimeClient
import xyz.mathsmine3.nativeapp.ui.components.Mm3Button
import xyz.mathsmine3.nativeapp.ui.components.Mm3Field
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

@Composable
fun RelayingScreen(
    session: Session,
    api: Mm3Api,
    realtime: SupabaseRealtimeClient,
) {
    val lines = remember { mutableStateListOf<String>() }
    var input by remember { mutableStateOf("") }
    var status by remember {
        mutableStateOf(if (realtime.isConfigured) "realtime ready" else "realtime offline (keys from .env.local)")
    }
    val scope = rememberCoroutineScope()

    DisposableEffect(Unit) {
        realtime.connect()
        realtime.joinRelaying()
        onDispose { }
    }

    Mm3Screen(title = "RELAYING", subtitle = status) {
        Mm3Panel {
            if (lines.isEmpty()) {
                Text("> waiting for input_", color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            } else {
                lines.takeLast(30).forEach { line ->
                    Text(line, color = Mm3Colors.CyanDim, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                }
            }
            Mm3Field(value = input, onValueChange = { input = it }, label = "Command")
            Mm3Button(
                text = "Send /api/relay/exec",
                onClick = {
                    val w = session.wallet
                    val cmd = input.trim()
                    if (cmd.isEmpty()) return@Mm3Button
                    lines += "> $cmd"
                    input = ""
                    if (w == null) {
                        lines += "error: connect wallet"
                        return@Mm3Button
                    }
                    scope.launch {
                        val resp = withContext(Dispatchers.IO) {
                            runCatching {
                                api.relayExec(mapOf("wallet" to w, "command" to cmd, "text" to cmd)).readText()
                            }.getOrElse { it.message ?: "error" }
                        }
                        lines += resp
                        status = "sent"
                    }
                },
            )
        }
    }
}
