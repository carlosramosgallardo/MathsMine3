import { NextRequest, NextResponse } from 'next/server'

const BOT_UA_PATTERNS = [
  /GPTBot/i,
  /ChatGPT-User/i,
  /CCBot/i,
  /anthropic-ai/i,
  /ClaudeBot/i,
  /AhrefsBot/i,
  /SemrushBot/i,
  /MJ12bot/i,
  /DotBot/i,
  /Bytespider/i,
  /PetalBot/i,
  /YandexBot/i,
  /DataForSeoBot/i,
  /BLEXBot/i,
  /serpstatbot/i,
]

export function proxy(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? ''
  if (BOT_UA_PATTERNS.some(p => p.test(ua))) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
