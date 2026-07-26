package xyz.mathsmine3.nativeapp.data

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import okhttp3.ResponseBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

interface Mm3Api {
    @GET("/api/status")
    suspend fun status(): ResponseBody

    @GET("/api/portal-status")
    suspend fun portalStatus(): ResponseBody

    @GET("/api/token-value")
    suspend fun tokenValue(): ResponseBody

    @GET("/api/token-history")
    suspend fun tokenHistory(): ResponseBody

    @GET("/api/leaderboard")
    suspend fun leaderboard(): ResponseBody

    @GET("/api/mining-snapshot")
    suspend fun miningSnapshot(): ResponseBody

    @GET("/api/nft-events")
    suspend fun nftEvents(): ResponseBody

    @GET("/api/wallet-pools/my-pool")
    suspend fun myPool(@Query("wallet") wallet: String): ResponseBody

    @GET("/api/wallet-pools/disputes")
    suspend fun disputes(): ResponseBody

    @POST("/api/create-account")
    suspend fun createAccount(@Body body: CreateAccountBody): CreateAccountResponse

    @POST("/api/daily-tasks/claim")
    suspend fun claimDaily(@Body body: WalletBody): ResponseBody

    @POST("/api/trade/exec")
    suspend fun tradeExec(@Body body: Map<String, @JvmSuppressWildcards Any>): ResponseBody

    @POST("/api/relay/exec")
    suspend fun relayExec(@Body body: Map<String, @JvmSuppressWildcards Any>): ResponseBody

    @POST("/api/mine-block")
    suspend fun mineBlock(@Body body: Map<String, @JvmSuppressWildcards Any>): ResponseBody

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
