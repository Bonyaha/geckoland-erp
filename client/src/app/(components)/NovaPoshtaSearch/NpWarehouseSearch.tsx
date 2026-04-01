// client/src/app/(components)/NpWarehouseSearch.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Loader2, ChevronDown } from 'lucide-react'
import {
  useNpWarehouseSearch,
  type NpWarehouse,
} from '@/hooks/useNovaPoshtaAutocomplete'

interface NpWarehouseSearchProps {
  cityRef: string // DeliveryCity ref from selected city
  value: string // display value
  onChange: (displayValue: string) => void
  onSelect: (warehouse: NpWarehouse) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function NpWarehouseSearch({
  cityRef,
  value,
  onChange,
  onSelect,
  placeholder = 'Відділення або поштомат',
  className = '',
  disabled = false,
}: NpWarehouseSearchProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { warehouses, loading } = useNpWarehouseSearch(cityRef, value)

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

  const handleSelect = (w: NpWarehouse) => {
    onChange(w.Description)
    onSelect(w)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center border rounded-lg px-3 py-2 transition-all ${
          open ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300'
        } ${disabled || !cityRef ? 'bg-gray-50' : 'bg-white'}`}
      >
        <Search size={15} className='text-gray-400 mr-2 shrink-0' />
        <input
          type='text'
          value={value}
          disabled={disabled || !cityRef}
          placeholder={!cityRef ? 'Спочатку оберіть місто' : placeholder}
          className='w-full outline-none text-sm text-gray-700 bg-transparent disabled:cursor-not-allowed'
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (cityRef) setOpen(true)
          }}
        />
        {loading ? (
          <Loader2 size={15} className='text-blue-500 animate-spin shrink-0' />
        ) : (
          <ChevronDown size={15} className='text-gray-400 shrink-0' />
        )}
      </div>

      {open && cityRef && warehouses.length > 0 && (
        <div className='absolute z-[200] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-y-auto'>
          {warehouses.map((w) => (
            <button
              key={w.Ref}
              type='button'
              onClick={() => handleSelect(w)}
              className='w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors'
            >
              <p className='text-sm font-medium text-gray-900 leading-tight'>
                {w.Description}
              </p>
              {w.CategoryOfWarehouse === 'Postomat' && (
                <span className='inline-block mt-1 text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium'>
                  Поштомат
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && cityRef && !loading && warehouses.length === 0 && (
        <div className='absolute z-[200] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl px-4 py-3 text-sm text-gray-500 text-center'>
          Відділень не знайдено
        </div>
      )}
    </div>
  )
}
