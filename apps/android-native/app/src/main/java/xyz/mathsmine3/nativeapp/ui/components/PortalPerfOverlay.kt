package xyz.mathsmine3.nativeapp.ui.components

import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.sp
import kotlin.math.min
import kotlin.math.roundToInt

@Composable
fun PortalPerfOverlay(modifier: Modifier = Modifier) {
    var fps by remember { mutableIntStateOf(0) }
    var cpuLoad by remember { mutableIntStateOf(0) }
    var usedMb by remember { mutableIntStateOf(0) }

    DisposableEffect(Unit) {
        val choreographer = Choreographer.getInstance()
        var frames = 0
        var frameMsSum = 0f
        var lastFrameAt = 0L
        var lastSampleAt = System.nanoTime()
        val targetFrameMs = 1000f / 30f

        val frameCallback = object : Choreographer.FrameCallback {
            override fun doFrame(frameTimeNanos: Long) {
                if (lastFrameAt > 0) {
                    frameMsSum += (frameTimeNanos - lastFrameAt) / 1_000_000f
                    frames++
                }
                lastFrameAt = frameTimeNanos
                choreographer.postFrameCallback(this)
            }
        }
        choreographer.postFrameCallback(frameCallback)

        val handler = Handler(Looper.getMainLooper())
        val sampleRunnable = object : Runnable {
            override fun run() {
                val elapsed = (System.nanoTime() - lastSampleAt) / 1_000_000f
                fps = if (frames > 0 && elapsed > 0f) {
                    ((frames / elapsed) * 1000f).roundToInt()
                } else {
                    0
                }
                val avgFrameMs = if (frames > 0) frameMsSum / frames else 0f
                cpuLoad = if (avgFrameMs > 0f) {
                    min(150, (avgFrameMs / targetFrameMs * 100f).roundToInt())
                } else {
                    0
                }
                val runtime = Runtime.getRuntime()
                usedMb = ((runtime.totalMemory() - runtime.freeMemory()) / 1048576L).toInt()
                frames = 0
                frameMsSum = 0f
                lastSampleAt = System.nanoTime()
                handler.postDelayed(this, 600)
            }
        }
        handler.postDelayed(sampleRunnable, 600)

        onDispose {
            choreographer.removeFrameCallback(frameCallback)
            handler.removeCallbacks(sampleRunnable)
        }
    }

    val fpsColor = perfTone(fps, good = 28, warn = 22)
    val cpuColor = cpuTone(cpuLoad)
    val memColor = memoryTone(usedMb)

    Row(modifier = modifier) {
        Text(
            "${fps}fps",
            color = fpsColor,
            fontFamily = FontFamily.Monospace,
            fontSize = 7.sp,
            letterSpacing = 0.3.sp,
        )
        Text(" · ", color = Color(0xFF334155), fontSize = 7.sp)
        Text(
            "$cpuLoad%",
            color = cpuColor,
            fontFamily = FontFamily.Monospace,
            fontSize = 7.sp,
            letterSpacing = 0.3.sp,
        )
        Text(" · ", color = Color(0xFF334155), fontSize = 7.sp)
        Text(
            "${usedMb}M",
            color = memColor,
            fontFamily = FontFamily.Monospace,
            fontSize = 7.sp,
            letterSpacing = 0.3.sp,
        )
    }
}

private fun perfTone(value: Int, good: Int, warn: Int): Color = when {
    value >= good -> Color(0xFF34D399)
    value >= warn -> Color(0xFFFBBF24)
    else -> Color(0xFFF87171)
}

private fun cpuTone(loadPct: Int): Color = when {
    loadPct <= 55 -> Color(0xFF34D399)
    loadPct <= 85 -> Color(0xFFFBBF24)
    else -> Color(0xFFF87171)
}

private fun memoryTone(usedMb: Int): Color = when {
    usedMb <= 180 -> Color(0xFF34D399)
    usedMb <= 320 -> Color(0xFFFBBF24)
    else -> Color(0xFFF87171)
}
