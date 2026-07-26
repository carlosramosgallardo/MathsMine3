package xyz.mathsmine3.nativeapp.ui.screens

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.ui.components.Mm3Button
import xyz.mathsmine3.nativeapp.ui.components.Mm3Field
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors
import kotlin.random.Random

@Composable
fun TrainingScreen(session: Session, api: Mm3Api) {
    var a by remember { mutableIntStateOf(Random.nextInt(2, 20)) }
    var b by remember { mutableIntStateOf(Random.nextInt(2, 20)) }
    var op by remember { mutableStateOf("+") }
    var answer by remember { mutableStateOf("") }
    var streak by remember { mutableIntStateOf(0) }
    var message by remember { mutableStateOf("Solve to train.") }

    fun nextProblem() {
        a = Random.nextInt(2, 20)
        b = Random.nextInt(2, 20)
        op = listOf("+", "-", "×").random()
        answer = ""
    }

    fun expected(): Int = when (op) {
        "+" -> a + b
        "-" -> a - b
        else -> a * b
    }

    Mm3Screen(
        title = "TRAINING",
        subtitle = if (session.wallet != null) "wallet · practice + economy" else "anonymous practice",
    ) {
        Mm3Panel(accent = ColorAmber) {
            Text(
                "$a $op $b = ?",
                color = Mm3Colors.Text,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp,
            )
            Text("streak · $streak", color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            Mm3Field(value = answer, onValueChange = { answer = it.filter { ch -> ch == '-' || ch.isDigit() } }, label = "Answer")
            Mm3Button(
                text = "Submit",
                accent = ColorAmber,
                onClick = {
                    if (answer.toIntOrNull() == expected()) {
                        streak++
                        message = "correct · streak $streak"
                        nextProblem()
                    } else {
                        streak = 0
                        message = "wrong · expected ${expected()}"
                    }
                },
            )
            Text(message, color = Mm3Colors.CyanDim, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
    }
}

private val ColorAmber = androidx.compose.ui.graphics.Color(0xFFF59E0B)
