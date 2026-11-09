/** Small Claude mark for the "Uses Claude Sonnet 5.5" line. Drawn as a simple twelve-ray burst; swap in the official asset if you have it. Logged in docs/exceptions.md. */
export function ClaudeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="#D97757" strokeLinecap="round" strokeWidth="2.2">
      {Array.from({ length: 12 }, (_, i) => {
        const angle = ((i * 30 - 90) * Math.PI) / 180;
        const outer = i % 2 === 0 ? 10.5 : 8.5;
        return <line key={i} x1={12 + Math.cos(angle) * 2.5} y1={12 + Math.sin(angle) * 2.5} x2={12 + Math.cos(angle) * outer} y2={12 + Math.sin(angle) * outer} />;
      })}
    </svg>
  );
}
