package xyz.mathsmine3.nativeapp.mining

import android.content.Context
import android.graphics.Color
import android.view.Choreographer
import android.view.Surface
import android.view.SurfaceView
import com.google.android.filament.Camera
import com.google.android.filament.Engine
import com.google.android.filament.EntityManager
import com.google.android.filament.LightManager
import com.google.android.filament.Renderer
import com.google.android.filament.Scene
import com.google.android.filament.SwapChain
import com.google.android.filament.View
import com.google.android.filament.Viewport
import com.google.android.filament.android.UiHelper
import com.google.android.filament.utils.Utils

/**
 * Filament FPV host for the native mining port of MiningChain3DFPV.
 * Clears to the portal dark background and sets up camera + key light.
 * Map meshes, collision, PvP and bosses attach on top of this scaffold.
 */
class MiningFilamentView(context: Context) : SurfaceView(context) {
    private var engine: Engine? = null
    private var renderer: Renderer? = null
    private var scene: Scene? = null
    private var view: View? = null
    private var camera: Camera? = null
    private var swapChain: SwapChain? = null
    private var uiHelper: UiHelper? = null
    private var cameraEntity = 0
    private var lightEntity = 0
    private var running = false

    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (!running) return
            val eng = engine
            val ren = renderer
            val sc = swapChain
            val v = view
            if (eng != null && ren != null && sc != null && v != null) {
                if (ren.beginFrame(sc, frameTimeNanos)) {
                    ren.render(v)
                    ren.endFrame()
                }
            }
            Choreographer.getInstance().postFrameCallback(this)
        }
    }

    init {
        Utils.init()
        setBackgroundColor(Color.parseColor("#070B0F"))
        uiHelper = UiHelper(UiHelper.ContextErrorPolicy.DONT_CHECK).also { helper ->
            helper.renderCallback = object : UiHelper.RendererCallback {
                override fun onNativeWindowChanged(surface: Surface) {
                    val eng = engine ?: return
                    swapChain?.let { eng.destroySwapChain(it) }
                    swapChain = eng.createSwapChain(surface)
                }

                override fun onDetachedFromSurface() {
                    val eng = engine ?: return
                    swapChain?.let {
                        eng.destroySwapChain(it)
                        eng.flushAndWait()
                    }
                    swapChain = null
                }

                override fun onResized(width: Int, height: Int) {
                    view?.viewport = Viewport(0, 0, width, height)
                    val aspect = if (height == 0) 1.0 else width.toDouble() / height.toDouble()
                    camera?.setProjection(70.0, aspect, 0.05, 500.0, Camera.Fov.VERTICAL)
                }
            }
            helper.attachTo(this)
        }
        post {
            setupEngine()
            running = true
            Choreographer.getInstance().postFrameCallback(frameCallback)
        }
    }

    private fun setupEngine() {
        if (engine != null) return
        val eng = Engine.create()
        engine = eng
        renderer = eng.createRenderer()
        scene = eng.createScene()
        view = eng.createView().also {
            it.scene = scene
            it.blendMode = View.BlendMode.OPAQUE
        }
        cameraEntity = EntityManager.get().create()
        camera = eng.createCamera(cameraEntity).also { cam ->
            view?.camera = cam
            cam.lookAt(0.0, 1.6, 4.0, 0.0, 1.2, 0.0, 0.0, 1.0, 0.0)
            cam.setProjection(70.0, 16.0 / 9.0, 0.05, 500.0, Camera.Fov.VERTICAL)
        }
        lightEntity = EntityManager.get().create()
        LightManager.Builder(LightManager.Type.DIRECTIONAL)
            .color(0.13f, 0.83f, 0.93f)
            .intensity(80_000.0f)
            .direction(0.3f, -1.0f, -0.4f)
            .castShadows(false)
            .build(eng, lightEntity)
        scene?.addEntity(lightEntity)
    }

    fun destroyEngine() {
        running = false
        Choreographer.getInstance().removeFrameCallback(frameCallback)
        uiHelper?.detach()
        val eng = engine ?: return
        swapChain?.let { eng.destroySwapChain(it) }
        view?.let { eng.destroyView(it) }
        if (cameraEntity != 0) {
            eng.destroyCameraComponent(cameraEntity)
            EntityManager.get().destroy(cameraEntity)
        }
        if (lightEntity != 0) {
            eng.destroyEntity(lightEntity)
            EntityManager.get().destroy(lightEntity)
        }
        scene?.let { eng.destroyScene(it) }
        renderer?.let { eng.destroyRenderer(it) }
        eng.destroy()
        engine = null
        swapChain = null
    }
}
