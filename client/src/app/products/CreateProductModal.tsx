import React, { ChangeEvent, FormEvent, useState } from 'react'
import { v4 } from 'uuid'
import Header from '@/app/(components)/Header'

type ProductFormData = {
  productId: string
  name: string
  price: number
  stockQuantity: number
  sku: string
  source?: string
  externalIds?: string
  description?: string
  mainImage?: string
  images?: string[]
  inStock: number
  available: boolean
  priceOld?: number
  pricePromo?: number
  updatedPrice?: number
  currency?: string
  sellingType?: string
  presence?: string
  dateModified?: string
  lastSynced?: string
  needsSync?: boolean
  multilangData?: string
  categoryData?: string
  measureUnit?: string
  status?: string
  [key: string]: string | number | boolean | string[] | undefined // Index signature
}

type CreateProductModalProps = {
  isOpen: boolean
  onClose: () => void
  onCreate: (formData: ProductFormData) => void
}

const CreateProductModal = ({
  isOpen,
  onClose,
  onCreate,
}: CreateProductModalProps) => {
  const [formData, setFormData] = useState<ProductFormData>({
    productId: v4(),
    name: '',
    price: 0,
    stockQuantity: 0,
    source: 'prom', // Default from schema
    externalIds: '{}', // Default JSON object
    images: [], // Default empty array
    needsSync: false, // Default from schema
    inStock: 0, // Initialized, will be updated with stockQuantity
    available: false, // Initialized, will be updated with stockQuantity logic
    sku: '', // Ensure sku is always a string
  })

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    setFormData((prev) => {
      const updatedData: ProductFormData = { ...prev }
      if (type === 'checkbox') {
        const target = e.target as HTMLInputElement
        updatedData[name] = target.checked // Now safe with index signature
      } else if (type === 'number') {
        updatedData[name] = parseFloat(value) || 0
      } else {
        updatedData[name] = value
      }
      // Calculate inStock and available based on stockQuantity
      if (name === 'stockQuantity') {
        updatedData.inStock = updatedData.stockQuantity
        updatedData.available = updatedData.stockQuantity > 0
      }
      return updatedData
    })
  }

  const handleArrayChange = (
    e: ChangeEvent<HTMLInputElement>,
    index: number,
    field: 'images'
  ) => {
    const { value } = e.target
    setFormData((prev) => {
      const updatedArray = [...(prev[field] || [])]
      updatedArray[index] = value
      return { ...prev, [field]: updatedArray }
    })
  }

  const addImage = () => {
    setFormData((prev) => ({ ...prev, images: [...(prev.images || []), ''] }))
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const submissionData: ProductFormData = {
      ...formData,
      inStock: formData.stockQuantity, // Ensure inStock matches stockQuantity
      available: formData.stockQuantity > 0, // Ensure availability logic
      externalIds: formData.externalIds || '{}', // Ensure valid JSON
      images: formData.images || [],
      // Parse JSON strings if provided
      categoryData: formData.categoryData
        ? JSON.parse(formData.categoryData)
        : undefined,
      multilangData: formData.multilangData
        ? JSON.parse(formData.multilangData)
        : undefined,
    }
    onCreate(submissionData)
    onClose()
  }

  if (!isOpen) return null

  const labelCssStyles = 'block text-sm font-medium text-gray-700'
  const inputCssStyles =
    'block w-full mb-2 p-2 border-gray-500 border-2 rounded-md'

  return (
    <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-20'>
      <div className='relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white'>
        <Header name='Create New Product' />
        <form onSubmit={handleSubmit} className='mt-5'>
          {/* PRODUCT ID (Read-Only) */}
          <label htmlFor='productId' className={labelCssStyles}>
            Product ID
          </label>
          <input
            type='text'
            name='productId'
            value={formData.productId}
            readOnly
            className={`${inputCssStyles} bg-gray-100`}
          />

          {/* SKU */}
          <label htmlFor='sku' className={labelCssStyles}>
            SKU
          </label>
          <input
            type='text'
            name='sku'
            placeholder='SKU'
            onChange={handleChange}
            value={formData.sku || ''}
            className={inputCssStyles}
          />

          {/* PRODUCT NAME */}
          <label htmlFor='name' className={labelCssStyles}>
            Product Name
          </label>
          <input
            type='text'
            name='name'
            placeholder='Name'
            onChange={handleChange}
            value={formData.name}
            className={inputCssStyles}
            required
          />

          {/* PRICE */}
          <label htmlFor='price' className={labelCssStyles}>
            Price
          </label>
          <input
            type='number'
            name='price'
            placeholder='Price'
            onChange={handleChange}
            value={formData.price}
            className={inputCssStyles}
            required
          />

          {/* STOCK QUANTITY */}
          <label htmlFor='stockQuantity' className={labelCssStyles}>
            Stock Quantity
          </label>
          <input
            type='number'
            name='stockQuantity'
            placeholder='Stock Quantity'
            onChange={handleChange}
            value={formData.stockQuantity}
            className={inputCssStyles}
            required
          />

          {/* DESCRIPTION */}
          <label htmlFor='description' className={labelCssStyles}>
            Description
          </label>
          <textarea
            name='description'
            placeholder='Description (optional)'
            onChange={handleChange}
            value={formData.description || ''}
            className={inputCssStyles}
          />

          {/* EXTERNAL IDS (JSON) */}
          <label htmlFor='externalIds' className={labelCssStyles}>
            External IDs (JSON, e.g., {`{"prom": "123"}`})
          </label>
          <input
            type='text'
            name='externalIds'
            placeholder='External IDs (optional)'
            onChange={handleChange}
            value={formData.externalIds || '{}'}
            className={inputCssStyles}
          />

          {/* IMAGES */}
          <label htmlFor='images' className={labelCssStyles}>
            Images (one per line)
          </label>
          {(formData.images || []).map((image, index) => (
            <input
              key={index}
              type='text'
              name='images'
              placeholder={`Image URL ${index + 1}`}
              onChange={(e) => handleArrayChange(e, index, 'images')}
              value={image || ''}
              className={inputCssStyles}
            />
          ))}
          <button
            type='button'
            onClick={addImage}
            className='mt-2 px-2 py-1 bg-green-500 text-white rounded hover:bg-green-700'
          >
            Add Image
          </button>

          {/* SOURCE */}
          <label htmlFor='source' className={labelCssStyles}>
            Source
          </label>
          <select
            name='source'
            onChange={handleChange}
            value={formData.source || 'prom'}
            className={inputCssStyles}
          >
            <option value='prom'>Prom</option>
            <option value='rozetka'>Rozetka</option>
          </select>

          {/* CREATE ACTIONS */}
          <button
            type='submit'
            className='mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700'
          >
            Create
          </button>
          <button
            onClick={onClose}
            type='button'
            className='ml-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-700'
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  )
}

export default CreateProductModal
