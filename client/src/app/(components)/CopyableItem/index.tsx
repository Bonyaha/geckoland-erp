// client/src/app/(components)/CopyableItem/index.tsx
'use client'

import React from 'react'

export interface CopyableItemProps {
  value: string
  displayValue?: string
  className?: string
  align?: 'left' | 'center' | 'right'
  onCopy?: (value: string) => void
  popoverText?: string
}

const CopyableItem = ({
  value,
  displayValue,
  className = '',
  align = 'center',
  onCopy,
  popoverText = 'Натисніть, щоб скопіювати',
}: CopyableItemProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    // Copy to clipboard
    navigator.clipboard.writeText(value)

    // Call optional callback
    if (onCopy) {
      onCopy(value)
    }
  }

  // Determine positioning based on alignment
  const positionClasses = {
    left: 'left-0 origin-left', // Anchors to left, grows right
    center: 'left-1/2 -translate-x-1/2 origin-center', // Perfectly centered
    right: 'right-0 origin-right', // Anchors to right, grows left
  }

  return (
    <div className='relative group inline-block'>
      {/* Visible Text */}
      <div
        onClick={handleClick}
        className={`cursor-pointer transition-colors group-hover:text-transparent ${className}`}
      >
        {displayValue || value}
      </div>

      {/* Popover */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 ${positionClasses[align]} opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 min-w-max`}
      >
        <div className='bg-white border border-green-200 rounded-xl px-4 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center whitespace-nowrap'>
          <span className='text-green-600 font-bold text-lg leading-tight'>
            {value}
          </span>
          <span className='text-gray-400 text-[10px] font-medium mt-0.5 uppercase tracking-wide'>
            {popoverText}
          </span>
        </div>
      </div>
    </div>
  )
}

export default CopyableItem
