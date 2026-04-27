'use client';
import { useEffect, useState } from 'react';

function formatLocal(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
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
      {now ? formatLocal(now) : '--:--:--'}
    </span>
  );
}
