'use client'

import React, { useState } from 'react'
import Header from '@/app/(components)/Header'
import {
  useGetRozetkaStoreStatusQuery,
  useSetRozetkaStoreStatusMutation,
  useSyncAllQuantitiesToRozetkaMutation,
} from '@/state/api'
import { useToast } from '@/hooks/useToast'
import Toast from '@/app/(components)/Toast'

type UserSetting = {
  label: string
  value: string | boolean
  type: 'text' | 'toggle'
}

const mockSettings: UserSetting[] = [
  { label: 'Username', value: 'john_doe', type: 'text' },
  { label: 'Email', value: 'john.doe@example.com', type: 'text' },
  { label: 'Notification', value: true, type: 'toggle' },
  { label: 'Dark Mode', value: false, type: 'toggle' },
  { label: 'Language', value: 'English', type: 'text' },
]

const Settings = () => {
  const [userSettings, setUserSettings] = useState<UserSetting[]>(mockSettings)

  const { data: rozetkaStatusData, isLoading: isStatusLoading } =
    useGetRozetkaStoreStatusQuery()
  const [setRozetkaStoreStatus, { isLoading: isToggling }] =
    useSetRozetkaStoreStatusMutation()
  const [syncAllQuantitiesToRozetka, { isLoading: isSyncing }] =
    useSyncAllQuantitiesToRozetkaMutation()

  const { toast, showToast, hideToast } = useToast()

  const rozetkaActive = rozetkaStatusData?.rozetkaStoreActive ?? true

  const handleToggleChange = (index: number) => {
    const settingsCopy = [...userSettings]
    settingsCopy[index].value = !settingsCopy[index].value as boolean
    setUserSettings(settingsCopy)
  }

  const handleRozetkaToggle = async () => {
    try {
      await setRozetkaStoreStatus({ active: !rozetkaActive }).unwrap()
      showToast(
        !rozetkaActive
          ? 'Магазин Rozetka активовано. Синхронізація відновлена.'
          : 'Магазин Rozetka призупинено. Синхронізацію вимкнено.',
        !rozetkaActive ? 'success' : 'warning',
      )
    } catch {
      showToast('Помилка при зміні статусу магазину', 'error')
    }
  }

  const handleRozetkaSync = async () => {
    try {
      const result = await syncAllQuantitiesToRozetka().unwrap()
      showToast(
        `Синхронізовано ${result.updated} товарів на Rozetka`,
        'success',
      )
    } catch {
      showToast('Помилка при синхронізації з Rozetka', 'error')
    }
  }

  return (
    <div className='w-full'>
      <Header name='Налаштування' />

      {/* ── Marketplace Settings ── */}
      <h2 className='mt-8 mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-gray-500'>
        Маркетплейси
      </h2>
      <div className='overflow-x-auto shadow-md'>
        <table className='min-w-full bg-white rounded-lg'>
          <thead className='bg-gray-800 text-white'>
            <tr>
              <th className='text-left py-3 px-4 uppercase font-semibold text-sm'>
                Налаштування
              </th>
              <th className='text-left py-3 px-4 uppercase font-semibold text-sm'>
                Значення
              </th>
              <th className='text-left py-3 px-4 uppercase font-semibold text-sm'>
                Дії
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className='hover:bg-blue-50 border-b'>
              <td className='py-4 px-4'>
                <div className='font-medium text-gray-800'>
                  {rozetkaActive
                    ? 'Магазин Rozetka активний'
                    : 'Магазин Rozetka призупинений'}
                </div>
                <div className='text-sm text-gray-500 mt-0.5'>
                  {rozetkaActive
                    ? 'Вимкніть під час відпустки або призупинення магазину. Синхронізацію кількості товарів буде пропущено.'
                    : 'Магазин призупинено. Синхронізація кількості товарів на Rozetka вимкнена. Після повернення активуйте магазин та натисніть «Синхронізувати кількості».'}
                </div>
              </td>
              <td className='py-4 px-4'>
                <div className='flex items-center gap-2'>
                  {isStatusLoading ? (
                    <div className='w-11 h-6 bg-gray-200 rounded-full animate-pulse' />
                  ) : (
                    <label className='inline-flex relative items-center cursor-pointer'>
                      <input
                        type='checkbox'
                        className='sr-only peer'
                        checked={rozetkaActive}
                        onChange={handleRozetkaToggle}
                        disabled={isToggling}
                      />
                      <div
                        className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-blue-400 peer-focus:ring-4
                        transition peer-checked:after:translate-x-full peer-checked:after:border-white
                        after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white
                        after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all
                        peer-checked:bg-blue-600 disabled:opacity-50"
                      />
                    </label>
                  )}
                  <span
                    className={`text-sm font-medium ${
                      rozetkaActive ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {isStatusLoading
                      ? '...'
                      : rozetkaActive
                        ? 'Активний'
                        : 'Призупинений'}
                  </span>
                </div>
              </td>
              <td className='py-4 px-4'>
                {rozetkaActive && (
                  <button
                    onClick={handleRozetkaSync}
                    disabled={isSyncing || isStatusLoading}
                    className='px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg
                      hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                  >
                    {isSyncing
                      ? 'Синхронізація...'
                      : 'Синхронізувати кількості'}
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── User Settings ── */}
      <h2 className='mt-8 mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-gray-500'>
        Користувач
      </h2>
      <div className='overflow-x-auto shadow-md'>
        <table className='min-w-full bg-white rounded-lg'>
          <thead className='bg-gray-800 text-white'>
            <tr>
              <th className='text-left py-3 px-4 uppercase font-semibold text-sm'>
                Setting
              </th>
              <th className='text-left py-3 px-4 uppercase font-semibold text-sm'>
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {userSettings.map((setting, index) => (
              <tr className='hover:bg-blue-50' key={setting.label}>
                <td className='py-2 px-4'>{setting.label}</td>
                <td className='py-2 px-4'>
                  {setting.type === 'toggle' ? (
                    <label className='inline-flex relative items-center cursor-pointer'>
                      <input
                        type='checkbox'
                        className='sr-only peer'
                        checked={setting.value as boolean}
                        onChange={() => handleToggleChange(index)}
                      />
                      <div
                        className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-blue-400 peer-focus:ring-4 
                        transition peer-checked:after:translate-x-full peer-checked:after:border-white 
                        after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white 
                        after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all
                        peer-checked:bg-blue-600"
                      ></div>
                    </label>
                  ) : (
                    <input
                      type='text'
                      className='px-4 py-2 border rounded-lg text-gray-500 focus:outline-none focus:border-blue-500'
                      value={setting.value as string}
                      onChange={(e) => {
                        const settingsCopy = [...userSettings]
                        settingsCopy[index].value = e.target.value
                        setUserSettings(settingsCopy)
                      }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  )
}

export default Settings
