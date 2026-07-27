package xyz.mathsmine3.nativeapp.auth

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.sessionStore: DataStore<Preferences> by preferencesDataStore("mm3_session")

enum class AuthKind { GOOGLE, WALLET, NONE }

data class Session(
    val wallet: String?,
    val kind: AuthKind,
    val sessionToken: String? = null,
) {
    val isLoggedIn: Boolean get() = !wallet.isNullOrBlank()
    val hasApiSession: Boolean get() = !sessionToken.isNullOrBlank()
}

class SessionRepository(private val context: Context) {
    private val walletKey = stringPreferencesKey("wallet")
    private val kindKey = stringPreferencesKey("kind")
    private val securePrefs = EncryptedSharedPreferences.create(
        context,
        "mm3_session_secure",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private fun readToken(): String? = securePrefs.getString("session_token", null)
    private fun writeToken(token: String?) {
        if (token.isNullOrBlank()) {
            securePrefs.edit().remove("session_token").apply()
        } else {
            securePrefs.edit().putString("session_token", token).apply()
        }
    }

    val session: Flow<Session> = context.sessionStore.data.map { prefs ->
        val kind = when (prefs[kindKey]) {
            "GOOGLE" -> AuthKind.GOOGLE
            "WALLET" -> AuthKind.WALLET
            else -> AuthKind.NONE
        }
        val token = readToken()
        SessionTokenHolder.set(token)
        Session(wallet = prefs[walletKey], kind = kind, sessionToken = token)
    }

    suspend fun setGoogleWallet(wallet: String, sessionToken: String? = null) {
        context.sessionStore.edit {
            it[walletKey] = wallet
            it[kindKey] = AuthKind.GOOGLE.name
        }
        writeToken(sessionToken)
        SessionTokenHolder.set(sessionToken)
    }

    suspend fun setWallet(wallet: String, sessionToken: String? = null) {
        context.sessionStore.edit {
            it[walletKey] = wallet.lowercase()
            it[kindKey] = AuthKind.WALLET.name
        }
        writeToken(sessionToken)
        SessionTokenHolder.set(sessionToken)
    }

    suspend fun setSessionToken(token: String?) {
        writeToken(token)
        SessionTokenHolder.set(token)
    }

    suspend fun clear() {
        context.sessionStore.edit { it.clear() }
        writeToken(null)
        SessionTokenHolder.clear()
    }
}
