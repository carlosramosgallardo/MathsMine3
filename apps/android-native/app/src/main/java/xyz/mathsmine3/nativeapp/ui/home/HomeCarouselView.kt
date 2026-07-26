package xyz.mathsmine3.nativeapp.ui.home

import android.content.Context
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.Matrix
import android.view.MotionEvent
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Home arena carousel — native stand-in for HomeMiningWorld3D.
 * Coloured bot blocks orbit a cyan disc; drag to spin; auto-rotates like the web.
 */
class HomeCarouselView(context: Context) : GLSurfaceView(context) {
    private val renderer = CarouselRenderer()

    init {
        setEGLContextClientVersion(2)
        setRenderer(renderer)
        renderMode = RENDERMODE_CONTINUOUSLY
    }

    /** Sync with nonagon selection (0..n-1) — ease toward that slot. */
    fun setSelectedIndex(index: Int, count: Int) {
        renderer.targetSlot = index
        renderer.slotCount = max(1, count)
    }

    fun destroy() {
        queueEvent { renderer.release() }
    }

    private var lastX = 0f
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastX = event.x
                renderer.userDragging = true
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = event.x - lastX
                lastX = event.x
                renderer.yawDeg += dx * 0.35f
                renderer.userSpinUntil = System.currentTimeMillis() + 4000
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                renderer.userDragging = false
            }
        }
        return true
    }
}

private class CarouselRenderer : GLSurfaceView.Renderer {
    var yawDeg = 18f
    var targetSlot = 0
    var slotCount = 10
    var userDragging = false
    var userSpinUntil = 0L

    private val bots = arrayOf(
        floatArrayOf(0.29f, 0.87f, 0.50f), // green
        floatArrayOf(0.13f, 0.83f, 0.93f), // cyan
        floatArrayOf(0.98f, 0.45f, 0.09f), // orange
        floatArrayOf(0.85f, 0.27f, 0.94f), // magenta
        floatArrayOf(0.98f, 0.75f, 0.14f), // yellow
        floatArrayOf(0.96f, 0.62f, 0.04f), // amber
    )

    private var program = 0
    private var uMvp = 0
    private var uColor = 0
    private var aPos = 0
    private val proj = FloatArray(16)
    private val view = FloatArray(16)
    private val model = FloatArray(16)
    private val mvp = FloatArray(16)
    private val scratch = FloatArray(16)
    private var cubeVbo = IntArray(1)
    private var discVbo = IntArray(1)
    private var discCount = 0
    private var ready = false

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        GLES20.glClearColor(0.027f, 0.043f, 0.059f, 1f)
        GLES20.glEnable(GLES20.GL_DEPTH_TEST)
        GLES20.glEnable(GLES20.GL_CULL_FACE)
        program = buildProgram(VERT, FRAG)
        uMvp = GLES20.glGetUniformLocation(program, "uMvp")
        uColor = GLES20.glGetUniformLocation(program, "uColor")
        aPos = GLES20.glGetAttribLocation(program, "aPos")
        cubeVbo[0] = genBuffer(CUBE)
        val disc = buildDisc(36, 2.6f)
        discCount = disc.size / 3
        discVbo[0] = genBuffer(disc)
        ready = true
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        GLES20.glViewport(0, 0, width, height)
        val aspect = width.toFloat() / max(1, height)
        Matrix.perspectiveM(proj, 0, 42f, aspect, 0.1f, 40f)
    }

    override fun onDrawFrame(gl: GL10?) {
        if (!ready) return
        val now = System.currentTimeMillis()
        if (!userDragging && now > userSpinUntil) {
            // Ease toward selected nonagon slot + gentle auto drift
            val targetYaw = -targetSlot * (360f / slotCount) + 18f
            var delta = ((targetYaw - yawDeg + 540f) % 360f) - 180f
            yawDeg += delta * 0.06f
            yawDeg += 0.12f // continuous carousel drift like web
        }

        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
        GLES20.glUseProgram(program)

        Matrix.setLookAtM(view, 0, 0f, 3.2f, 6.2f, 0f, 0.7f, 0f, 0f, 1f, 0f)

        // Floor disc
        Matrix.setIdentityM(model, 0)
        Matrix.rotateM(model, 0, yawDeg * 0.15f, 0f, 1f, 0f)
        Matrix.scaleM(model, 0, 1f, 0.08f, 1f)
        drawMesh(discVbo[0], discCount, floatArrayOf(0.05f, 0.55f, 0.65f), GLES20.GL_TRIANGLE_FAN)

        // Orbiting bots
        val n = bots.size
        for (i in 0 until n) {
            val a = Math.toRadians((i * (360.0 / n) + yawDeg).toDouble())
            val x = (sin(a) * 1.85).toFloat()
            val z = (cos(a) * 1.85).toFloat()
            Matrix.setIdentityM(model, 0)
            Matrix.translateM(model, 0, x, 0.55f, z)
            Matrix.rotateM(model, 0, -yawDeg + i * 25f, 0f, 1f, 0f)
            Matrix.scaleM(model, 0, 0.35f, 0.85f, 0.35f)
            drawMesh(cubeVbo[0], CUBE.size / 3, bots[i], GLES20.GL_TRIANGLES)

            // Head
            Matrix.setIdentityM(model, 0)
            Matrix.translateM(model, 0, x, 1.15f, z)
            Matrix.scaleM(model, 0, 0.28f, 0.28f, 0.28f)
            val head = floatArrayOf(
                min(1f, bots[i][0] + 0.25f),
                min(1f, bots[i][1] + 0.25f),
                min(1f, bots[i][2] + 0.25f),
            )
            drawMesh(cubeVbo[0], CUBE.size / 3, head, GLES20.GL_TRIANGLES)
        }

        // Center pedestal
        Matrix.setIdentityM(model, 0)
        Matrix.translateM(model, 0, 0f, 0.2f, 0f)
        Matrix.scaleM(model, 0, 0.55f, 0.2f, 0.55f)
        drawMesh(cubeVbo[0], CUBE.size / 3, floatArrayOf(0.13f, 0.83f, 0.93f), GLES20.GL_TRIANGLES)
    }

    private fun drawMesh(vbo: Int, count: Int, color: FloatArray, mode: Int) {
        Matrix.multiplyMM(scratch, 0, view, 0, model, 0)
        Matrix.multiplyMM(mvp, 0, proj, 0, scratch, 0)
        GLES20.glUniformMatrix4fv(uMvp, 1, false, mvp, 0)
        GLES20.glUniform4f(uColor, color[0], color[1], color[2], 1f)
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, vbo)
        GLES20.glEnableVertexAttribArray(aPos)
        GLES20.glVertexAttribPointer(aPos, 3, GLES20.GL_FLOAT, false, 0, 0)
        GLES20.glDrawArrays(mode, 0, count)
        GLES20.glDisableVertexAttribArray(aPos)
    }

    fun release() {
        ready = false
    }

    companion object {
        private val VERT = """
            attribute vec3 aPos;
            uniform mat4 uMvp;
            void main() {
              gl_Position = uMvp * vec4(aPos, 1.0);
            }
        """.trimIndent()

        private val FRAG = """
            precision mediump float;
            uniform vec4 uColor;
            void main() {
              gl_FragColor = uColor;
            }
        """.trimIndent()

        // Unit cube as triangles
        private val CUBE = floatArrayOf(
            // front
            -1f, -1f, 1f, 1f, -1f, 1f, 1f, 1f, 1f,
            -1f, -1f, 1f, 1f, 1f, 1f, -1f, 1f, 1f,
            // back
            -1f, -1f, -1f, -1f, 1f, -1f, 1f, 1f, -1f,
            -1f, -1f, -1f, 1f, 1f, -1f, 1f, -1f, -1f,
            // left
            -1f, -1f, -1f, -1f, -1f, 1f, -1f, 1f, 1f,
            -1f, -1f, -1f, -1f, 1f, 1f, -1f, 1f, -1f,
            // right
            1f, -1f, -1f, 1f, 1f, -1f, 1f, 1f, 1f,
            1f, -1f, -1f, 1f, 1f, 1f, 1f, -1f, 1f,
            // top
            -1f, 1f, -1f, -1f, 1f, 1f, 1f, 1f, 1f,
            -1f, 1f, -1f, 1f, 1f, 1f, 1f, 1f, -1f,
            // bottom
            -1f, -1f, -1f, 1f, -1f, -1f, 1f, -1f, 1f,
            -1f, -1f, -1f, 1f, -1f, 1f, -1f, -1f, 1f,
        )

        private fun buildDisc(segments: Int, radius: Float): FloatArray {
            val out = FloatArray((segments + 2) * 3)
            out[0] = 0f; out[1] = 0f; out[2] = 0f
            for (i in 0..segments) {
                val a = i.toFloat() / segments * (Math.PI * 2).toFloat()
                val o = (i + 1) * 3
                out[o] = cos(a) * radius
                out[o + 1] = 0f
                out[o + 2] = sin(a) * radius
            }
            return out
        }

        private fun buildProgram(v: String, f: String): Int {
            fun compile(type: Int, src: String): Int {
                val id = GLES20.glCreateShader(type)
                GLES20.glShaderSource(id, src)
                GLES20.glCompileShader(id)
                return id
            }
            val vs = compile(GLES20.GL_VERTEX_SHADER, v)
            val fs = compile(GLES20.GL_FRAGMENT_SHADER, f)
            val p = GLES20.glCreateProgram()
            GLES20.glAttachShader(p, vs)
            GLES20.glAttachShader(p, fs)
            GLES20.glLinkProgram(p)
            return p
        }

        private fun genBuffer(data: FloatArray): Int {
            val buf = java.nio.ByteBuffer.allocateDirect(data.size * 4)
                .order(java.nio.ByteOrder.nativeOrder())
                .asFloatBuffer()
            buf.put(data).position(0)
            val ids = IntArray(1)
            GLES20.glGenBuffers(1, ids, 0)
            GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, ids[0])
            GLES20.glBufferData(
                GLES20.GL_ARRAY_BUFFER,
                data.size * 4,
                buf,
                GLES20.GL_STATIC_DRAW,
            )
            return ids[0]
        }
    }
}
