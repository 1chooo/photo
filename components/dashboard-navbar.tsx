'use client'

import cn from 'clsx'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import type { User } from 'firebase/auth'

function Item(props: React.ComponentProps<typeof Link>) {
  const pathname = usePathname()
  const href = props.href

  if (typeof href !== 'string') {
    throw new Error('`href` must be a string')
  }

  const isActive = pathname === href || pathname.startsWith(href + '/dashboard/')

  return (
    <li
      className={cn(
        isActive
          ? 'text-rurikon-800'
          : 'text-rurikon-300 hover:text-rurikon-600',
        'transition-colors hover:transform-none',
        '-mx-2'
      )}
    >
      <Link
        {...props}
        className='inline-block w-full px-2 focus-visible:outline focus-visible:outline-rurikon-400
        focus-visible:rounded-xs 
        focus-visible:outline-dotted
        focus-visible:text-rurikon-600'
        draggable={false}
      />
    </li>
  )
}

interface DashboardNavbarProps {
  user: User | null
  handleSignOut: () => void
}

export default function DashboardNavbar({ user, handleSignOut }: DashboardNavbarProps) {
  return (
    <nav className='mobile:mr-6 sm:mr-10 md:mr-14 w-full mobile:w-16 mobile:h-screen mobile:flex mobile:flex-col'>
      <ul className='lowercase text-right mobile:sticky top-6 sm:top-10 md:top-14 mb-6 mobile:mb-0 flex gap-2 justify-end mobile:block mobile:flex-1'>
        <Item href='/'>Lin Hugo</Item>
        <Item href='/dashboard'>Admin</Item>
        <Item href='/dashboard/photos'>Photo</Item>
        <Item href='/dashboard/homepage'>Homepage</Item>
      </ul>
      <div className='hidden mobile:block mobile:sticky bottom-6 sm:bottom-10 md:bottom-14 pt-6 border-t border-rurikon-100 text-right'>
        <div className="text-xs text-rurikon-300 mb-2 lowercase">signed in as</div>
        <div className="text-sm font-medium truncate text-rurikon-600 mb-4" title={user?.email || ''}>
          {user?.email}
        </div>
        <button
          onClick={handleSignOut}
          className="w-full px-2 py-1 text-rurikon-600 hover:text-rurikon-800 hover:bg-rurikon-50 rounded-lg transition-colors font-medium text-sm lowercase text-right"
        >
          sign out
        </button>
      </div>
    </nav>
  )
}
