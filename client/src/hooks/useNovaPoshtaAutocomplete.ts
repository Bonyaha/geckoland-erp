// client/src/hooks/useNovaPoshtaAutocomplete.ts
'use client'

import { useState, useEffect, } from 'react'

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/'
const NP_API_KEY = process.env.NEXT_PUBLIC_NOVA_POSHTA_API_KEY || ''

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NpCity {
  Ref: string // settlement ref (for warehouse search)
  DeliveryCity: string // city ref (alternative id)
  Present: string // full display string e.g. "м. Одеса, Одеська обл."
  MainDescription: string // city name e.g. "Одеса"
  Area: string
  Region: string
  SettlementTypeCode: string
  Warehouses: number
}

export interface NpWarehouse {
  Ref: string
  Number: string
  Description: string // full name e.g. "Відділення №1: вул. ..."
  ShortAddress: string // e.g. "Одеса, вул. ..."
  CityRef: string
  CategoryOfWarehouse: string // "Branch" | "Postomat" | etc.
  TotalMaxWeightAllowed: string
}

// ─── City search hook ─────────────────────────────────────────────────────────

export function useNpCitySearch(query: string, minChars = 2) {
  const [cities, setCities] = useState<NpCity[]>([])
  const [loading, setLoading] = useState(false)  

  useEffect(() => {
    if (query.length < minChars) {
      setCities([])
      return
    }

const controller = new AbortController()

    // Debounce
    const timer = setTimeout(async () => {    
      setLoading(true)
      try {
        const res = await fetch(NP_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal, // Connect this request to the controller
          body: JSON.stringify({
            apiKey: NP_API_KEY,
            modelName: 'AddressGeneral',
            calledMethod: 'searchSettlements',
            methodProperties: {
              CityName: query,
              Limit: 10,
            },
          }),
        })

        const data = await res.json()
        // Response: data.data[0].Addresses
        const addresses: NpCity[] = data?.data?.[0]?.Addresses || []
        setCities(addresses)
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('NP city search error:', err)
        }
      } finally {
        setLoading(false)
      }
    }, 300)

        return () => {
          clearTimeout(timer)
          controller.abort()
        }
  }, [query, minChars])

  return { cities, loading }
}

// ─── Warehouse search hook ────────────────────────────────────────────────────

export function useNpWarehouseSearch(
  cityRef: string, // DeliveryCity from selected NpCity
  query: string, // text typed in the warehouse field
) {
  const [warehouses, setWarehouses] = useState<NpWarehouse[]>([])
  const [loading, setLoading] = useState(false)
  

    useEffect(() => {
      if (!cityRef) {
        setWarehouses([])
        return
      }

      const controller = new AbortController()

      const timer = setTimeout(async () => {
        setLoading(true)
        try {
          const methodProperties: Record<string, any> = {
            CityRef: cityRef,
            Limit: 50,
            Page: 1,
          }

          // Only add FindByString when user typed something —
          // passing an empty string causes the API to return no results
          if (query.trim().length > 0) {
            methodProperties.FindByString = query.trim()
          }

          const res = await fetch(NP_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              apiKey: NP_API_KEY,
              modelName: 'AddressGeneral',
              calledMethod: 'getWarehouses',
              methodProperties,
            }),
          })

          const data = await res.json()
          const list: NpWarehouse[] = data?.data || []
          setWarehouses(list)
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('NP warehouse search error:', err)
          }
        } finally {
          setLoading(false)
        }
      }, 300)

      return () => {
        clearTimeout(timer)
        controller.abort()
      }
    }, [cityRef, query])

    return { warehouses, loading }
}
