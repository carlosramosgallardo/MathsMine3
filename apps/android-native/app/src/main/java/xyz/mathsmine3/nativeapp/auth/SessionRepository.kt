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
) {
    val isLoggedIn: Boolean get() = !wallet.isNullOrBlank()
}

class SessionRepository(private val context: Context) {
    private val walletKey = stringPreferencesKey("wallet")
    private val kindKey = stringPreferencesKey("kind")

    val session: Flow<Session> = context.sessionStore.data.map { prefs ->
        val kind = when (prefs[kindKey]) {
            "GOOGLE" -> AuthKind.GOOGLE
            "WALLET" -> AuthKind.WALLET
            else -> AuthKind.NONE
        }
        Session(wallet = prefs[walletKey], kind = kind)
    }

    suspend fun setGoogleWallet(wallet: String) {
        context.sessionStore.edit {
            it[walletKey] = wallet
            it[kindKey] = AuthKind.GOOGLE.name
        }
    }

    suspend fun setWallet(wallet: String) {
        context.sessionStore.edit {
            it[walletKey] = wallet.lowercase()
            it[kindKey] = AuthKind.WALLET.name
        }
    }

    suspend fun clear() {
        context.sessionStore.edit { it.clear() }
    }
}
