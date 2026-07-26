package xyz.mathsmine3.nativeapp.ui.screens

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.ui.components.Mm3Button
import xyz.mathsmine3.nativeapp.ui.components.Mm3Field
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

@Composable
fun TradingScreen(session: Session, api: Mm3Api) {
    var quote by remember { mutableStateOf("…") }
    var amount by remember { mutableStateOf("1") }
    var result by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        quote = withContext(Dispatchers.IO) {
            runCatching { api.tokenValue().readText() }.getOrElse { it.message ?: "error" }
        }
    }

    Mm3Screen(title = "TRADING", subtitle = "POST /api/trade/exec · fictional MM3 exchange") {
        Mm3Panel(accent = Mm3Colors.Green) {
            Text("quote", color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
            Text(quote, color = Mm3Colors.Green, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            Mm3Field(value = amount, onValueChange = { amount = it }, label = "Amount")
            Mm3Button(
                text = "Exec sell",
                accent = Mm3Colors.Green,
                onClick = {
                    val w = session.wallet
                    if (w == null) {
                        result = "connect wallet first"
                        return@Mm3Button
                    }
                    scope.launch {
                        result = withContext(Dispatchers.IO) {
                            runCatching {
                                api.tradeExec(
                                    mapOf(
                                        "wallet" to w,
                                        "amount" to (amount.toDoubleOrNull() ?: 1.0),
                                        "side" to "sell",
                                    )
                                ).readText()
                            }.getOrElse { it.message ?: "error" }
                        }
                    }
                },
            )
            result?.let {
                Text(it, color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
            }
        }
    }
}
