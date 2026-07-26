package xyz.mathsmine3.nativeapp.ui.screens

import android.annotation.SuppressLint
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.ui.mining.MiningWebView
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun MiningScreen(
    session: Session,
    onBack: () -> Unit = {},
) {
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }

    BackHandler(onBack = onBack)

    Box(Modifier.fillMaxSize().background(Mm3Colors.Bg)) {
        AndroidView(
            factory = { ctx ->
                MiningWebView(ctx).apply {
                    setSessionWallet(session.wallet)
                    loadMining()
                }
            },
            update = { view ->
                view.onReady = {
                    loading = false
                    loadError = null
                }
                view.onLoadError = { msg ->
                    loading = false
                    loadError = msg
                }
                view.setSessionWallet(session.wallet)
            },
            modifier = Modifier.fillMaxSize(),
            onRelease = { view ->
                view.onReady = null
                view.onLoadError = null
                view.stopLoading()
                view.destroy()
            },
        )

        if (loading) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Mm3Colors.Bg.copy(alpha = 0.72f)),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = Mm3Colors.Cyan, strokeWidth = 2.dp)
            }
        }

        loadError?.let { err ->
            Text(
                "MINING LOAD ERROR · $err",
                color = Mm3Colors.Danger,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(24.dp),
            )
        }

        Box(
            Modifier
                .align(Alignment.TopStart)
                .statusBarsPadding()
                .padding(10.dp)
                .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.4f), RoundedCornerShape(2.dp))
                .background(Mm3Colors.BgDeep.copy(alpha = 0.85f), RoundedCornerShape(2.dp))
                .clickable(onClick = onBack)
                .padding(horizontal = 10.dp, vertical = 6.dp),
        ) {
            Text(
                "‹ PORTAL",
                color = Mm3Colors.Cyan,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
            )
        }
    }
}
