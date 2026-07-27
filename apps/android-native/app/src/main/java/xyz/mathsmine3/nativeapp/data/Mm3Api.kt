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
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query
import xyz.mathsmine3.nativeapp.auth.SessionTokenHolder
import java.util.concurrent.TimeUnit

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
    suspend fun tradeExec(@Body body: RequestBody): ResponseBody

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
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        val client = OkHttpClient.Builder()
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
            .addInterceptor(logging)
            .build()
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

