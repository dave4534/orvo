import { Google_Sans, Google_Sans_Code } from "next/font/google"

import "../tailwind.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils";

// Both are variable fonts, so the full weight range loads by default (Google Sans covers 400 to 700).
const googleSans = Google_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  adjustFontFallback: false,
})

const fontMono = Google_Sans_Code({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  adjustFontFallback: false,
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", googleSans.variable)}
    >
      <body>
        <ThemeProvider defaultTheme="light" enableSystem={false}>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="bottom-left" />
        </ThemeProvider>
      </body>
    </html>
  )
}
