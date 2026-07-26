package xyz.mathsmine3.nativeapp

import android.app.Application

class Mm3App : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
