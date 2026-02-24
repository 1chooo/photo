import { ViewTransition } from 'react'
import { Analytics } from '@vercel/analytics/next'

import Navbar from '@/components/layout/navbar'

export default function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <div className="fixed sm:hidden h-6 sm:h-10 md:h-14 w-full top-0 left-0 z-30 pointer-events-none content-fade-out" />
      <div className="flex flex-col mobile:flex-row">
        <Navbar />
        <main className="relative flex-1 contain-[inline-size]">
          <div className="absolute w-full h-px opacity-50 bg-rurikon-border right-0 mobile:right-auto mobile:left-0 mobile:w-px mobile:h-full mobile:opacity-100 mix-blend-multiply" />
          <ViewTransition name="crossfade">
            <article className="pl-0 pt-6 mobile:pt-0 mobile:pl-6 sm:pl-10 md:pl-14">
              {children}
            </article>
          </ViewTransition>
        </main>
      </div>
      <Analytics />
    </>
  )
}
