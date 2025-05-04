'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'

export default function TokenChart() {
  const [rawData, setRawData] = useState([])
  const [range, setRange] = useState('24h')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/token-history')
        const json = await res.json()

        if (!res.ok) {
          console.error('Token history API error:', json.error)
          return
        }

        setRawData(json)
      } catch (err) {
        console.error('Unexpected error fetching token history:', err)
      }
    }

    fetchData()
  }, [])

 const getVisibleData = () => {
  if (!rawData || rawData.length === 0) return []

  const now = Date.now()

  const filtered = rawData.filter(({ hour }) => {
    const h = new Date(hour).getTime()
    const diffHours = (now - h) / (1000 * 60 * 60)

    if (range === '24h') return diffHours <= 24
    if (range === '7d') return diffHours <= 24 * 7
    if (range === '30d') return diffHours <= 24 * 30
    return true
  })

  if (range === '24h') {
    return filtered.map((entry) => ({
      time: new Date(entry.hour).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
      }),
      value: parseFloat(entry.cumulative_reward)
    }))
  } else {
    const grouped = {}
    filtered.forEach(({ hour, cumulative_reward }) => {
      const day = new Date(hour).toISOString().slice(0, 10)
      grouped[day] = parseFloat(cumulative_reward)
    })

    return Object.entries(grouped).map(([day, value]) => ({
      time: day,
      value
    }))
  }
}
)

    if (range === '24h') {
      return filtered.map((entry) => ({
        time: new Date(entry.hour).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC'
        }),
        value: parseFloat(entry.cumulative_reward)
      }))
    } else {
      const grouped = {}
      filtered.forEach(({ hour, cumulative_reward }) => {
        const day = new Date(hour).toISOString().slice(0, 10)
        grouped[day] = parseFloat(cumulative_reward)
      })

      return Object.entries(grouped).map(([day, value]) => ({
        time: day,
        value
      }))
    }
  }

  const data = getVisibleData()

  return (
    <div className="w-full mt-10 bg-gray-900 p-4 rounded-xl shadow-lg">
      <div className="bg-[#0b0f19] rounded-xl overflow-hidden">
        <div className="text-sm text-right mb-3 p-2">
          <label htmlFor="range" className="mr-2 text-gray-400">
            View range:
          </label>
          <select
            id="range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="bg-black border border-white p-1 rounded text-white"
          >
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </div>

        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorToken" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.9} />
                  <stop offset="70%" stopColor="#22d3ee" stopOpacity={0.1} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="time"
                tick={{ fill: '#ccc', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(val) => `${val} MM3`}
                tick={{ fill: '#ccc', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.05} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  borderRadius: '8px',
                  border: 'none',
                  color: '#e5e7eb'
                }}
                labelStyle={{ color: '#22d3ee' }}
                formatter={(value) => [`${value} MM3`, 'Value']}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#22d3ee"
                fillOpacity={1}
                fill="url(#colorToken)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-sm text-gray-400">
            No chart data available yet.
          </p>
        )}
      </div>
    </div>
  )
}
