package xyz.mathsmine3.nativeapp.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import xyz.mathsmine3.nativeapp.BuildConfig
import org.json.JSONObject
import xyz.mathsmine3.nativeapp.PortalOrigin
import xyz.mathsmine3.nativeapp.data.CreateAccountBody
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.jsonBody
import xyz.mathsmine3.nativeapp.data.readText

/**
 * Google login for native:
 * - Primary: browser embed `/embed/google-auth` (same Web OAuth client as the portal —
 *   no Android SHA-1 OAuth client required; works for Play-signed installs).
 * - Optional debug: native Google Sign-In Play Services path (needs Android OAuth client + SHA).
 */
class GoogleAuthManager(
    private val context: Context,
    private val api: Mm3Api,
    private val sessionRepository: SessionRepository,
) {
    private fun webClientId(): String {
        val id = BuildConfig.GOOGLE_CLIENT_ID
        if (id.isBlank() || id.startsWith("MISSING_")) {
            error("NEXT_PUBLIC_GOOGLE_CLIENT_ID missing in .env.local — rebuild after setting it")
        }
        return id
    }

    /** Opens portal Google OAuth in the browser, then deep-links back with session. */
    fun openBrowserSignIn(activityContext: Context = context) {
        val returnUrl = Uri.encode("xyz.mathsmine3.app://auth")
        val uri = Uri.parse("${PortalOrigin.url("/embed/google-auth")}?redirect=$returnUrl")
        val intent = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activityContext.startActivity(intent)
    }

    fun signInClient(): GoogleSignInClient {
        val webClientId = webClientId()
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestIdToken(webClientId)
            .requestScopes(Scope("https://www.googleapis.com/auth/userinfo.profile"))
            .build()
        return GoogleSignIn.getClient(context, gso)
    }

    fun signInIntent(): Intent = signInClient().signInIntent

    suspend fun handleSignInResult(data: Intent?): String = withContext(Dispatchers.IO) {
        webClientId()
        val task = GoogleSignIn.getSignedInAccountFromIntent(data)
        val account = try {
            task.getResult(ApiException::class.java)
        } catch (e: ApiException) {
            // 10 = DEVELOPER_ERROR — Android OAuth client missing/mismatched
            // (package xyz.mathsmine3.app + SHA-1 of the APK signing cert).
            val hint = when (e.statusCode) {
                10 -> "Google sign-in failed: 10 (DEVELOPER_ERROR). " +
                    "Use «Continue with Google» (browser) instead, or add an Android OAuth " +
                    "client SHA for this APK (see apps/android-native/README.md)."
                12501 -> "Google sign-in cancelled"
                7 -> "Google sign-in failed: network error"
                else -> "Google sign-in failed: ${e.statusCode}"
            }
            throw IllegalStateException(hint, e)
        }
        val emailAccount = account.account ?: error("No Google account on result")
        val scope = "oauth2:https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email"
        val accessToken = GoogleAuthUtil.getToken(context, emailAccount, scope)
        val created = api.createAccount(
            CreateAccountBody(type = "google", accessToken = accessToken)
        )
        val wallet = created.wallet ?: error(created.error ?: "create_account_failed")
        val sessionToken = runCatching {
            val raw = api.authSession(
                jsonBody {
                    put("type", "google")
                    put("access_token", accessToken)
                },
            ).readText()
            JSONObject(raw).optString("token").takeIf { it.isNotBlank() }
        }.getOrNull()
        sessionRepository.setGoogleWallet(wallet, sessionToken)
        wallet
    }

    suspend fun completeDeepLink(uri: Uri?): String? = withContext(Dispatchers.IO) {
        if (uri == null) return@withContext null
        val kind = uri.getQueryParameter("kind")?.lowercase().orEmpty()
        if (kind != "google") return@withContext null
        val token = uri.getQueryParameter("token")?.takeIf { it.isNotBlank() }
        val wallet = uri.getQueryParameter("wallet")
            ?: uri.getQueryParameter("address")
            ?: return@withContext null
        val normalized = wallet.trim().lowercase()
        if (!Regex("^0x[0-9a-fA-F]{40}$").matches(normalized)) return@withContext null
        sessionRepository.setGoogleWallet(normalized, token)
        normalized
    }

    suspend fun signOut() {
        withContext(Dispatchers.IO) {
            try {
                com.google.android.gms.tasks.Tasks.await(signInClient().signOut())
            } catch (_: Exception) {
            }
            sessionRepository.clear()
        }
    }
}
