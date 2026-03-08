"use client";

import { useEffect, useState } from "react";

const LETTER_DELAY_MS = 200;
const BOUNCE_DURATION_MS = 300;
const PAUSE_BEFORE_REPEAT_MS = 3000;

export function BouncingTitle({ text }: { text: string }) {
  const [wave, setWave] = useState(0);

  const totalAnimationMs =
    text.length * LETTER_DELAY_MS + BOUNCE_DURATION_MS + PAUSE_BEFORE_REPEAT_MS;

  useEffect(() => {
    const id = setInterval(() => setWave((w) => w + 1), totalAnimationMs);
    return () => clearInterval(id);
  }, [totalAnimationMs]);

  return (
    <span className="text-xl font-semibold" aria-label={text}>
      {text.split("").map((char, i) => (
        <span
          key={`${i}-${wave}`}
          className="inline-block animate-[letter-bounce_var(--duration)_ease-in-out_var(--delay)_both]"
          style={
            {
              "--delay": `${i * LETTER_DELAY_MS}ms`,
              "--duration": `${BOUNCE_DURATION_MS}ms`,
            } as React.CSSProperties
          }
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  );
}
