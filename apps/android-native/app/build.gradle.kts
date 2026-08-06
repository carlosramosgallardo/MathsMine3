import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}


/**
 * Load portal `.env.local` (repo root) so Android shares the same Google / Supabase
 * values as Next.js. File is gitignored — never commit secrets.
 */
fun loadPortalEnv(): Map<String, String> {
    val candidates = listOf(
        rootProject.projectDir.resolve("../../.env.local"),
        rootProject.projectDir.resolve("../../.env"),
    )
    val out = linkedMapOf<String, String>()
    for (file in candidates) {
        if (!file.isFile) continue
        file.readLines().forEach { raw ->
            val line = raw.trim()
            if (line.isEmpty() || line.startsWith("#")) return@forEach
            val eq = line.indexOf('=')
            if (eq <= 0) return@forEach
            val key = line.substring(0, eq).trim()
            var value = line.substring(eq + 1).trim()
            if ((value.startsWith("\"") && value.endsWith("\"")) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.substring(1, value.length - 1)
            }
            out.putIfAbsent(key, value)
        }
    }
    return out
}

fun escapeForBuildConfig(value: String): String =
    value.replace("\\", "\\\\").replace("\"", "\\\"")

val portalEnv = loadPortalEnv()
// Same Web client ID as the Next.js portal (.env.local).
val googleClientId = sequenceOf(
    portalEnv["NEXT_PUBLIC_GOOGLE_CLIENT_ID"],
    System.getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID"),
).mapNotNull { it?.trim()?.takeIf(String::isNotEmpty) }.firstOrNull() ?: ""
val supabaseUrl = portalEnv["NEXT_PUBLIC_SUPABASE_URL"]
    ?: System.getenv("MM3_SUPABASE_URL")
    ?: System.getenv("NEXT_PUBLIC_SUPABASE_URL")
    ?: ""
val supabaseAnon = portalEnv["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    ?: System.getenv("MM3_SUPABASE_ANON_KEY")
    ?: System.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    ?: ""
val adminWallet = sequenceOf(
    portalEnv["NEXT_PUBLIC_ADMIN_WALLET"],
    System.getenv("NEXT_PUBLIC_ADMIN_WALLET"),
).mapNotNull { it?.trim()?.trim('"')?.takeIf(String::isNotEmpty) }.firstOrNull() ?: ""
val donateEthAmount = sequenceOf(
    portalEnv["NEXT_PUBLIC_FAKE_MINING_PRICE"],
    System.getenv("NEXT_PUBLIC_FAKE_MINING_PRICE"),
).mapNotNull { it?.trim()?.trim('"')?.takeIf(String::isNotEmpty) }.firstOrNull() ?: "0.00001"

if (googleClientId.isBlank()) {
    logger.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID missing — put it in repo-root .env.local")
} else {
    logger.lifecycle("Loaded Google client ID from .env.local (${googleClientId.take(12)}…)")
}
if (supabaseUrl.isNotBlank()) {
    logger.lifecycle("Loaded Supabase URL from .env.local")
}

android {
    namespace = "xyz.mathsmine3.nativeapp"
    compileSdk = 35

    defaultConfig {
        applicationId = "xyz.mathsmine3.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 33
        versionName = "0.1.0-beta.7"
        buildConfigField("String", "API_BASE_URL", "\"https://mathsmine3.xyz\"")
        buildConfigField("String", "GOOGLE_CLIENT_ID", "\"${escapeForBuildConfig(googleClientId)}\"")
        buildConfigField("String", "SUPABASE_URL", "\"${escapeForBuildConfig(supabaseUrl)}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${escapeForBuildConfig(supabaseAnon)}\"")
        // Same as web FooterEthDonate (NEXT_PUBLIC_ADMIN_WALLET / FAKE_MINING_PRICE).
        buildConfigField("String", "ADMIN_WALLET", "\"${escapeForBuildConfig(adminWallet)}\"")
        buildConfigField("String", "DONATE_ETH_AMOUNT", "\"${escapeForBuildConfig(donateEthAmount)}\"")
        // Same value as web OAuth client — used by GoogleSignIn requestIdToken
        resValue("string", "default_web_client_id", googleClientId.ifBlank {
            "MISSING_GOOGLE_CLIENT_ID_IN_ENV_LOCAL"
        })
        manifestPlaceholders["appAuthRedirectScheme"] = "xyz.mathsmine3.app"
        // Default; overridden per buildType (debug → local Next via adb reverse).
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        buildConfigField("String", "PORTAL_BASE_URL", "\"https://mathsmine3.xyz\"")
        // Filament ships prebuilt .so — AGP needs NDK installed to extract SYMBOL_TABLE into the AAB.
        ndk {
            debugSymbolLevel = "SYMBOL_TABLE"
        }
    }

    // Release signing: apps/android-native/keystore.properties (gitignored).
    // See keystore.properties.example and PLAY_RELEASE.md.
    val keystorePropsFile = rootProject.file("keystore.properties")
    val keystoreProps = Properties()
    val hasReleaseKeystore = keystorePropsFile.isFile.also { exists ->
        if (exists) keystorePropsFile.inputStream().use { keystoreProps.load(it) }
    }
    if (hasReleaseKeystore) {
        val storeFilePath = keystoreProps.getProperty("storeFile")?.trim().orEmpty()
        val storePassword = keystoreProps.getProperty("storePassword")?.trim().orEmpty()
        val keyAlias = keystoreProps.getProperty("keyAlias")?.trim().orEmpty()
        val keyPassword = keystoreProps.getProperty("keyPassword")?.trim().orEmpty()
        val storeFileResolved = rootProject.file(storeFilePath)
        require(storeFileResolved.isFile) {
            "keystore.properties storeFile not found: ${storeFileResolved.absolutePath}"
        }
        signingConfigs {
            create("release") {
                storeFile = storeFileResolved
                this.storePassword = storePassword
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
            }
        }
    } else {
        logger.warn(
            "keystore.properties missing — release builds are unsigned. " +
                "Copy keystore.properties.example and create release.keystore (see PLAY_RELEASE.md)."
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            buildConfigField("String", "PORTAL_BASE_URL", "\"https://mathsmine3.xyz\"")
            manifestPlaceholders["usesCleartextTraffic"] = "false"
            if (hasReleaseKeystore) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        debug {
            applicationIdSuffix = ""
            // Emulator → host: `adb reverse tcp:3000 tcp:3000` + `npm run dev:https` (TLS on :3000).
            // Plain `next dev` without --experimental-https will NOT work on http://127.0.0.1:3000.
            buildConfigField("String", "PORTAL_BASE_URL", "\"https://127.0.0.1:3000\"")
            manifestPlaceholders["usesCleartextTraffic"] = "true"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }
    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.3")
    implementation("androidx.navigation:navigation-compose:2.7.7")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-moshi:2.11.0")
    implementation("com.squareup.moshi:moshi-kotlin:1.15.1")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.8.1")

    implementation("com.google.android.gms:play-services-auth:21.2.0")
    implementation("androidx.credentials:credentials:1.2.2")
    implementation("androidx.credentials:credentials-play-services-auth:1.2.2")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.0")

    implementation("androidx.datastore:datastore-preferences:1.1.1")

    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    implementation("com.google.android.filament:filament-android:1.51.0")
    implementation("com.google.android.filament:filament-utils-android:1.51.0")
    implementation("com.google.android.filament:gltfio-android:1.51.0")
}
