// client/src/app/products/SalesDatePickerModal.tsx
'use client'

import React, { useState } from 'react'
import { X } from 'lucide-react'

type SalesDatePickerModalProps = {
  isOpen: boolean
  onClose: () => void
  onDateSelect: (date: Date) => void
  productName: string
  currentSalesCount: number
}

const SalesDatePickerModal = ({
  isOpen,
  onClose,
  onDateSelect,
  productName,
  currentSalesCount,
}: SalesDatePickerModalProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())

  if (!isOpen) return null

  // Calendar logic
  const monthNames = [
    'січень',
    'лютий',
    'березень',
    'квітень',
    'травень',
    'червень',
    'липень',
    'серпень',
    'вересень',
    'жовтень',
    'листопад',
    'грудень',
  ]

  const dayNames = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд']

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    // Convert Sunday (0) to 7 for Monday-first week
    return firstDay === 0 ? 6 : firstDay - 1
  }

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const days: (number | null)[] = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }

    return days
  }

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    )
  }

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    )
  }

  const handleDayClick = (day: number) => {
    const newDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    )
    setSelectedDate(newDate)
  }

  const handleConfirm = () => {
    onDateSelect(selectedDate)
    onClose()
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    )
  }

  const isSelected = (day: number) => {
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    )
  }

  const calendarDays = generateCalendarDays()

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden'>
        {/* Header */}
        <div className='bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex justify-between items-center'>
          <div>
            <h2 className='text-xl font-bold text-white'>
              Відобразити продажі з
            </h2>
            <p className='text-blue-100 text-sm mt-1 truncate max-w-[300px]'>
              {productName}
            </p>
          </div>
          <button
            onClick={onClose}
            className='text-white hover:bg-white/20 rounded-full p-2 transition-colors'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Current Sales Info */}
        <div className='px-6 py-4 bg-green-50 border-b border-green-100'>
          <div className='text-center'>
            <span className='text-sm text-gray-600'>Кількість</span>
            <div className='text-3xl font-bold text-green-600 mt-1'>
              {currentSalesCount}
            </div>
            <span className='text-xs text-gray-500'>продажів</span>
          </div>
        </div>

        {/* Selected Date Display */}
        <div className='px-6 py-3 bg-gray-50 border-b border-gray-200'>
          <input
            type='text'
            value={selectedDate.toLocaleDateString('uk-UA', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
            readOnly
            className='w-full px-4 py-2 border border-gray-300 rounded-lg text-center font-medium text-gray-700 bg-white'
          />
        </div>

        {/* Calendar */}
        <div className='px-6 py-4'>
          {/* Month/Year Header */}
          <div className='flex items-center justify-between mb-4'>
            <button
              onClick={handlePrevMonth}
              className='p-2 hover:bg-gray-100 rounded-lg transition-colors'
            >
              <svg
                className='w-5 h-5 text-gray-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M15 19l-7-7 7-7'
                />
              </svg>
            </button>

            <h3 className='text-lg font-semibold text-gray-800'>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>

            <button
              onClick={handleNextMonth}
              className='p-2 hover:bg-gray-100 rounded-lg transition-colors'
            >
              <svg
                className='w-5 h-5 text-gray-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 5l7 7-7 7'
                />
              </svg>
            </button>
          </div>

          {/* Day Names */}
          <div className='grid grid-cols-7 gap-1 mb-2'>
            {dayNames.map((day) => (
              <div
                key={day}
                className='text-center text-xs font-semibold text-gray-500 py-2'
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className='grid grid-cols-7 gap-1'>
            {calendarDays.map((day, index) => (
              <div key={index} className='aspect-square'>
                {day ? (
                  <button
                    onClick={() => handleDayClick(day)}
                    className={`w-full h-full flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                      isSelected(day)
                        ? 'bg-blue-500 text-white shadow-lg scale-105'
                        : isToday(day)
                        ? 'bg-blue-100 text-blue-600 font-bold'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {day}
                  </button>
                ) : (
                  <div className='w-full h-full' />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className='px-6 py-4 bg-gray-50 flex gap-3 border-t border-gray-200'>
          <button
            onClick={onClose}
            className='flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors'
          >
            Закрити
          </button>
          <button
            onClick={handleConfirm}
            className='flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors shadow-md'
          >
            Підтвердити
          </button>
        </div>
      </div>
    </div>
  )
}

export default SalesDatePickerModal
