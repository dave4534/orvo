import type { LucideIcon } from 'lucide-react'

// A paragraph is a string. A bullet is an icon with its text (the icon is 16px).
// A photo is an image shown on its own line, 50px square, with 32px above it under the header.
export type WalkthroughBlock = string | { icon: LucideIcon; text: string } | { photo: string; alt: string }

// A chip opens a place in the host app. `P` is the host's own list of place ids.
export type WalkthroughPlace<P extends string = string> = { id: P; label: string }

export type WalkthroughStep<P extends string = string> = {
  title: string
  body: WalkthroughBlock[]
  places?: WalkthroughPlace<P>[]
}
