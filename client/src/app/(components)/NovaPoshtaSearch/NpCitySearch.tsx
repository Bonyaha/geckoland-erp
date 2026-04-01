// client/src/app/(components)/NpCitySearch.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Loader2, ChevronDown } from 'lucide-react'
import { useNpCitySearch, type NpCity } from '@/hooks/useNovaPoshtaAutocomplete'

interface NpCitySearchProps {
  value: string // display value in the input
  onChange: (displayValue: string) => void // called when user types
  onSelect: (city: NpCity) => void // called when city chosen from list
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function NpCitySearch({
  value,
  onChange,
  onSelect,
  placeholder = 'Місто доставки',
  className = '',
  disabled = false,
}: NpCitySearchProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { cities, loading } = useNpCitySearch(value)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (city: NpCity) => {
    onChange(city.Present)
    onSelect(city)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center border rounded-lg px-3 py-2 transition-all ${
          open ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300'
        } ${disabled ? 'bg-gray-50' : 'bg-white'}`}
      >
        <Search size={15} className='text-gray-400 mr-2 shrink-0' />
        <input
          type='text'
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          className='w-full outline-none text-sm text-gray-700 bg-transparent'
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          /* Currently, dropdown opens on focus if value.length >= 2. However, if you click outside to close it, and then click back into the input, it might not reopen because it’s already "focused." */
          onFocus={() => {
            if (value.length >= 2) setOpen(true)
          }}
        />
        {loading ? (
          <Loader2 size={15} className='text-blue-500 animate-spin shrink-0' />
        ) : (
          <ChevronDown size={15} className='text-gray-400 shrink-0' />
        )}
      </div>

      {open && cities.length > 0 && (
        <div className='absolute z-[200] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto'>
          {cities.map((city) => (
            <button
              key={city.Ref}
              type='button'
              onClick={() => handleSelect(city)}
              className='w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors'
            >
              <p className='text-sm font-medium text-gray-900'>
                {city.SettlementTypeCode} {city.MainDescription}
              </p>
              {(city.Region || city.Area) && (
                <p className='text-xs text-gray-500 mt-0.5'>
                  {[
                    city.Region && `${city.Region} р-н`,
                    city.Area && `${city.Area} обл.`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
