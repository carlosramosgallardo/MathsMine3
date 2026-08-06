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
fun AuthScreen(
    container: AppContainer,
    language: String = "en",
    onDone: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val es = language.startsWith("es", ignoreCase = true)
    val google = remember { GoogleAuthManager(context, container.api, container.sessionRepository) }
    val walletAuth = remember { WalletAuthManager(context, container.api, container.sessionRepository) }
    var address by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    // Native Play Services path (debug / when Android OAuth SHA matches). Prefer browser for Play builds.
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

    Mm3Screen(
        title = if (es) "CONECTAR" else "CONNECT",
        subtitle = if (es) {
            "Misma API create-account que el portal web."
        } else {
            "Same create-account API as the web portal."
        },
    ) {
        Mm3Panel {
            Text(
                if (es) "Google OAuth → wallet virtual 0x" else "Google OAuth → virtual 0x wallet",
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
            )
            Text(
                if (es) {
                    "Abre el portal en el navegador (mismo cliente Web que mathsmine3.xyz). Vuelve a la app por deep link — funciona en builds de Play sin el error SHA 10."
                } else {
                    "Opens the portal in the browser (same Web client as mathsmine3.xyz). Returns to the app via deep link — works on Play builds without Android SHA error 10."
                },
                color = Mm3Colors.Muted.copy(alpha = 0.85f),
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
            )
            Mm3Button(
                text = if (es) "Continuar con Google" else "Continue with Google",
                onClick = {
                    try {
                        google.openBrowserSignIn(context)
                        message = if (es) {
                            "Navegador abierto · termina el login de Google y vuelve a la app"
                        } else {
                            "Browser opened · finish Google sign-in, then return to the app"
                        }
                    } catch (e: Exception) {
                        message = e.message
                    }
                },
                enabled = !busy,
            )
            if (BuildConfig.DEBUG) {
                Mm3Button(
                    text = if (es) "Google (nativo / debug)" else "Google (native / debug)",
                    onClick = {
                        try {
                            googleLauncher.launch(google.signInIntent())
                        } catch (e: Exception) {
                            message = e.message
                        }
                    },
                    enabled = !busy,
                    filled = false,
                )
            }
        }

        Mm3Panel(accent = Mm3Colors.Green) {
            Text(
                if (es) {
                    "Wallet · abre el navegador → MetaMask / WalletConnect → vuelve a la app"
                } else {
                    "Wallet · opens browser → MetaMask / WalletConnect → returns to app"
                },
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
            )
            Text(
                if (es) {
                    "Necesitas MetaMask (o un wallet WC) en el dispositivo. En emuladores suele fallar — usa la dirección debug abajo."
                } else {
                    "Needs MetaMask (or a WC wallet) on the device. Emulators usually cannot complete this — use debug address below."
                },
                color = Mm3Colors.Muted.copy(alpha = 0.85f),
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
            )
            Mm3Button(
                text = if (es) "🦊 Entrar con wallet" else "🦊 Sign in with wallet",
                onClick = {
                    try {
                        walletAuth.openWalletSignIn(context)
                        message = if (es) {
                            "Navegador abierto · termina el login allí y vuelve a la app"
                        } else {
                            "Browser opened · finish sign-in there, then return to the app"
                        }
                    } catch (e: Exception) {
                        message = e.message
                    }
                },
                enabled = !busy,
                accent = Mm3Colors.Green,
            )
            if (BuildConfig.DEBUG) {
                Mm3Field(
                    value = address,
                    onValueChange = { address = it },
                    label = if (es) "Wallet 0x… (solo debug)" else "Wallet 0x… (debug only)",
                )
                Mm3Button(
                    text = if (es) "Conectar dirección (debug)" else "Connect address (debug)",
                    onClick = {
                        scope.launch {
                            busy = true
                            message = null
                            try {
                                val w = walletAuth.connectAddress(address)
                                message = if (es) {
                                    "ok · $w (sin sesión — usa el login de arriba)"
                                } else {
                                    "ok · $w (no session — use sign-in above)"
                                }
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
            text = if (es) "Cerrar sesión" else "Sign out",
            onClick = {
                scope.launch {
                    google.signOut()
                    message = if (es) "sesión cerrada" else "signed out"
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
