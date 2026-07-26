package xyz.mathsmine3.nativeapp.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import xyz.mathsmine3.nativeapp.data.CreateAccountBody
import xyz.mathsmine3.nativeapp.data.Mm3Api

/**
 * Wallet identity for native:
 * 1) Manual connect (enter 0x address) — useful for QA / MetaMask copy-paste
 * 2) Deep-link to WalletConnect-compatible wallets via WC URI (Reown SDK can
 *    replace [buildWalletConnectUri] later without changing create-account)
 *
 * Matches web: POST /api/create-account { type: wallet, wallet }
 */
class WalletAuthManager(
    private val context: Context,
    private val api: Mm3Api,
    private val sessionRepository: SessionRepository,
) {
    private val walletRegex = Regex("^0x[0-9a-fA-F]{40}$")

    suspend fun connectAddress(address: String): String = withContext(Dispatchers.IO) {
        val wallet = address.trim().lowercase()
        require(walletRegex.matches(wallet)) { "Invalid wallet address" }
        api.createAccount(CreateAccountBody(type = "wallet", wallet = wallet))
        sessionRepository.setWallet(wallet)
        wallet
    }

    /**
     * Opens a WalletConnect-style deep link. Full Reown AppKit can be wired here;
     * for now we open MetaMask with a return scheme for the app.
     */
    fun openExternalWallet(activityContext: Context = context) {
        val returnUrl = Uri.encode("xyz.mathsmine3.app://wc")
        val uri = Uri.parse("https://metamask.app.link/dapp/mathsmine3.xyz?redirect=$returnUrl")
        val intent = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activityContext.startActivity(intent)
    }

    fun parseWalletFromDeepLink(uri: Uri?): String? {
        if (uri == null) return null
        // xyz.mathsmine3.app://wc?address=0x...
        return uri.getQueryParameter("address")
            ?: uri.getQueryParameter("wallet")
    }
}
