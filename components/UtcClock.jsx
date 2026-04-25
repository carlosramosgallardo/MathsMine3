'use client';
import { useEffect, useState } from 'react';

function formatUtc(date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'UTC',
  }).format(date);
}

export default function UtcClock({ className = '' }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={className} suppressHydrationWarning>
      <span className="opacity-55 mr-0.5 text-[0.46rem] sm:text-[0.52rem]">UTC</span>
      {now ? formatUtc(now) : '--:--:--'}
    </span>
  );
}
