package xyz.mathsmine3.nativeapp.data

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.ResponseBody
import okhttp3.logging.HttpLoggingInterceptor
import org.json.JSONObject
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query
import xyz.mathsmine3.nativeapp.BuildConfig
import xyz.mathsmine3.nativeapp.auth.SessionTokenHolder
import java.util.concurrent.TimeUnit
import android.util.Base64

interface Mm3Api {
    @GET("/api/status")
    suspend fun status(): ResponseBody

    @GET("/api/security/history")
    suspend fun securityHistory(
        @Query("id") id: String? = null,
        @Query("limit") limit: Int = 20,
    ): ResponseBody

    @GET("/api/portal-status")
    suspend fun portalStatus(): ResponseBody

    @GET("/api/token-value")
    suspend fun tokenValue(): ResponseBody

    @GET("/api/token-history")
    suspend fun tokenHistory(): ResponseBody

    @GET("/api/token-history-minutes")
    suspend fun tokenHistoryMinutes(): ResponseBody

    @GET("/api/leaderboard")
    suspend fun leaderboard(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50,
    ): ResponseBody

    @GET("/api/mining-snapshot")
    suspend fun miningSnapshot(): ResponseBody

    @GET("/api/nft-events")
    suspend fun nftEvents(): ResponseBody

    @GET("/api/wallet-pools/my-pool")
    suspend fun myPool(@Query("wallet") wallet: String): ResponseBody

    @GET("/api/wallet-pools/disputes")
    suspend fun disputes(@Query("limit") limit: Int = 50): ResponseBody

    @GET("/api/pools-quick")
    suspend fun poolsQuick(): ResponseBody

    @POST("/api/create-account")
    suspend fun createAccount(@Body body: CreateAccountBody): CreateAccountResponse

    @POST("/api/daily-tasks/claim")
    suspend fun claimDaily(@Body body: RequestBody): ResponseBody

    @POST("/api/trade/exec")
    suspend fun tradeExec(@Body body: RequestBody): Response<ResponseBody>

    @POST("/api/wallet-pools/dispute/join")
    suspend fun joinDispute(@Body body: RequestBody): ResponseBody

    @POST("/api/wallet-pools/dispute/claim-nftji-drop")
    suspend fun claimDisputeNftjiDrop(@Body body: RequestBody): ResponseBody

    @POST("/api/wallet-pools/dispute/vote")
    suspend fun disputeVote(@Body body: RequestBody): ResponseBody

    @POST("/api/wallet-pools/dispute/cancel")
    suspend fun cancelDispute(@Body body: RequestBody): ResponseBody

    @POST("/api/wallet-pools/dispute/start-battle")
    suspend fun startBattle(@Body body: RequestBody): ResponseBody

    @POST("/api/wallet-pools/dispute/resolve")
    suspend fun resolveDispute(@Body body: RequestBody): ResponseBody

    @POST("/api/relay/exec")
    suspend fun relayExec(@Body body: RequestBody): ResponseBody

    @POST("/api/mine-block")
    suspend fun mineBlock(@Body body: RequestBody): ResponseBody

    @POST("/api/resell-nftji")
    suspend fun resellNftji(@Body body: RequestBody): ResponseBody

    @POST("/api/auth/session")
    suspend fun authSession(@Body body: RequestBody): ResponseBody

    @POST("/api/auth/nonce")
    suspend fun authNonce(@Body body: RequestBody): ResponseBody

    @POST("/api/training/resolve")
    suspend fun trainingResolve(@Body body: RequestBody): ResponseBody

    @POST("/api/presence/ping")
    suspend fun presencePing(@Body body: RequestBody): ResponseBody

    @POST("/api/relay/chat")
    suspend fun relayChat(@Body body: RequestBody): ResponseBody

    @POST("/api/security/scan")
    suspend fun securityScan(): ResponseBody

    @POST("/api/pvp-hit")
    suspend fun pvpHit(@Body body: Map<String, @JvmSuppressWildcards Any>): ResponseBody
}

@JsonClass(generateAdapter = true)
data class CreateAccountBody(
    val type: String,
    @Json(name = "access_token") val accessToken: String? = null,
    val wallet: String? = null,
)

@JsonClass(generateAdapter = true)
data class CreateAccountResponse(
    val ok: Boolean? = null,
    val wallet: String? = null,
    val error: String? = null,
)

@JsonClass(generateAdapter = true)
data class WalletBody(val wallet: String)

object Mm3ApiFactory {
    fun create(baseUrl: String): Mm3Api {
        val clientBuilder = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val token = SessionTokenHolder.get()
                val req = if (!token.isNullOrBlank()) {
                    chain.request().newBuilder()
                        .header("Authorization", "Bearer $token")
                        .build()
                } else {
                    chain.request()
                }
                chain.proceed(req)
            }
        if (BuildConfig.DEBUG) {
            clientBuilder.addInterceptor(
                HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC },
            )
        }
        val client = clientBuilder.build()
        val moshi = Moshi.Builder()
            .add(KotlinJsonAdapterFactory())
            .build()
        return Retrofit.Builder()
            .baseUrl(baseUrl.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(Mm3Api::class.java)
    }
}

suspend fun ResponseBody.readText(): String = use { string() }

fun jsonBody(json: JSONObject): RequestBody =
    json.toString().toRequestBody("application/json; charset=utf-8".toMediaType())

fun jsonBody(builder: JSONObject.() -> Unit): RequestBody =
    jsonBody(JSONObject().apply(builder))

/** Prefer API `{ "error": "..." }` over bare "HTTP 400". */
fun Throwable.apiMessage(fallback: String = "request failed"): String {
    if (this is retrofit2.HttpException) {
        val body = response()?.errorBody()?.string().orEmpty()
        return formatApiErrorBody(body) ?: "HTTP ${code()}"
    }
    // Local `error(json.toString())` path from tradeExec parser.
    val raw = message.orEmpty()
    if (raw.startsWith("{")) {
        return formatApiErrorBody(raw) ?: raw
    }
    return raw.takeIf { it.isNotBlank() } ?: fallback
}

fun formatApiErrorBody(body: String): String? {
    val json = runCatching { JSONObject(body) }.getOrNull() ?: return null
    val err = json.optString("error").ifBlank { return null }
    val funds = json.optJSONObject("funds")
    val eur = funds?.optDouble("eur")
    val req = when {
        json.has("requested_amount") -> json.optDouble("requested_amount")
        json.has("requested_raw") -> json.optDouble("requested_raw")
        else -> null
    }
    val wallet = json.optString("wallet")
    val parts = buildList {
        add(err)
        if (req != null) add("req=${"%.4f".format(req)}")
        if (eur != null) add("eur=${"%.2f".format(eur)}")
        if (wallet.isNotBlank()) add("w=${wallet.takeLast(6)}")
    }
    return parts.joinToString(" · ")
}

/** Decode wallet embedded in mm3 session token (no verify — display/debug only). */
fun sessionTokenWallet(token: String?): String? {
    if (token.isNullOrBlank()) return null
    return try {
        val padded = token.replace('-', '+').replace('_', '/')
            .let { it + "=".repeat((4 - it.length % 4) % 4) }
        val raw = String(Base64.decode(padded, Base64.DEFAULT))
        val parts = raw.split('.')
        if (parts.size >= 2 && parts[0] == "session") parts[1].lowercase() else null
    } catch (_: Exception) {
        null
    }
}

