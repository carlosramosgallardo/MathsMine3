'use client';

import SectionFrame from '@/components/SectionFrame';
import { useI18n } from '@/lib/i18n-context';
import { useMm3Accent } from '@/lib/use-mm3-accent';

export default function ApiPage() {
  const { language } = useI18n();
  const { frameAccent } = useMm3Accent();
  const es = language === 'es';

  const copy = es
    ? {
        intro:                  'MathsMine3 ofrece una API pública y de solo lectura con datos del mercado MM3 y del gameplay. Todos los endpoints devuelven JSON.',
        tokenValue:             'Valor del Token',
        tokenValueDesc:         'Valor MM3 acumulado más reciente (actualizado cada minuto):',
        tokenHistory:           'Histórico del Token',
        tokenHistoryDesc:       'Histórico horario del valor MM3 con desglose por fuente (hasta ~83 días):',
        tokenHistoryMinutes:    'Histórico por Minutos',
        tokenHistoryMinutesDesc:'Valor MM3 minuto a minuto de la última hora (60 puntos de datos):',
        nftEvents:              'Eventos de Mercado',
        nftEventsDesc:          'Todos los eventos de mercado: claims de NFTJI y continuaciones de vida:',
        leaderboard:            'Leaderboard',
        leaderboardDesc:        'Ranking completo ordenado por nivel y saldo MM3, paginado (50 por defecto, máx. 200):',
        squeezeApi:             'Squeezes',
        squeezeApiDesc:         'Detalle de cada Squeeze lanzado: pools implicados, estado, tiempos UTC, wallets registradas, scores, resultado y drop:',
        status:                 'Estado del Servicio',
        statusDesc:             'Estado de salud del servicio y cuota de rate limit:',
        rateLimit:              'Rate Limiting',
        rateLimitDesc:          'Los endpoints públicos (/api/token-value, /api/leaderboard) aplican un límite por IP. Las cabeceras X-RateLimit-* indican el estado de la cuota.',
      }
    : {
        intro:                  'MathsMine3 provides a public, read-only API with MM3 market and gameplay data. All endpoints return JSON.',
        tokenValue:             'Token Value',
        tokenValueDesc:         'Latest aggregated MM3 value (updated every minute):',
        tokenHistory:           'Token History',
        tokenHistoryDesc:       'Hourly MM3 value history with per-source breakdown (up to ~83 days):',
        tokenHistoryMinutes:    'Minute-level History',
        tokenHistoryMinutesDesc:'Minute-by-minute MM3 value for the last 60 minutes (60 data points):',
        nftEvents:              'Market Events',
        nftEventsDesc:          'All market events: NFTJI claims and life continues:',
        leaderboard:            'Leaderboard',
        leaderboardDesc:        'Full ranking sorted by level and MM3 balance, paginated (default 50, max 200):',
        squeezeApi:             'Squeezes',
        squeezeApiDesc:         'Details for every launched Squeeze: involved pools, status, UTC timings, registered wallets, scores, result and drop:',
        status:                 'Service Status',
        statusDesc:             'Service health and rate-limit quota:',
        rateLimit:              'Rate Limiting',
        rateLimitDesc:          'Public endpoints (/api/token-value, /api/leaderboard) enforce a per-IP limit. X-RateLimit-* headers report current quota.',
      };

  return (
    <main className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
      <SectionFrame accent={frameAccent} id="api-section">
        <div className="mm3-readable-scroll max-w-2xl mx-auto px-1 py-1 text-sm font-mono text-gray-400">
          <style>{`
            #api-section h2 {
              color: #22d3ee;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              text-shadow: 0 0 12px rgba(34,211,238,0.24);
            }
            #api-section code,
            #api-section pre {
              border: none !important;
              border-radius: 0 !important;
              background: linear-gradient(180deg, rgba(5,8,16,0.98) 0%, rgba(2,6,23,0.92) 100%) !important;
              box-shadow: inset 0 0 22px rgba(34,211,238,0.05);
            }
            #api-section a {
              color: #22d3ee;
            }
          `}</style>

          <p className="mb-6">{copy.intro}</p>

          {/* /api/token-value */}
          <h2 className="text-xl font-semibold mt-8 mb-2">{copy.tokenValue}</h2>
          <p className="mb-2">{copy.tokenValueDesc}</p>
          <code className="block bg-gray-800 p-2 rounded my-2">
            <a href="/api/token-value" className="text-blue-400" target="_blank">GET /api/token-value</a>
          </code>
          <pre className="bg-gray-900 p-3 rounded overflow-auto mb-6">{`{
  "value": 1.0234,
  "updatedAt": "2025-03-23T20:00:00Z"
}`}</pre>

          {/* /api/token-history */}
          <h2 className="text-xl font-semibold mt-8 mb-2">{copy.tokenHistory}</h2>
          <p className="mb-2">{copy.tokenHistoryDesc}</p>
          <code className="block bg-gray-800 p-2 rounded my-2">
            <a href="/api/token-history" className="text-blue-400" target="_blank">GET /api/token-history</a>
          </code>
          <pre className="bg-gray-900 p-3 rounded overflow-auto mb-6">{`[
  {
    "hour": "2025-03-26T18:00:00Z",
    "cumulative_reward": 0.00001776,
    "delta": 0.0000012,
    "mined_delta": 0.0000009,
    "trade_delta": 0.0000003,
    "trade_wallet_count": 4,
    "trade_google_count": 1,
    "nftji_delta": 0.000001,
    "market_delta": -0.000025
  }
]`}</pre>

          {/* /api/token-history-minutes */}
          <h2 className="text-xl font-semibold mt-8 mb-2">{copy.tokenHistoryMinutes}</h2>
          <p className="mb-2">{copy.tokenHistoryMinutesDesc}</p>
          <code className="block bg-gray-800 p-2 rounded my-2">
            <a href="/api/token-history-minutes" className="text-blue-400" target="_blank">GET /api/token-history-minutes</a>
          </code>
          <pre className="bg-gray-900 p-3 rounded overflow-auto mb-6">{`[
  {
    "minute": "14:30",
    "value": 0.00001234,
    "delta": 0.0000001,
    "mined_delta": 0.0000001,
    "trade_delta": 0,
    "trade_wallet_count": 0,
    "trade_google_count": 0,
    "nftji_delta": 0,
    "market_delta": 0
  }
]`}</pre>

          {/* /api/nft-events */}
          <h2 className="text-xl font-semibold mt-8 mb-2">{copy.nftEvents}</h2>
          <p className="mb-2">{copy.nftEventsDesc}</p>
          <code className="block bg-gray-800 p-2 rounded my-2">
            <a href="/api/nft-events" className="text-blue-400" target="_blank">GET /api/nft-events</a>
          </code>
          <pre className="bg-gray-900 p-3 rounded overflow-auto mb-6">{`[
  {
    "wallet": "0xabc...1234",
    "event_type": "nftji_claim",
    "delta_mm3": 0.000005,
    "created_at": "2025-03-26T18:30:00Z",
    "emoji": "🔮"
  },
  {
    "wallet": "0xdef...5678",
    "event_type": "life_continue",
    "delta_mm3": -0.000025,
    "created_at": "2025-03-26T18:45:00Z",
    "emoji": "❤️"
  }
]`}</pre>

          {/* /api/leaderboard */}
          <h2 className="text-xl font-semibold mt-8 mb-2">{copy.leaderboard}</h2>
          <p className="mb-2">{copy.leaderboardDesc}</p>
          <code className="block bg-gray-800 p-2 rounded my-2">
            <a href="/api/leaderboard?page=1&amp;limit=50" className="text-blue-400" target="_blank">GET /api/leaderboard<span className="text-gray-500">?page=1&amp;limit=50</span></a>
          </code>
          <pre className="bg-gray-900 p-3 rounded overflow-auto mb-6">{`{
  "page": 1,
  "limit": 50,
  "total": 128,
  "items": [
    {
      "rank": 1,
      "wallet": "0xabc...1234",
      "level": 72,
      "available_mm3": 0.00412,
      "total_correct": 340,
      "total_games": 410,
      "best_streak": 18,
      "cny_balance": 14.50,
      "eur_balance": 1.86,
      "usd_balance": 2.02,
      "nftjis": ["🔮", "🍀"]
    }
  ]
}`}</pre>

          {/* /api/wallet-pools/disputes */}
          <h2 className="text-xl font-semibold mt-8 mb-2">{copy.squeezeApi}</h2>
          <p className="mb-2">{copy.squeezeApiDesc}</p>
          <code className="block bg-gray-800 p-2 rounded my-2">
            <a href="/api/wallet-pools/disputes?pool=FHNN6&amp;limit=50" className="text-blue-400" target="_blank">GET /api/wallet-pools/disputes<span className="text-gray-500">?pool=FHNN6&amp;limit=50</span></a>
          </code>
          <pre className="bg-gray-900 p-3 rounded overflow-auto mb-6">{`{
  "ok": true,
  "disputes": [
    {
      "id": 42,
      "challenger_pool_code": "FHNN6",
      "defender_pool_code": "8FR49",
      "status": "resolved",
      "registered_at": "2026-05-09T10:00:00Z",
      "battle_start_at": "2026-05-09T10:00:05Z",
      "resolved_at": "2026-05-09T10:00:10Z",
      "cancelled_at": null,
      "winner": "defender",
      "drop_type": "attack",
      "war_percent": 59,
      "nature_percent": 60,
      "dice_modifier": 0.2414,
      "ch_score": 1269.7239,
      "df_score": 2025.3542,
      "ch_wallet_count": 2,
      "df_wallet_count": 2,
      "ch_exec_count": 5,
      "df_exec_count": 5,
      "result_summary": {
        "winner": "defender",
        "transfer_eur": 0.0243,
        "transfer_mm3": 0,
        "drop_type": "attack"
      },
      "wallets": [
        {
          "wallet": "0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528",
          "pool_code": "FHNN6",
          "side": "challenger",
          "level_snap": 79,
          "exec_snap": 5,
          "market_nftji_snap": "mm3-023",
          "market_nftji_level_snap": 0,
          "squeeze_nftji_equipped": "attack",
          "squeeze_nftji_level": 1,
          "delta_eur": -0.042,
          "delta_mm3": 0,
          "squeeze_nftji_claimed": false
        }
      ],
      "votes": [
        "0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528"
      ]
    }
  ]
}`}</pre>

          {/* /api/status */}
          <h2 className="text-xl font-semibold mt-8 mb-2">{copy.status}</h2>
          <p className="mb-2">{copy.statusDesc}</p>
          <code className="block bg-gray-800 p-2 rounded my-2">
            <a href="/api/status" className="text-blue-400" target="_blank">GET /api/status</a>
          </code>
          <pre className="bg-gray-900 p-3 rounded overflow-auto mb-6">{`{
  "message": "✅ Within rate limit",
  "ip": "1.2.3.4",
  "remaining": 9,
  "timestamp": "2026-04-21T06:55:34.476Z"
}`}</pre>

          {/* Rate limiting note */}
          <h2 className="text-xl font-semibold mt-8 mb-2">{copy.rateLimit}</h2>
          <p className="mb-6">{copy.rateLimitDesc}</p>

        </div>
      </SectionFrame>
    </main>
  );
}
