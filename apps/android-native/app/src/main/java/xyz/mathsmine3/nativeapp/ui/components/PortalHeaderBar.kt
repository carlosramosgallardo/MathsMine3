package xyz.mathsmine3.nativeapp.ui.components

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

/** Default until JS reports the real portal header height (~mobile portrait). */
private const val DEFAULT_HEADER_HEIGHT_DP = 168

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PortalHeaderBar(
    session: Session,
    onNativeRoute: (String) -> Unit,
    onAuth: () -> Unit,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    var heightDp by remember { mutableIntStateOf(DEFAULT_HEADER_HEIGHT_DP) }
    val routeHandler = remember(onNativeRoute) { onNativeRoute }
    val authHandler = remember(onAuth) { onAuth }

    AndroidView(
        factory = { ctx ->
            PortalHeaderWebView(ctx).apply {
                setSessionWallet(session.wallet)
                this.onNativeRoute = routeHandler
                this.onAuthRequest = authHandler
                onExternalUrl = { url ->
                    runCatching {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    }
                }
                onHeaderHeightPx = { px ->
                    val dp = with(density) { px.toDp().value.toInt().coerceIn(96, 260) }
                    heightDp = dp
                }
                loadHeader()
            }
        },
        update = { view ->
            view.setSessionWallet(session.wallet)
            view.onNativeRoute = routeHandler
            view.onAuthRequest = authHandler
        },
        modifier = Modifier
            .fillMaxWidth()
            .height(heightDp.dp)
            .background(Mm3Colors.BgDeep),
        onRelease = { view ->
            view.onNativeRoute = null
            view.onAuthRequest = null
            view.onExternalUrl = null
            view.onHeaderHeightPx = null
            view.stopLoading()
            view.destroy()
        },
    )
}
