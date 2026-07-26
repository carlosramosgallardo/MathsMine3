package xyz.mathsmine3.nativeapp.auth

import java.util.concurrent.atomic.AtomicReference

/** Thread-safe Bearer token for portal APIs that use walletFromRequest. */
object SessionTokenHolder {
    private val tokenRef = AtomicReference<String?>(null)

    fun get(): String? = tokenRef.get()

    fun set(token: String?) {
        tokenRef.set(token?.takeIf { it.isNotBlank() })
    }

    fun clear() {
        tokenRef.set(null)
    }
}
