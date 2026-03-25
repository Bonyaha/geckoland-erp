// client/src/app/(components)/NovaPoshtaSearch/index.ts
export { default as NpCitySearch } from './NpCitySearch'
export { default as NpWarehouseSearch } from './NpWarehouseSearch'

// Re-export types if needed elsewhere
export type { NpCity, NpWarehouse } from '@/hooks/useNovaPoshtaAutocomplete'
