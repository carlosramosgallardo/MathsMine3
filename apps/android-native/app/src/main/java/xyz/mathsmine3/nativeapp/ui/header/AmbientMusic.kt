package xyz.mathsmine3.nativeapp.ui.header

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer

/** Ambient track matching web `/ambient/freakingai_mm3_song.mp3` @ low volume. */
object AmbientMusic {
    private var player: MediaPlayer? = null

    fun setEnabled(context: Context, enabled: Boolean) {
        if (!enabled) {
            stop()
            return
        }
        if (player?.isPlaying == true) return
        runCatching {
            stop()
            val mp = MediaPlayer()
            context.assets.openFd("ambient/freakingai_mm3_song.mp3").use { afd ->
                mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            }
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_GAME)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build(),
            )
            mp.isLooping = true
            mp.setVolume(0.12f, 0.12f)
            mp.prepare()
            mp.start()
            player = mp
        }
    }

    fun stop() {
        runCatching {
            player?.stop()
            player?.release()
        }
        player = null
    }
}
