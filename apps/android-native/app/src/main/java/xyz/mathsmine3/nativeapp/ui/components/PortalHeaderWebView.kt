package xyz.mathsmine3.nativeapp.ui.components

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import java.net.URLEncoder
import xyz.mathsmine3.nativeapp.PortalEmbedFallback
import xyz.mathsmine3.nativeapp.PortalEmbedWebViewClient
import xyz.mathsmine3.nativeapp.PortalOfflinePage
import xyz.mathsmine3.nativeapp.keepParentFromStealingTouches
import xyz.mathsmine3.nativeapp.applyPortalDefaults
import xyz.mathsmine3.nativeapp.ui.SoundPrefsBridge

/**
 * Live portal Header (ticker / pulse / clock / wallet row) as used on mobile web.
 */
@SuppressLint("SetJavaScriptEnabled")
class PortalHeaderWebView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : WebView(context, attrs) {

    var onNativeRoute: ((String) -> Unit)? = null
    var onExternalUrl: ((String) -> Unit)? = null
    var onAuthRequest: (() -> Unit)? = null
    var onHeaderHeightPx: ((Int) -> Unit)? = null

    private var sessionWallet: String? = null
    private val fallback = PortalEmbedFallback(this, "/embed/header") { FALLBACK_URL }

    init {
        setBackgroundColor(Color.parseColor("#01070E"))
        settings.applyPortalDefaults()
        addJavascriptInterface(NativeBridge(), "MM3NativeHeader")
        webChromeClient = WebChromeClient()
        SoundPrefsBridge.attach(this)
        webViewClient = object : PortalEmbedWebViewClient(fallback, blockUnknownHosts = false) {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                if (request.isForMainFrame != true && uri.host?.contains("mathsmine3") != true) {
                    return false
                }
                return handleNavigation(uri.toString())
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return handleNavigation(url ?: return false)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                injectSession()
                SoundPrefsBridge.injectInto(this@PortalHeaderWebView)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectSession()
                if (PortalOfflinePage.isOfflineContent(url)) {
                    return
                }
                if (fallback.usedRemote || url?.contains("/embed/header") != true) {
                    injectFallbackChrome()
                }
                injectHeightReporter()
                SoundPrefsBridge.injectInto(this@PortalHeaderWebView)
            }

        }
        layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        )
        isVerticalScrollBarEnabled = false
        isHorizontalScrollBarEnabled = false
    }

    fun setSessionWallet(wallet: String?) {
        sessionWallet = wallet?.trim()?.takeIf { it.isNotEmpty() }
    }

    fun loadHeader() {
        fallback.reset()
        loadUrl(buildEmbedUrl())
    }

    private fun buildEmbedUrl(): String {
        val w = sessionWallet ?: return EMBED_URL
        if (!w.matches(WALLET_RE)) return EMBED_URL
        val encoded = URLEncoder.encode(w.lowercase(), Charsets.UTF_8.name())
        return "$EMBED_URL?mm3_gw=$encoded"
    }

    private fun handleNavigation(url: String): Boolean {
        val lower = url.lowercase()
        // Stay on embed / live fallback / packed offline document
        if (
            lower.contains("/embed/header") ||
            lower == FALLBACK_URL ||
            lower == "$FALLBACK_URL/" ||
            PortalOfflinePage.isOfflineContent(url)
        ) {
            return false
        }
        val path = try {
            android.net.Uri.parse(url).path?.trimEnd('/') ?: ""
        } catch (_: Exception) {
            return false
        }
        when (path) {
            "", "/" -> {
                onNativeRoute?.invoke("home"); return true
            }
            "/mining", "/chain3d" -> {
                onNativeRoute?.invoke("mining"); return true
            }
            "/training" -> {
                onNativeRoute?.invoke("training"); return true
            }
            "/trading" -> {
                onNativeRoute?.invoke("trading"); return true
            }
            "/ranking" -> {
                onNativeRoute?.invoke("ranking"); return true
            }
            "/squeezing" -> {
                onNativeRoute?.invoke("squeezing"); return true
            }
            "/relaying" -> {
                onNativeRoute?.invoke("relaying"); return true
            }
            "/daily-tasks" -> {
                onNativeRoute?.invoke("daily"); return true
            }
            "/auth", "/login" -> {
                onAuthRequest?.invoke(); return true
            }
            "/mm3-value", "/ai-team", "/manifesto", "/docs" -> {
                onExternalUrl?.invoke(url); return true
            }
        }
        if (lower.contains("mathsmine3.xyz")) {
            // Unknown portal path — open externally rather than hijacking the strip
            onExternalUrl?.invoke(url)
            return true
        }
        return false
    }

    private fun injectSession() {
        val w = sessionWallet?.takeIf { it.matches(WALLET_RE) }?.lowercase() ?: return
        evaluateJavascript(
            """
            (function(){
              try {
                localStorage.setItem('mm3_gw', '$w');
                window.__MM3_NATIVE_GW__ = '$w';
                window.dispatchEvent(new CustomEvent('mm3-native-session', { detail: { gw: '$w' } }));
              } catch (e) {}
            })();
            """.trimIndent(),
            null,
        )
    }

    private fun injectHeightReporter() {
        evaluateJavascript(
            """
            (function(){
              try {
                document.documentElement.classList.add('mm3-native-embed','mm3-native-header-embed');
                var el = document.querySelector('header');
                var h = el ? Math.ceil(el.getBoundingClientRect().height) : 0;
                if (h > 0 && window.MM3NativeHeader && window.MM3NativeHeader.onHeight) {
                  window.MM3NativeHeader.onHeight(h);
                }
              } catch (e) {}
            })();
            """.trimIndent(),
            null,
        )
    }

    private fun injectFallbackChrome() {
        // Homepage fallback: keep only <header>, collapse the rest.
        evaluateJavascript(
            """
            (function(){
              try {
                var css = document.createElement('style');
                css.id = 'mm3-native-header-fallback-css';
                css.textContent = `
                  footer, nav, .CookieBanner, [class*="cookie"],
                  .mm3-home, .mm3-splash, main, .mm3-shell-main > *:not(header) {
                    display: none !important;
                  }
                  .mm3-shell-main { padding: 0 !important; margin: 0 !important; height: auto !important; }
                  header {
                    position: relative !important;
                    top: auto !important;
                  }
                  body, html {
                    background: #01070e !important;
                    overflow: hidden !important;
                    height: auto !important;
                  }
                `;
                if (!document.getElementById('mm3-native-header-fallback-css')) {
                  document.documentElement.appendChild(css);
                }
                document.documentElement.classList.add('mm3-native-embed','mm3-native-header-embed');
              } catch (e) {}
            })();
            """.trimIndent(),
            null,
        )
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        keepParentFromStealingTouches(event)
        return super.onTouchEvent(event)
    }

    private inner class NativeBridge {
        @JavascriptInterface
        fun onHeight(px: Int) {
            if (px <= 0) return
            post { onHeaderHeightPx?.invoke(px) }
        }
    }

    companion object {
        const val EMBED_URL = "https://mathsmine3.xyz/embed/header"
        const val FALLBACK_URL = "https://mathsmine3.xyz/"
        private val WALLET_RE = Regex("^0x[a-fA-F0-9]{40}$")
    }
}
