package xyz.mathsmine3.nativeapp.ui

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.Locale

private val Context.uiPrefsStore: DataStore<Preferences> by preferencesDataStore("mm3_ui_prefs")

data class UiPrefs(
    val language: String = "en",
    val currency: String = "EUR",
    val soundEnabled: Boolean = true,
    val musicEnabled: Boolean = false,
)

class UiPrefsRepository(context: Context) {
    private val store = context.applicationContext.uiPrefsStore

    val prefs: Flow<UiPrefs> = store.data.map { p ->
        UiPrefs(
            language = p[langKey]?.takeIf { it == "en" || it == "es" } ?: defaultLang(),
            currency = p[currencyKey]?.takeIf { it in VALID_CURRENCY } ?: "EUR",
            soundEnabled = p[soundKey] ?: true,
            musicEnabled = p[musicKey] ?: false,
        )
    }

    suspend fun setLanguage(lang: String) {
        val v = if (lang.startsWith("es", ignoreCase = true)) "es" else "en"
        store.edit { it[langKey] = v }
    }

    suspend fun setCurrency(currency: String) {
        val v = currency.uppercase(Locale.US)
        if (v !in VALID_CURRENCY) return
        store.edit { it[currencyKey] = v }
    }

    suspend fun setSoundEnabled(enabled: Boolean) {
        store.edit { it[soundKey] = enabled }
    }

    suspend fun setMusicEnabled(enabled: Boolean) {
        store.edit { it[musicKey] = enabled }
    }

    companion object {
        private val langKey = stringPreferencesKey("language")
        private val currencyKey = stringPreferencesKey("currency")
        private val soundKey = booleanPreferencesKey("sound_enabled")
        private val musicKey = booleanPreferencesKey("music_enabled")
        private val VALID_CURRENCY = setOf("EUR", "USD", "CNY")

        fun defaultLang(): String =
            if (Locale.getDefault().language.startsWith("es")) "es" else "en"
    }
}
