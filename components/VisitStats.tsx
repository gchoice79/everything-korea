'use client';

import { useEffect, useRef, useState } from 'react';

export default function VisitStats({ todayLabel, totalLabel }: { todayLabel: string; totalLabel: string }) {
  const [stats, setStats] = useState<{ today: number; total: number } | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    fetch('/api/track-visit', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => setStats({ today: d.today, total: d.total }))
      .catch(() => {});
  }, []);

  if (!stats) return null;

  return (
    <div className="mt-6 flex gap-5 text-xs font-mono opacity-60">
      <span>
        {todayLabel} {stats.today.toLocaleString()}
      </span>
      <span>
        {totalLabel} {stats.total.toLocaleString()}
      </span>
    </div>
  );
}
