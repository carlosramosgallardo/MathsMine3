package xyz.mathsmine3.nativeapp.auth

import android.content.Context
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
    private val tokenKey = stringPreferencesKey("session_token")

    val session: Flow<Session> = context.sessionStore.data.map { prefs ->
        val kind = when (prefs[kindKey]) {
            "GOOGLE" -> AuthKind.GOOGLE
            "WALLET" -> AuthKind.WALLET
            else -> AuthKind.NONE
        }
        val token = prefs[tokenKey]
        SessionTokenHolder.set(token)
        Session(wallet = prefs[walletKey], kind = kind, sessionToken = token)
    }

    suspend fun setGoogleWallet(wallet: String, sessionToken: String? = null) {
        context.sessionStore.edit {
            it[walletKey] = wallet
            it[kindKey] = AuthKind.GOOGLE.name
            if (sessionToken.isNullOrBlank()) it.remove(tokenKey) else it[tokenKey] = sessionToken
        }
        SessionTokenHolder.set(sessionToken)
    }

    suspend fun setWallet(wallet: String, sessionToken: String? = null) {
        context.sessionStore.edit {
            it[walletKey] = wallet.lowercase()
            it[kindKey] = AuthKind.WALLET.name
            if (sessionToken.isNullOrBlank()) it.remove(tokenKey) else it[tokenKey] = sessionToken
        }
        SessionTokenHolder.set(sessionToken)
    }

    suspend fun setSessionToken(token: String?) {
        context.sessionStore.edit {
            if (token.isNullOrBlank()) it.remove(tokenKey) else it[tokenKey] = token
        }
        SessionTokenHolder.set(token)
    }

    suspend fun clear() {
        context.sessionStore.edit { it.clear() }
        SessionTokenHolder.clear()
    }
}
