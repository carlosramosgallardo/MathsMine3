package xyz.mathsmine3.nativeapp

import android.content.Context
import xyz.mathsmine3.nativeapp.auth.SessionRepository
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.Mm3ApiFactory
import xyz.mathsmine3.nativeapp.data.SupabaseRest
import xyz.mathsmine3.nativeapp.realtime.RealtimeProtocol
import xyz.mathsmine3.nativeapp.realtime.SupabaseRealtimeClient
import xyz.mathsmine3.nativeapp.ui.UiPrefsRepository

class AppContainer(context: Context) {
    val sessionRepository = SessionRepository(context.applicationContext)
    val uiPrefsRepository = UiPrefsRepository(context.applicationContext)
    val api: Mm3Api = Mm3ApiFactory.create(BuildConfig.API_BASE_URL)
    val supabase = SupabaseRest()
    val realtimeProtocol = RealtimeProtocol.loadFromAssets(context)
    val realtime = SupabaseRealtimeClient(
        supabaseUrl = BuildConfig.SUPABASE_URL,
        anonKey = BuildConfig.SUPABASE_ANON_KEY,
        protocol = realtimeProtocol,
    )
}
