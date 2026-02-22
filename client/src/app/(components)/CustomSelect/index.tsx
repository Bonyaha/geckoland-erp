// client/src/app/(components)/CustomSelect.tsx

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react'
import { Check, ChevronDown, LucideIcon } from 'lucide-react'
import { Fragment } from 'react'

interface Option {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: any) => void
  options: Option[]
  className?: string
  isMinimal?: boolean
  Icon?: LucideIcon
}

const CustomSelect = ({
  value,
  onChange,
  options,
  className,
  isMinimal = false,
}: CustomSelectProps) => {
  const selectedOption =
    options.find((opt) => opt.value === value) || options[0]

  return (
    <div className={`relative ${className}`}>
      <Listbox value={value} onChange={onChange}>
        <ListboxButton
          className={`
            relative w-full cursor-pointer text-left focus:outline-none transition-all flex items-center gap-1
            ${
              isMinimal
                ? 'bg-transparent border-none shadow-none p-0 focus:ring-0 text-inherit font-bold rounded-full'
                : 'rounded-lg border border-gray-300 bg-white py-3 pl-4 pr-10 focus:ring-2 focus:ring-blue-500 text-base'
            }
          `}
        >
          <span className='block truncate'>{selectedOption.label}</span>
          <ChevronDown
            className={`${isMinimal ? 'h-3 w-3' : 'h-5 w-5 text-gray-400'}`}
            aria-hidden='true'
          />
        </ListboxButton>

        <Transition
          as={Fragment}
          leave='transition ease-in duration-100'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <ListboxOptions className='absolute mt-1 max-h-60 min-w-[180px] w-max overflow-auto rounded-md bg-white py-1 text-base shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-[100] left-0'>
            {options.map((option) => (
              <ListboxOption
                key={option.value}
                className={({ focus }) =>
                  `relative cursor-pointer select-none py-2.5 pl-10 pr-4 ${
                    focus ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                  }`
                }
                value={option.value}
              >
                {({ selected }) => (
                  <>
                    <span
                      className={`block truncate ${selected ? 'font-bold text-blue-600' : 'font-normal'}`}
                    >
                      {option.label}
                    </span>
                    {selected ? (
                      <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600'>
                        <Check className='h-4 w-4' aria-hidden='true' />
                      </span>
                    ) : null}
                  </>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Transition>
      </Listbox>
    </div>
  )
}

export default CustomSelect
