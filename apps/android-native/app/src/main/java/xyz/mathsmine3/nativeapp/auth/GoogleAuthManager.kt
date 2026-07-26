package xyz.mathsmine3.nativeapp.auth

import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import xyz.mathsmine3.nativeapp.BuildConfig
import xyz.mathsmine3.nativeapp.data.CreateAccountBody
import xyz.mathsmine3.nativeapp.data.Mm3Api

/**
 * Mirrors web Google login: OAuth access_token → POST /api/create-account → virtual wallet.
 * Client ID from repo-root `.env.local` (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`) at build time.
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
            throw IllegalStateException("Google sign-in failed: ${e.statusCode}", e)
        }
        val emailAccount = account.account ?: error("No Google account on result")
        val scope = "oauth2:https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email"
        val accessToken = GoogleAuthUtil.getToken(context, emailAccount, scope)
        val created = api.createAccount(
            CreateAccountBody(type = "google", accessToken = accessToken)
        )
        val wallet = created.wallet ?: error(created.error ?: "create_account_failed")
        sessionRepository.setGoogleWallet(wallet)
        wallet
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
