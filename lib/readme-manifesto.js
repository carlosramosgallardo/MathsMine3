/**
 * Extract manifesto markdown sections from README.md (same markers as /manifesto page).
 */
export function extractManifesto(readmeText, lang) {
  const startTag = lang === 'es' ? '<!-- MANIFESTO_ES_START -->' : '<!-- MANIFESTO_EN_START -->'
  const endTag = lang === 'es' ? '<!-- MANIFESTO_ES_END -->' : '<!-- MANIFESTO_EN_END -->'
  const startIndex = readmeText.indexOf(startTag)
  const endIndex = readmeText.indexOf(endTag)

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return ''
  }

  return readmeText.slice(startIndex + startTag.length, endIndex).trim()
}
