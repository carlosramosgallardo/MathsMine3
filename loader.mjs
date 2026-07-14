export async function resolve(specifier, context, next) {
  try { return await next(specifier, context) }
  catch (e) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      for (const ext of ['.js', '.jsx', '/index.js']) {
        try { return await next(specifier + ext, context) } catch {}
      }
    }
    throw e
  }
}
