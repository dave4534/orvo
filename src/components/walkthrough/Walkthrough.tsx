'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { ArrowUpRight, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Lightbox } from './Lightbox'
import type { WalkthroughBlock, WalkthroughStep } from './types'
import './walkthrough.css'

// A guide for a reviewer. It is shared between projects: the content, the places it can open,
// the anchor, the images and the timing all come in as props, so the look and behaviour stay identical.

const MARGIN = 8 // keeps the circle off the window edge
const GAP = 16 // between the circle and the card
const CARD_WIDTH = 360
const AVATAR = 58 // 1px stroke + 8px padding + 40px face + 8px padding + 1px stroke
const DEFAULT_AUTO_OPEN_MS = 45_000

type Point = { x: number; y: number }
type Saved = { seen: boolean; pos: Point | null }

export type WalkthroughProps<P extends string> = {
  // The steps to show, in order.
  steps: WalkthroughStep<P>[]
  // Keeps the reviewer's place between visits. Use a key per project so the two never share state.
  storageKey: string
  // Opens a place in the host app. The host closes any open dialog here, so nothing sits under the guide.
  onShowPlace?: (id: P) => void
  // The face in the circle.
  avatarSrc: string
  // The small GIF that sits inline in text wherever {inline-gif} appears.
  inlineGifSrc?: string
  // The element the face starts above on landing (for example a sidebar button), by selector or by
  // a function. Without it, the face starts at the CSS default position.
  anchorSelector?: string | (() => Element | null)
  // Gap between the face and that anchor, in px.
  anchorGap?: number
  // Put the face's left edge on the anchor's left edge too.
  anchorAlignLeft?: boolean
  // If the face is not touched within this time, the guide opens on its own. 0 turns this off.
  autoOpenMs?: number
}

function load(storageKey: string): Saved {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as Partial<Saved> | null
    const pos = saved?.pos && typeof saved.pos.x === 'number' && typeof saved.pos.y === 'number' ? saved.pos : null
    return { seen: saved?.seen === true, pos }
  } catch {
    return { seen: false, pos: null }
  }
}

function save(storageKey: string, value: Saved) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    // Without storage the guide still works; it just won't remember.
  }
}

const timeOfDay = () => {
  const hour = new Date().getHours()
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
}

// {inline-gif} marks where the small GIF sits inside the text.
const withInlineGif = (text: string, src?: string) =>
  text.split('{inline-gif}').map((part, i, all) => (
    <Fragment key={i}>
      {part}
      {src && i < all.length - 1 && <img className="walkthrough-inline-gif" src={src} alt="" draggable={false} />}
    </Fragment>
  ))

// Plain text with [label](url) links; {timeOfDay} becomes morning, afternoon or evening.
// A link starting with image: opens that image in the lightbox instead of leaving the page.
function RichText({ text, onImage, inlineGifSrc }: { text: string; onImage: (src: string) => void; inlineGifSrc?: string }) {
  const parts: Array<string | { label: string; href: string }> = []
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)/g
  const source = text.replace('{timeOfDay}', timeOfDay())
  let last = 0
  for (const m of source.matchAll(pattern)) {
    parts.push(source.slice(last, m.index), { label: m[1].trim(), href: m[2] })
    last = m.index + m[0].length
  }
  parts.push(source.slice(last))
  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === 'string') return <Fragment key={i}>{withInlineGif(p, inlineGifSrc)}</Fragment>
        if (p.href.startsWith('image:')) {
          return (
            <button key={i} type="button" className="walkthrough-link" onClick={() => onImage(p.href.slice('image:'.length))}>
              {p.label}
            </button>
          )
        }
        return (
          <a key={i} href={p.href} target="_blank" rel="noreferrer">
            {p.label}
          </a>
        )
      })}
    </>
  )
}

// Paragraphs stay paragraphs; neighbouring bullets share one list, each with its 16px icon.
function Blocks({ blocks, onImage, inlineGifSrc }: { blocks: WalkthroughBlock[]; onImage: (src: string) => void; inlineGifSrc?: string }) {
  const groups: Array<{ list: boolean; items: WalkthroughBlock[] }> = []
  for (const b of blocks) {
    // Bullets (with an icon) share one list; paragraphs and photos stand on their own.
    const list = typeof b !== 'string' && 'icon' in b
    const tail = groups[groups.length - 1]
    if (tail && tail.list === list && list) tail.items.push(b)
    else groups.push({ list, items: [b] })
  }
  return (
    <>
      {groups.map((g, gi) =>
        g.list ? (
          <ul className="walkthrough-list" key={gi}>
            {g.items.map((b, i) => {
              const { icon: Icon, text } = b as Extract<WalkthroughBlock, { icon: unknown }>
              return (
                <li key={i}>
                  <Icon className="walkthrough-bullet" size={16} aria-hidden="true" />
                  <span>
                    <RichText text={text} onImage={onImage} inlineGifSrc={inlineGifSrc} />
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          g.items.map((b) =>
            typeof b !== 'string' && 'photo' in b ? (
              <img key={b.photo} className="walkthrough-photo" src={b.photo} alt={b.alt} draggable={false} />
            ) : (
              <p key={b as string}>
                <RichText text={b as string} onImage={onImage} inlineGifSrc={inlineGifSrc} />
              </p>
            ),
          )
        ),
      )}
    </>
  )
}

export function Walkthrough<P extends string>({
  steps,
  storageKey,
  onShowPlace,
  avatarSrc,
  inlineGifSrc,
  anchorSelector,
  anchorGap = 32,
  anchorAlignLeft = false,
  autoOpenMs = DEFAULT_AUTO_OPEN_MS,
}: WalkthroughProps<P>) {
  const [initial] = useState(() => load(storageKey))
  const [seen, setSeen] = useState(initial.seen)
  // Every page load starts the guide on its first step.
  const [step, setStep] = useState(0)
  // Where the circle was dragged to. Null until then, so it keeps its default spot.
  const [pos, setPos] = useState<Point | null>(() => (initial.pos ? clampToWindow(initial.pos) : null))
  // The images open in the lightbox, and which one is showing.
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null)
  // First visit: open once on the first step. After that the guide stays closed.
  const [open, setOpen] = useState(!initial.seen)
  // Which side of the circle the card sits on, and how tall it may be there.
  const [layout, setLayout] = useState<{ below: boolean; alignRight: boolean; maxHeight: number }>({ below: false, alignRight: false, maxHeight: 480 })
  // Where the face starts on landing, when an anchor is given.
  const [anchorPos, setAnchorPos] = useState<{ top: number; left: number | null } | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  // The scrolling text of the current step, which starts again at the top on every step.
  const scrollRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)
  // Any press on the face counts as the reviewer finding it, so the automatic opening is cancelled.
  const touchedFace = useRef(false)
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null)
  const justDragged = useRef(false)

  useEffect(() => save(storageKey, { seen, pos }), [storageKey, seen, pos])

  useEffect(() => {
    if (!autoOpenMs) return
    const timer = window.setTimeout(() => {
      if (!touchedFace.current) setOpen(true)
    }, autoOpenMs)
    return () => window.clearTimeout(timer)
  }, [autoOpenMs])

  // Opening counts as seeing it, so the hint goes away and it won't auto-open again.
  useEffect(() => {
    if (open) setSeen(true)
  }, [open])

  // Keep the default spot tied to the anchor, so it stays put as the window changes size.
  useLayoutEffect(() => {
    if (!anchorSelector) return
    const place = () => {
      const anchor = typeof anchorSelector === 'string' ? document.querySelector<HTMLElement>(anchorSelector) : anchorSelector()
      if (!anchor) return
      const r = anchor.getBoundingClientRect()
      const next = { top: r.top - anchorGap - AVATAR, left: anchorAlignLeft ? r.left : null }
      // Only update when the position really changed, so this cannot loop.
      setAnchorPos((prev) => (prev && prev.top === next.top && prev.left === next.left ? prev : next))
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchorSelector, anchorGap, anchorAlignLeft])

  // A smaller window can leave the circle out of view; pull it back in.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampToWindow(p) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Put the card on whichever side of the circle has more room, and cap its height to fit.
  const place_ = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const r = root.getBoundingClientRect()
    const above = r.top - GAP - MARGIN
    const below = window.innerHeight - r.bottom - GAP - MARGIN
    const isBelow = below > above
    setLayout({
      below: isBelow,
      alignRight: r.left + CARD_WIDTH > window.innerWidth - MARGIN,
      maxHeight: Math.max(220, Math.min(isBelow ? below : above, 640)),
    })
  }, [])
  useLayoutEffect(() => {
    if (open) place_()
  }, [open, pos, place_])
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', place_)
    return () => window.removeEventListener('resize', place_)
  }, [open, place_])

  const close = useCallback(() => {
    setOpen(false)
    avatarRef.current?.focus()
  }, [])

  const last = steps.length - 1
  const goTo = useCallback(
    (i: number) => {
      setStep(Math.min(Math.max(i, 0), last))
    },
    [last],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      // Arrow keys step through the guide unless the person is typing somewhere.
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'ArrowRight') goTo(step + 1)
      if (e.key === 'ArrowLeft') goTo(step - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close, goTo, step])

  // Dragging the circle moves the card with it. A small movement still counts as a click.
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    touchedFace.current = true
    if (e.button !== 0 || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    drag.current = { startX: e.clientX, startY: e.clientY, originX: rect.left, originY: rect.top, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    setPos(clampToWindow({ x: d.originX + dx, y: d.originY + dy }))
  }
  const onPointerUp = () => {
    if (drag.current?.moved) justDragged.current = true
    drag.current = null
  }
  const onAvatarClick = () => {
    touchedFace.current = true
    if (justDragged.current) {
      justDragged.current = false
      return
    }
    if (open) close()
    else setOpen(true)
  }

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [step])

  const current = steps[step]

  // Every image link in the current step, so the lightbox arrows can move between them.
  const openImage = (src: string) => {
    const found = imagesIn(current.body)
    const images = found.includes(src) ? found : [...found, src]
    setLightbox({ images, index: images.indexOf(src) })
  }

  return (
    <div
      className="walkthrough"
      ref={rootRef}
      style={
        pos
          ? { left: pos.x, top: pos.y, bottom: 'auto' }
          : anchorPos
            ? { top: anchorPos.top, bottom: 'auto', ...(anchorPos.left !== null ? { left: anchorPos.left } : {}) }
            : undefined
      }
    >
      {open && (
        <div
          className="walkthrough-panel"
          role="dialog"
          aria-label="Designer’s walkthrough"
          data-below={layout.below}
          data-align={layout.alignRight ? 'right' : 'left'}
          style={{ maxHeight: layout.maxHeight }}
        >
          <div className="walkthrough-top">
            <ol className="walkthrough-steps" aria-label="Steps">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <button
                    type="button"
                    className="walkthrough-dash"
                    data-active={i === step ? 'true' : 'false'}
                    aria-label={`Step ${i + 1}: ${s.title}`}
                    aria-current={i === step ? 'step' : undefined}
                    onClick={() => goTo(i)}
                  />
                </li>
              ))}
            </ol>
            <Button variant="ghost" size="icon-sm" aria-label="Close walkthrough" onClick={close}>
              <X />
            </Button>
          </div>

          <h2 className="walkthrough-title">{current.title}</h2>

          <div className="walkthrough-scroll" ref={scrollRef} aria-live="polite">
            <div className="walkthrough-body">
              <Blocks blocks={current.body} onImage={openImage} inlineGifSrc={inlineGifSrc} />
            </div>

            {current.places && onShowPlace && (
              <div className="walkthrough-places">
                <div className="walkthrough-places-label">Where to see it</div>
                <div className="walkthrough-chips">
                  {current.places.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant="outline"
                      className="rounded-full px-3 text-[15px]"
                      onClick={() => onShowPlace(p.id)}
                    >
                      {p.label}
                      <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="walkthrough-actions">
            <Button variant="ghost" size="lg" className="text-[15px]" disabled={step === 0} onClick={() => goTo(step - 1)}>
              Back
            </Button>
            <Button size="lg" className="text-[15px]" onClick={() => goTo(step === last ? 0 : step + 1)}>
              {step === last ? (
                <>
                  Start over
                  <RotateCcw data-icon="inline-end" aria-hidden="true" />
                </>
              ) : (
                'Next'
              )}
            </Button>
          </div>
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onIndex={(index) => setLightbox((l) => (l ? { ...l, index } : l))}
          onClose={() => setLightbox(null)}
        />
      )}

      <div className="walkthrough-anchor">
        <button
          type="button"
          ref={avatarRef}
          className="walkthrough-avatar"
          aria-label={open ? 'Close the designer’s walkthrough' : 'Open the designer’s walkthrough'}
          aria-expanded={open}
          title="Drag to move"
          // While the guide is closed, a rainbow stroke draws attention to the face. It stops while the guide is open.
          data-attention={open ? 'false' : 'true'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onAvatarClick}
        >
          <img src={avatarSrc} alt="" draggable={false} />
        </button>
        {!seen && !open && <span className="walkthrough-hint">Walk me through it</span>}
      </div>
    </div>
  )
}

// The image links in a step's text, in order.
function imagesIn(blocks: WalkthroughBlock[]): string[] {
  const texts = blocks.map((b) => (typeof b === 'string' ? b : 'text' in b ? b.text : ''))
  return texts.flatMap((t) => [...t.matchAll(/\[[^\]]+\]\(image:([^)\s]+)\)/g)].map((m) => m[1]))
}

function clampToWindow({ x, y }: Point): Point {
  return {
    x: Math.min(Math.max(x, MARGIN), Math.max(MARGIN, window.innerWidth - AVATAR - MARGIN)),
    y: Math.min(Math.max(y, MARGIN), Math.max(MARGIN, window.innerHeight - AVATAR - MARGIN)),
  }
}
