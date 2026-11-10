"use client"

import * as React from "react"

const SRC = "/brand/orvo-logo-animation.svg"
// The file loops every 5.255s: wordmark, collapse into the coin, coin settles
// (from about 3.46s), coin fades (from about 4.06s), wordmark returns. The
// wordmark returning is the loop, so the page stops on the settled coin and
// never lets the file get that far.
const END_MS = 3900
// Hold the settled coin briefly, then dissolve.
const HOLD_MS = 400
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

    // Freeze every animation of the file on the settled coin frame.
    const freeze = () => {
      if (!root) return
      for (const a of document.getAnimations()) {
        const target = (a.effect as KeyframeEffect | null)?.target
        if (target && root.contains(target)) {
          a.pause()
          a.currentTime = END_MS
        }
      }
    }

    const finish = () => {
      if (cancelled) return
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
            if (elapsed >= END_MS) {
              freeze()
              hold = window.setTimeout(finish, HOLD_MS)
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
      <style>{`.orvo-splash-paused, .orvo-splash-paused * { animation-play-state: paused !important; } .orvo-splash svg { display: block; width: 100%; height: auto; }`}</style>
      <div
        ref={rootRef}
        className="orvo-splash orvo-splash-paused"
        style={{ width: "min(440px, 60vw)", height: "auto" }}
        dangerouslySetInnerHTML={{ __html: svg ?? "" }}
      />
    </div>
  )
}
