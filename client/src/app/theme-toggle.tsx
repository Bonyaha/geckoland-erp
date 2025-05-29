'use client'

import { Moon, Sun } from 'lucide-react'

import { useTheme } from 'next-themes'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
console.log(`theme: ${theme}`)
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      <Sun
        className='cursor-pointer text-gray-500 dark:hidden'
        size={24}
      />

      <Moon
        className='cursor-pointer text-gray-500 hidden dark:block'
        size={24}
      />
    </button>
  )
}
