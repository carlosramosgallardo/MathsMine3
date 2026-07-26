package xyz.mathsmine3.nativeapp.data

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import xyz.mathsmine3.nativeapp.BuildConfig
import java.util.concurrent.TimeUnit

/**
 * Thin PostgREST client against the same Supabase project as the portal.
 */
class SupabaseRest(
    private val baseUrl: String = BuildConfig.SUPABASE_URL.trimEnd('/'),
    private val anonKey: String = BuildConfig.SUPABASE_ANON_KEY,
) {
    private val jsonMedia = "application/json".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    val configured: Boolean
        get() = baseUrl.isNotBlank() && anonKey.isNotBlank()

    fun select(
        table: String,
        filter: String = "",
        columns: String = "*",
        limit: Int? = null,
        offset: Int? = null,
        order: String? = null,
        single: Boolean = false,
    ): JSONArray {
        ensureConfigured()
        val q = buildString {
            append("select=").append(columns)
            if (filter.isNotBlank()) append("&").append(filter.trimStart('&'))
            if (order != null) append("&order=").append(order)
            if (limit != null) append("&limit=").append(limit)
            if (offset != null) append("&offset=").append(offset)
        }
        val req = baseRequest("/rest/v1/$table?$q")
            .get()
            .apply {
                if (single) header("Accept", "application/vnd.pgrst.object+json")
            }
            .build()
        return client.newCall(req).execute().use { resp ->
            val body = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) error("supabase select $table: HTTP ${resp.code} $body")
            when {
                body.isBlank() -> JSONArray()
                body.trimStart().startsWith("[") -> JSONArray(body)
                else -> JSONArray().put(JSONObject(body))
            }
        }
    }

    fun selectOne(table: String, filter: String, columns: String = "*"): JSONObject? {
        val arr = select(table, filter = filter, columns = columns, limit = 1)
        return if (arr.length() == 0) null else arr.getJSONObject(0)
    }

    fun count(table: String, filter: String = ""): Int {
        ensureConfigured()
        val q = buildString {
            append("select=id")
            if (filter.isNotBlank()) append("&").append(filter.trimStart('&'))
        }
        val req = baseRequest("/rest/v1/$table?$q")
            .head()
            .header("Prefer", "count=exact")
            .header("Range", "0-0")
            .build()
        return client.newCall(req).execute().use { resp ->
            if (!(resp.isSuccessful || resp.code == 206)) {
                // Some PostgREST setups reject HEAD — fall back to GET with count.
                return countViaGet(table, filter)
            }
            parseContentRangeTotal(resp.header("Content-Range"))
        }
    }

    private fun countViaGet(table: String, filter: String): Int {
        val q = buildString {
            append("select=id")
            if (filter.isNotBlank()) append("&").append(filter.trimStart('&'))
            append("&limit=1")
        }
        val req = baseRequest("/rest/v1/$table?$q")
            .get()
            .header("Prefer", "count=exact")
            .header("Range", "0-0")
            .build()
        return client.newCall(req).execute().use { resp ->
            if (!(resp.isSuccessful || resp.code == 206)) {
                error("supabase count $table: HTTP ${resp.code}")
            }
            parseContentRangeTotal(resp.header("Content-Range"))
        }
    }

    fun insert(table: String, row: JSONObject): JSONObject? {
        ensureConfigured()
        val req = baseRequest("/rest/v1/$table")
            .post(row.toString().toRequestBody(jsonMedia))
            .header("Prefer", "return=representation")
            .build()
        return parseRepresentation(client.newCall(req).execute(), "insert $table")
    }

    fun upsert(table: String, row: JSONObject, onConflict: String): JSONObject? {
        ensureConfigured()
        val req = baseRequest("/rest/v1/$table?on_conflict=$onConflict")
            .post(row.toString().toRequestBody(jsonMedia))
            .header("Prefer", "resolution=merge-duplicates,return=representation")
            .build()
        return parseRepresentation(client.newCall(req).execute(), "upsert $table")
    }

    private fun parseRepresentation(resp: okhttp3.Response, label: String): JSONObject? {
        return resp.use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) error("supabase $label: HTTP ${response.code} $body")
            when {
                body.isBlank() -> null
                body.trimStart().startsWith("[") -> {
                    val arr = JSONArray(body)
                    if (arr.length() == 0) null else arr.getJSONObject(0)
                }
                else -> JSONObject(body)
            }
        }
    }

    fun update(table: String, filter: String, patch: JSONObject): JSONObject? {
        ensureConfigured()
        val req = baseRequest("/rest/v1/$table?$filter")
            .method("PATCH", patch.toString().toRequestBody(jsonMedia))
            .header("Prefer", "return=representation")
            .build()
        return client.newCall(req).execute().use { resp ->
            val body = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) error("supabase update $table: HTTP ${resp.code} $body")
            when {
                body.isBlank() -> null
                body.trimStart().startsWith("[") -> {
                    val arr = JSONArray(body)
                    if (arr.length() == 0) null else arr.getJSONObject(0)
                }
                else -> JSONObject(body)
            }
        }
    }

    private fun baseRequest(pathAndQuery: String): Request.Builder {
        val url = if (pathAndQuery.startsWith("http")) pathAndQuery else "$baseUrl$pathAndQuery"
        return Request.Builder()
            .url(url)
            .header("apikey", anonKey)
            .header("Authorization", "Bearer $anonKey")
            .header("Content-Type", "application/json")
    }

    private fun ensureConfigured() {
        check(configured) { "Supabase not configured (SUPABASE_URL / ANON_KEY)" }
    }

    private fun parseContentRangeTotal(range: String?): Int {
        // Content-Range: 0-0/123
        if (range.isNullOrBlank()) return 0
        val slash = range.lastIndexOf('/')
        if (slash < 0 || slash == range.lastIndex) return 0
        return range.substring(slash + 1).toIntOrNull() ?: 0
    }
}
