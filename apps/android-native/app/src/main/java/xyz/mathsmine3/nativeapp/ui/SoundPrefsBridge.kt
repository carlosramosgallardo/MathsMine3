package xyz.mathsmine3.nativeapp.ui

import android.webkit.WebView
import java.lang.ref.WeakReference
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Pushes native sound/music toggles into every portal WebView.
 *
 * Web [SoundProvider] defaults music ON and plays `/ambient/…` inside WebViews;
 * the header toggle only drove [AmbientMusic]. Without this bridge the user
 * heard WebView music that never respected the native controls.
 */
object SoundPrefsBridge {
    @Volatile
    var soundEnabled: Boolean = true
        private set

    @Volatile
    var musicEnabled: Boolean = false
        private set

    private val webViews = CopyOnWriteArrayList<WeakReference<WebView>>()

    fun update(soundEnabled: Boolean, musicEnabled: Boolean) {
        this.soundEnabled = soundEnabled
        this.musicEnabled = musicEnabled
        pruneAndInjectAll()
    }

    fun attach(webView: WebView) {
        webViews.add(WeakReference(webView))
        webView.post { injectInto(webView) }
    }

    fun injectInto(webView: WebView) {
        val sound = soundEnabled
        val music = musicEnabled
        val js = """
            (function(){
              try {
                window.__MM3_NATIVE_APP__ = true;
                document.documentElement.classList.add('mm3-native-app');
                localStorage.setItem('mm3-sound-enabled', ${if (sound) "'true'" else "'false'"});
                localStorage.setItem('mm3-music-enabled', ${if (music) "'true'" else "'false'"});
                window.dispatchEvent(new CustomEvent('mm3-sound-prefs', {
                  detail: { sound: $sound, music: $music }
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
}
