"use client"

import * as React from "react"

const SRC = "/brand/orvo-logo-animation.svg"
// The file's own loop: every keyframe and animation in it is 5.255s.
// Its first and last frames are the same (wordmark, no coin), so ending on
// the last frame of one cycle leaves the same picture the cycle starts on.
const CYCLE_MS = 5255
// Reduced motion: the file turns its animations off and shows the wordmark.
const STATIC_HOLD_MS = 1200
const FADE_MS = 800

type Phase = "loading" | "playing" | "fading" | "done"

export function SplashLoader() {
  const [phase, setPhase] = React.useState<Phase>("loading")
  const [svg, setSvg] = React.useState<string | null>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)

  // 1. Load the file and inline it. An <img> would run its clock on its own
  //    schedule, so the page could not start or stop it.
  React.useEffect(() => {
    let cancelled = false
    fetch(SRC)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => {
        if (!cancelled) setSvg(text)
      })
      .catch(() => {
        if (!cancelled) setSvg("")
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 2. Once the SVG is in the DOM and painted in its paused state, release it
  //    at frame 0 and end it on the animation's own clock.
  React.useEffect(() => {
    if (svg === null) return
    const root = rootRef.current
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let raf = 0
    let hold: number | undefined
    let cancelled = false

    const finish = () => {
      if (cancelled) return
      // Freeze every animation on frame 0 (the wordmark) before fading.
      if (root) {
        for (const a of document.getAnimations()) {
          const target = (a.effect as KeyframeEffect | null)?.target
          if (target && root.contains(target)) {
            a.pause()
            a.currentTime = 0
          }
        }
      }
      setPhase("fading")
      hold = window.setTimeout(() => setPhase("done"), FADE_MS)
    }

    if (!root || !svg || reduced) {
      setPhase("playing")
      hold = window.setTimeout(finish, STATIC_HOLD_MS)
    } else {
      setPhase("playing")
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          // Two frames: the paused first frame has been painted before release.
          root.classList.remove("orvo-splash-paused")
          const clock = root.querySelector(".wordwrap")?.getAnimations()[0]
          const started = performance.now()
          const tick = () => {
            const t = clock?.currentTime
            const elapsed = typeof t === "number" ? t : performance.now() - started
            if (elapsed >= CYCLE_MS) {
              finish()
              return
            }
            raf = requestAnimationFrame(tick)
          }
          raf = requestAnimationFrame(tick)
        })
      })
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (hold !== undefined) window.clearTimeout(hold)
    }
  }, [svg])

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
      <style>{`.orvo-splash-paused, .orvo-splash-paused * { animation-play-state: paused !important; } .orvo-splash-paused svg { display: block; width: 100%; height: auto; }`}</style>
      <div
        ref={rootRef}
        className="orvo-splash-paused"
        style={{ width: "min(440px, 60vw)", height: "auto" }}
        dangerouslySetInnerHTML={{ __html: svg ?? "" }}
      />
    </div>
  )
}
