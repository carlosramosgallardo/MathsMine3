package xyz.mathsmine3.nativeapp

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import xyz.mathsmine3.nativeapp.auth.WalletAuthManager
import xyz.mathsmine3.nativeapp.ui.Mm3AppRoot
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Theme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as Mm3App
        handleAuthDeepLink(intent, app.container)

        setContent {
            Mm3Theme {
                Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF070B0F)) {
                    Mm3AppRoot(container = app.container)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAuthDeepLink(intent, (application as Mm3App).container)
    }

    private fun handleAuthDeepLink(intent: Intent?, container: AppContainer) {
        val uri = intent?.data ?: return
        if (uri.scheme != "xyz.mathsmine3.app") return
        val walletAuth = WalletAuthManager(this, container.api, container.sessionRepository)
        lifecycleScope.launch {
            runCatching { walletAuth.completeDeepLink(uri) }
        }
    }
}
