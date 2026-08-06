package xyz.mathsmine3.nativeapp.ui

import android.webkit.WebView
import java.lang.ref.WeakReference
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Pushes native header prefs (sound/music/language/currency) into every portal WebView.
 *
 * Web [SoundProvider] / [I18nProvider] / [CurrencyProvider] read localStorage and
 * listen for `mm3-sound-prefs` / `mm3-native-prefs`. Without this bridge, WebViews
 * (esp. mining tips) followed the device locale instead of the native header.
 */
object SoundPrefsBridge {
    @Volatile
    var soundEnabled: Boolean = true
        private set

    @Volatile
    var musicEnabled: Boolean = false
        private set

    @Volatile
    var language: String = "en"
        private set

    @Volatile
    var currency: String = "EUR"
        private set

    private val webViews = CopyOnWriteArrayList<WeakReference<WebView>>()

    fun update(
        soundEnabled: Boolean,
        musicEnabled: Boolean,
        language: String = this.language,
        currency: String = this.currency,
    ) {
        this.soundEnabled = soundEnabled
        this.musicEnabled = musicEnabled
        this.language = if (language.startsWith("es", ignoreCase = true)) "es" else "en"
        this.currency = currency.uppercase().takeIf { it in VALID_CURRENCY } ?: "EUR"
        pruneAndInjectAll()
    }

    fun attach(webView: WebView) {
        webViews.add(WeakReference(webView))
        webView.post { injectInto(webView) }
    }

    fun injectInto(webView: WebView) {
        val sound = soundEnabled
        val music = musicEnabled
        val lang = language
        val cur = currency
        val js = """
            (function(){
              try {
                window.__MM3_NATIVE_APP__ = true;
                window.__MM3_NATIVE_LANG__ = '$lang';
                document.documentElement.classList.add('mm3-native-app');
                document.documentElement.lang = '$lang';
                localStorage.setItem('mm3-sound-enabled', ${if (sound) "'true'" else "'false'"});
                localStorage.setItem('mm3-music-enabled', ${if (music) "'true'" else "'false'"});
                localStorage.setItem('mm3-language', '$lang');
                localStorage.setItem('mm3-preferred-currency', '$cur');
                window.dispatchEvent(new CustomEvent('mm3-sound-prefs', {
                  detail: { sound: $sound, music: $music }
                }));
                window.dispatchEvent(new CustomEvent('mm3-native-prefs', {
                  detail: { language: '$lang', currency: '$cur' }
                }));
                // Native AmbientMusic owns the loop — stop any HTMLAudio already started.
                document.querySelectorAll('audio').forEach(function(a){
                  try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) {}
                });
              } catch (e) {}
            })();
        """.trimIndent()
        runCatching { webView.evaluateJavascript(js, null) }
    }

    private fun pruneAndInjectAll() {
        val alive = ArrayList<WebView>()
        for (ref in webViews) {
            val wv = ref.get() ?: continue
            alive.add(wv)
        }
        webViews.clear()
        for (wv in alive) {
            webViews.add(WeakReference(wv))
            wv.post { injectInto(wv) }
        }
    }

    private val VALID_CURRENCY = setOf("EUR", "USD", "CNY")
}
