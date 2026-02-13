// client/src/app/hide/page.tsx
'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

const HidePage = () => {
  const router = useRouter()

  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-50'>
      <div className='text-center'>
        <h1 className='text-3xl font-bold text-gray-900 mb-4'>
          Сайдбар приховано
        </h1>
        <p className='text-gray-600 mb-6'>
          Ця сторінка показує, що сайдбар приховано
        </p>
        <button
          onClick={() => router.back()}
          className='flex items-center gap-2 px-6 py-3 bg-[#45455c] text-white rounded-lg hover:bg-[#5a5a70] transition-colors mx-auto'
        >
          <ArrowRight className='w-5 h-5' />
          <span>Повернутися назад</span>
        </button>
      </div>
    </div>
  )
}

export default HidePage
