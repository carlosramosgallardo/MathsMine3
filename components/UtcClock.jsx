'use client';
import { useEffect, useState } from 'react';

function formatLocal(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date);
}

function getTzAbbr() {
  try {
    return (
      new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? 'LCL'
    );
  } catch {
    return 'LCL';
  }
}

export default function UtcClock({ className = '' }) {
  const [now, setNow] = useState(null);
  const [tzAbbr, setTzAbbr] = useState('');

  useEffect(() => {
    setTzAbbr(getTzAbbr());
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      <span className="opacity-55 mr-0.5 text-[0.68rem] sm:text-[0.75rem]">{tzAbbr}</span>
      {now ? formatLocal(now) : '--:--:--'}
    </span>
  );
}
