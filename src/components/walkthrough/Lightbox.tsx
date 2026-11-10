'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type LightboxProps = {
  images: string[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
}

// Shows one image large over the page, with arrows to move to the previous or next image in the
// same step. Escape or the X closes it; a click outside the image also closes it. While it is open,
// the arrow keys move between images and do not step the guide.
export function Lightbox({ images, index, onIndex, onClose }: LightboxProps) {
  const [missing, setMissing] = useState(false)
  const [natural, setNatural] = useState<number | null>(null)
  // An image link can carry ?zoom=2 to show the picture at twice its natural width.
  const [src, query] = images[index].split('?')
  const zoom = Number(new URLSearchParams(query ?? '').get('zoom')) || 1
  const count = images.length

  useEffect(() => {
    setMissing(false)
    setNatural(null)
  }, [src])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.stopPropagation()
        const next = index + (e.key === 'ArrowRight' ? 1 : -1)
        if (next >= 0 && next < count) onIndex(next)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [count, index, onClose, onIndex])

  return (
    <div className="walkthrough-lightbox" role="dialog" aria-modal="true" aria-label="Image preview" onClick={onClose}>
      <Button variant="secondary" size="icon-lg" className="walkthrough-lightbox-close" aria-label="Close image" autoFocus onClick={onClose}>
        <X />
      </Button>

      {count > 1 && (
        <Button
          variant="secondary"
          size="icon-lg"
          className="walkthrough-lightbox-prev"
          aria-label="Previous image"
          disabled={index === 0}
          onClick={(e) => {
            e.stopPropagation()
            onIndex(index - 1)
          }}
        >
          <ChevronLeft />
        </Button>
      )}

      {count > 1 && (
        <Button
          variant="secondary"
          size="icon-lg"
          className="walkthrough-lightbox-next"
          aria-label="Next image"
          disabled={index === count - 1}
          onClick={(e) => {
            e.stopPropagation()
            onIndex(index + 1)
          }}
        >
          <ChevronRight />
        </Button>
      )}

      {missing ? (
        <p className="walkthrough-lightbox-missing" onClick={(e) => e.stopPropagation()}>
          This image hasn’t been added yet.
        </p>
      ) : (
        <img
          src={src}
          alt=""
          style={zoom > 1 && natural ? { width: natural * zoom, maxWidth: 'none', maxHeight: 'none' } : undefined}
          onLoad={(e) => setNatural(e.currentTarget.naturalWidth)}
          onError={() => setMissing(true)}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  )
}
