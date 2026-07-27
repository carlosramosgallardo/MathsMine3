package xyz.mathsmine3.nativeapp.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import xyz.mathsmine3.nativeapp.BuildConfig
import xyz.mathsmine3.nativeapp.PortalOrigin
import xyz.mathsmine3.nativeapp.data.CreateAccountBody
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.jsonBody
import xyz.mathsmine3.nativeapp.data.readText

/**
 * Wallet identity: cryptographic sign-in (web parity) or debug-only manual address.
 */
class WalletAuthManager(
    private val context: Context,
    private val api: Mm3Api,
    private val sessionRepository: SessionRepository,
) {
    private val walletRegex = Regex("^0x[0-9a-fA-F]{40}$")

    /** Opens portal embed that runs wagmi personal_sign → session token → app deep link. */
    fun openWalletSignIn(activityContext: Context = context) {
        val returnUrl = Uri.encode("xyz.mathsmine3.app://auth")
        val uri = Uri.parse("${PortalOrigin.url("/embed/wallet-auth")}?redirect=$returnUrl")
        val intent = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activityContext.startActivity(intent)
    }

    /** MetaMask dapp browser fallback. */
    fun openExternalWallet(activityContext: Context = context) {
        openWalletSignIn(activityContext)
    }

    suspend fun connectAddress(address: String): String = withContext(Dispatchers.IO) {
        if (!BuildConfig.DEBUG) {
            error("Manual wallet entry is disabled in release builds — use wallet sign-in")
        }
        val wallet = address.trim().lowercase()
        require(walletRegex.matches(wallet)) { "Invalid wallet address" }
        api.createAccount(CreateAccountBody(type = "wallet", wallet = wallet))
        sessionRepository.setWallet(wallet)
        wallet
    }

    suspend fun completeDeepLink(uri: Uri?): String? = withContext(Dispatchers.IO) {
        if (uri == null) return@withContext null
        val token = uri.getQueryParameter("token")?.takeIf { it.isNotBlank() }
        val wallet = uri.getQueryParameter("wallet")
            ?: uri.getQueryParameter("address")
            ?: return@withContext null
        val normalized = wallet.trim().lowercase()
        if (!walletRegex.matches(normalized)) return@withContext null
        api.createAccount(CreateAccountBody(type = "wallet", wallet = normalized))
        sessionRepository.setWallet(normalized, token)
        normalized
    }

    fun parseWalletFromDeepLink(uri: Uri?): String? {
        if (uri == null) return null
        return uri.getQueryParameter("wallet")
            ?: uri.getQueryParameter("address")
    }
}
