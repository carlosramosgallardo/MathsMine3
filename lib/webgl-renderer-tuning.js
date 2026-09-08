/**
 * Three validates every linked program with getProgramInfoLog, and that call
 * blocks until the driver has finished linking. Profiling the home carousel
 * showed 47 programs linking across the first 23 seconds — one batch each time
 * a figure rotated into view — and 1.29s of main-thread stalls, essentially all
 * of it inside that one call. That is the "stutters for a while after load"
 * everyone sees, and it costs more, not less, on Windows/ANGLE where linking
 * also translates to HLSL.
 *
 * Shader sources are fixed at build time, so production learns nothing from the
 * check. Development keeps it: a broken shader has to say where it broke.
 */
export function skipShaderErrorChecks(renderer) {
  if (process.env.NODE_ENV !== 'production') return
  renderer.debug.checkShaderErrors = false
}
