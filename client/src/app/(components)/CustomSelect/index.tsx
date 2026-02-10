import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react'
import { Check, ChevronDown } from 'lucide-react'
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
}

const CustomSelect = ({
  value,
  onChange,
  options,
  className,
}: CustomSelectProps) => {
  const selectedOption =
    options.find((opt) => opt.value === value) || options[0]

  return (
    // Wrapper remains without w-full to allow OrdersPage to control width
    <div className={`relative ${className}`}>
      <Listbox value={value} onChange={onChange}>
        {/* Changed from Listbox.Button to ListboxButton */}
        <ListboxButton className='relative w-full cursor-pointer rounded-lg border border-gray-300 bg-white py-3 pl-4 pr-10 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 text-base'>
          <span className='block truncate'>{selectedOption.label}</span>
          <span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
            <ChevronDown className='h-5 w-5 text-gray-400' aria-hidden='true' />
          </span>
        </ListboxButton>

        <Transition
          as={Fragment}
          leave='transition ease-in duration-100'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          {/* Changed from Listbox.Options to ListboxOptions */}
          <ListboxOptions className='absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50'>
            {options.map((option) => (
              /* Changed from Listbox.Option to ListboxOption */
              <ListboxOption
                key={option.value}
                className={({ focus }) =>
                  `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                    focus ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                  }`
                }
                value={option.value}
              >
                {({ selected }) => (
                  <>
                    <span
                      className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}
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
