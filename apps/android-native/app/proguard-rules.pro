# MathsMine3 native — release shrink rules (Retrofit + Moshi + session auth)

-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepattributes *Annotation*

-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response

-keepclasseswithmembers class * {
    @com.squareup.moshi.* <methods>;
}
-keep @com.squareup.moshi.JsonClass class * { *; }

-keep class xyz.mathsmine3.nativeapp.BuildConfig { *; }
-keep class xyz.mathsmine3.nativeapp.data.** { *; }
-keep class xyz.mathsmine3.nativeapp.auth.** { *; }

# WebView JS bridge names used from Kotlin
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
