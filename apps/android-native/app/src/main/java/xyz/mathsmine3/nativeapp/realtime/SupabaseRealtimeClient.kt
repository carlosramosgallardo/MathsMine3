package xyz.mathsmine3.nativeapp.realtime

import android.content.Context
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

data class RealtimeProtocol(
    val miningPresence: String,
    val miningMapTemplate: String,
    val miningEvents: List<String>,
    val ircRelay: String,
    val walletFlags: String,
) {
    fun mapChannel(mapId: Int): String =
        miningMapTemplate.replace("{mapId}", mapId.toString())

    companion object {
        fun loadFromAssets(context: Context): RealtimeProtocol {
            // Prefer bundled copy of packages/realtime-protocol/channels.json
            return try {
                val json = context.assets.open("realtime-channels.json").bufferedReader().readText()
                parse(json)
            } catch (_: Exception) {
                RealtimeProtocol(
                    miningPresence = "mm3-chain3d-v1",
                    miningMapTemplate = "mm3-chain3d-v1-map-{mapId}",
                    miningEvents = listOf(
                        "move", "pvp-hit", "pvp-result", "player-death",
                        "boss-state", "boss-result", "chain-formula-solved"
                    ),
                    ircRelay = "mm3-irc-relay",
                    walletFlags = "mm3-irc-wallet-flags",
                )
            }
        }

        private fun parse(json: String): RealtimeProtocol {
            val root = JSONObject(json)
            val mining = root.getJSONObject("mining")
            val relaying = root.getJSONObject("relaying")
            val events = mining.getJSONArray("broadcastEvents")
            val list = mutableListOf<String>()
            for (i in 0 until events.length()) list += events.getString(i)
            return RealtimeProtocol(
                miningPresence = mining.getString("presence"),
                miningMapTemplate = mining.getString("mapMove"),
                miningEvents = list,
                ircRelay = relaying.getString("irc"),
                walletFlags = relaying.getString("walletFlags"),
            )
        }
    }
}

/**
 * Lightweight Realtime client (Phoenix-style channels over Supabase realtime WS).
 * When SUPABASE_URL / ANON_KEY are empty, methods no-op so the UI still runs.
 */
class SupabaseRealtimeClient(
    private val supabaseUrl: String,
    private val anonKey: String,
    private val protocol: RealtimeProtocol,
) {
    private val tag = "Mm3Realtime"
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
    private var socket: WebSocket? = null
    private val handlers = ConcurrentHashMap<String, MutableList<(JSONObject) -> Unit>>()

    val isConfigured: Boolean
        get() = supabaseUrl.isNotBlank() && anonKey.isNotBlank()

    fun connect() {
        if (!isConfigured) {
            Log.i(tag, "Supabase not configured — realtime disabled (set MM3_SUPABASE_URL / MM3_SUPABASE_ANON_KEY)")
            return
        }
        val wsBase = supabaseUrl
            .replace("https://", "wss://")
            .replace("http://", "ws://")
            .trimEnd('/')
        val url = "$wsBase/realtime/v1/websocket?apikey=$anonKey&vsn=1.0.0"
        socket = client.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(tag, "connected")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = JSONObject(text)
                    val topic = msg.optString("topic")
                    val event = msg.optString("event")
                    val payload = msg.optJSONObject("payload") ?: JSONObject()
                    if (event == "broadcast") {
                        val innerEvent = payload.optString("event")
                        val key = "$topic:$innerEvent"
                        handlers[key]?.forEach { it(payload.optJSONObject("payload") ?: payload) }
                    }
                } catch (e: Exception) {
                    Log.w(tag, "parse error", e)
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w(tag, "failure: ${t.message}")
            }
        })
    }

    fun joinChannel(topic: String) {
        val s = socket ?: return
        val payload = JSONObject()
            .put("config", JSONObject().put("broadcast", JSONObject().put("self", true)))
        val msg = JSONObject()
            .put("topic", "realtime:$topic")
            .put("event", "phx_join")
            .put("payload", payload)
            .put("ref", System.currentTimeMillis().toString())
        s.send(msg.toString())
    }

    fun onBroadcast(topic: String, event: String, handler: (JSONObject) -> Unit) {
        handlers.getOrPut("$topic:$event") { mutableListOf() }.add(handler)
    }

    fun broadcast(topic: String, event: String, payload: JSONObject) {
        val s = socket ?: return
        val body = JSONObject()
            .put("type", "broadcast")
            .put("event", event)
            .put("payload", payload)
        val msg = JSONObject()
            .put("topic", "realtime:$topic")
            .put("event", "broadcast")
            .put("payload", body)
            .put("ref", System.currentTimeMillis().toString())
        s.send(msg.toString())
    }

    fun joinMining(mapId: Int) {
        joinChannel(protocol.miningPresence)
        joinChannel(protocol.mapChannel(mapId))
    }

    fun joinRelaying() {
        joinChannel(protocol.ircRelay)
        joinChannel(protocol.walletFlags)
    }

    fun disconnect() {
        socket?.close(1000, "bye")
        socket = null
    }
}
