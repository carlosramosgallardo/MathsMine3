package xyz.mathsmine3.nativeapp.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import xyz.mathsmine3.nativeapp.AppContainer
import xyz.mathsmine3.nativeapp.BuildConfig
import xyz.mathsmine3.nativeapp.auth.GoogleAuthManager
import xyz.mathsmine3.nativeapp.auth.WalletAuthManager
import xyz.mathsmine3.nativeapp.ui.components.Mm3Button
import xyz.mathsmine3.nativeapp.ui.components.Mm3Field
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

@Composable
fun AuthScreen(container: AppContainer, onDone: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val google = remember { GoogleAuthManager(context, container.api, container.sessionRepository) }
    val walletAuth = remember { WalletAuthManager(context, container.api, container.sessionRepository) }
    var address by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    val googleLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        scope.launch {
            busy = true
            message = null
            try {
                val w = google.handleSignInResult(result.data)
                message = "ok · $w"
                onDone()
            } catch (e: Exception) {
                message = e.message
            } finally {
                busy = false
            }
        }
    }

    Mm3Screen(title = "CONNECT", subtitle = "Same create-account API as the web portal.") {
        Mm3Panel {
            Text(
                "Google OAuth → virtual 0x wallet",
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
            )
            Mm3Button(
                text = "Continue with Google",
                onClick = {
                    try {
                        googleLauncher.launch(google.signInIntent())
                    } catch (e: Exception) {
                        message = e.message
                    }
                },
                enabled = !busy,
            )
        }

        Mm3Panel(accent = Mm3Colors.Green) {
            Text(
                "Wallet · sign with MetaMask / WalletConnect (EIP-191)",
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
            )
            Mm3Button(
                text = "Sign in with wallet",
                onClick = { walletAuth.openWalletSignIn(context) },
                enabled = !busy,
                accent = Mm3Colors.Green,
            )
            if (BuildConfig.DEBUG) {
                Mm3Field(value = address, onValueChange = { address = it }, label = "Wallet 0x… (debug only)")
                Mm3Button(
                    text = "Connect address (debug)",
                    onClick = {
                        scope.launch {
                            busy = true
                            message = null
                            try {
                                val w = walletAuth.connectAddress(address)
                                message = "ok · $w (no session — use sign-in above)"
                                onDone()
                            } catch (e: Exception) {
                                message = e.message
                            } finally {
                                busy = false
                            }
                        }
                    },
                    enabled = !busy,
                    filled = false,
                    accent = Mm3Colors.Green,
                )
            }
        }

        Mm3Button(
            text = "Sign out",
            onClick = {
                scope.launch {
                    google.signOut()
                    message = "signed out"
                }
            },
            filled = false,
            accent = Mm3Colors.Danger,
        )

        message?.let {
            Text(it, color = Mm3Colors.CyanDim, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
    }
}
