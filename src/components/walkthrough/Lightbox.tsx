'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Shows one image large over the page. Escape, the X, or a click outside the image closes it.
// It sits above the walkthrough card, and handles Escape first so the card stays open.
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="walkthrough-lightbox" role="dialog" aria-modal="true" aria-label="Image preview" onClick={onClose}>
      <Button
        variant="secondary"
        size="icon-lg"
        className="walkthrough-lightbox-close"
        aria-label="Close image"
        autoFocus
        onClick={onClose}
      >
        <X />
      </Button>
      {missing ? (
        <p className="walkthrough-lightbox-missing" onClick={(e) => e.stopPropagation()}>
          This image hasn’t been added yet.
        </p>
      ) : (
        <img src={src} alt="" onError={() => setMissing(true)} onClick={(e) => e.stopPropagation()} />
      )}
    </div>
  )
}
