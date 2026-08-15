package xyz.mathsmine3.nativeapp

import android.os.Build
import android.webkit.WebSettings

/** Shared WebSettings for portal embed WebViews (Sonar: avoid duplicating the same block). */
fun WebSettings.applyPortalDefaults(enableSafeBrowsing: Boolean = true) {
    javaScriptEnabled = true
    domStorageEnabled = true
    setMediaPlaybackRequiresUserGesture(false)
    allowFileAccess = false
    mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
    cacheMode = WebSettings.LOAD_DEFAULT
    useWideViewPort = true
    loadWithOverviewMode = true
    setSupportZoom(false)
    builtInZoomControls = false
    displayZoomControls = false
    if (enableSafeBrowsing && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        safeBrowsingEnabled = true
    }
}
