'use client'

import React from 'react'

export default function NotFound() {
  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-50'>
      <div className='text-center'>
        <h1 className='inline text-2xl font-bold mr-2'>404</h1>
        <span className='inline text-xl'>| This page could not be found.</span>
      </div>
    </div>
  )
}
