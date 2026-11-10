"use client"

import * as React from "react"

// One full cycle of the logo animation file (its CSS and SMIL duration).
const CYCLE_MS = 5255
// The file's last frame equals its first frame, so the fade starts exactly at
// the end of the cycle. Keep it under ~1s: the loop restarts behind the fade
// and its first change is at 19% of the cycle (about 1s).
const FADE_MS = 800

export function SplashLoader() {
  const [phase, setPhase] = React.useState<"playing" | "fading" | "done">("playing")
  const imgRef = React.useRef<HTMLImageElement>(null)
  const started = React.useRef(false)

  const start = React.useCallback(() => {
    if (started.current) return
    started.current = true
    window.setTimeout(() => setPhase("fading"), CYCLE_MS)
    window.setTimeout(() => setPhase("done"), CYCLE_MS + FADE_MS)
  }, [])

  React.useEffect(() => {
    // The image may finish loading before hydration, so onLoad is missed.
    if (imgRef.current?.complete) start()
  }, [start])

  if (phase === "done") return null

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
      style={{
        opacity: phase === "fading" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-in-out`,
        pointerEvents: phase === "fading" ? "none" : "auto",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src="/brand/orvo-logo-animation.svg"
        alt=""
        width={665}
        height={432}
        onLoad={start}
        onError={start}
        style={{ width: "min(665px, 80vw)", height: "auto" }}
      />
    </div>
  )
}
