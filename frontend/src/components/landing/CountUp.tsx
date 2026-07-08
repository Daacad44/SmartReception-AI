import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  target: number;
  decimals?: number;
  suffix?: string;
  durationMs?: number;
  className?: string;
}

export function CountUp({ target, decimals = 0, suffix = '', durationMs = 1500, className }: CountUpProps) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / durationMs, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(target * eased);
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, durationMs]);

  return (
    <span ref={ref} className={className}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
