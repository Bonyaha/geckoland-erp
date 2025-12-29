// client/src/state/api.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export interface Product {
  productId: string
  mainImage: string
  name: string
  price: number
  rating?: number
  stockQuantity: number
  sku: string
  costPrice?: number
}

export interface ProductInventoryStats {
  totalGoods: number
  inStockCount: number
  totalUnits: number
  totalValue: number
  potentialProfit: number
}

export interface NewProduct {
  name: string
  price: number
  rating?: number
  stockQuantity: number
  sku: string
}

export interface UpdateProduct {
  productId: string
  quantity?: number
  price?: number
  costPrice?: number
  targetMarketplace?: 'prom' | 'rozetka' | 'all'
}

export interface BatchUpdateProductQuantity {
  products: Array<{
    productId: string
    updates: {
      quantity?: number
      price?: number
    }
  }>
  targetMarketplace?: 'prom' | 'rozetka' | 'all'
}

export interface ProductsResponse {
  products: Product[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface ProductQueryParams {
  search?: string
  page?: number
  limit?: number
  stockFilter?: 'all' | 'inStock' | 'outOfStock'
}

export interface SyncMarketplacesResult {
  success: boolean
  productsCreatedFromProm: number
  productsCreatedFromRozetka: number
  totalCreated: number
  errors: string[]
}

export interface SalesSummary {
  salesSummaryId: string
  totalValue: number
  changePercentage?: number
  date: string
}

export interface PurchaseSummary {
  purchaseSummaryId: string
  totalPurchased: number
  changePercentage?: number
  date: string
}

export interface ExpenseSummary {
  expenseSummarId: string
  totalExpenses: number
  date: string
}

export interface ExpenseByCategorySummary {
  expenseByCategorySummaryId: string
  category: string
  amount: string
  date: string
}

export interface DashboardMetrics {
  popularProducts: Product[]
  salesSummary: SalesSummary[]
  purchaseSummary: PurchaseSummary[]
  expenseSummary: ExpenseSummary[]
  expenseByCategorySummary: ExpenseByCategorySummary[]
}

export interface User {
  userId: string
  name: string
  email: string
}

export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL }),
  reducerPath: 'api',
  tagTypes: ['DashboardMetrics', 'Products', 'Users', 'Expenses'],
  endpoints: (build) => ({
    getDashboardMetrics: build.query<DashboardMetrics, void>({
      query: () => '/dashboard',
      providesTags: ['DashboardMetrics'],
    }),
    getProducts: build.query<ProductsResponse, ProductQueryParams | void>({
      query: (params) => ({
        url: '/products',
        params: params || {},
      }),
      providesTags: ['Products'],
    }),
    getProductStats: build.query<ProductInventoryStats, void>({
      query: () => '/products/stats',
      providesTags: ['Products'],
    }),
    createProduct: build.mutation<Product, NewProduct>({
      query: (newProduct) => ({
        url: '/products',
        method: 'POST',
        body: newProduct,
      }),
      invalidatesTags: ['Products'],
    }),
    updateProduct: build.mutation<Product, UpdateProduct>({
      query: ({
        productId,
        quantity,
        price,
        costPrice,
        targetMarketplace,
      }) => ({
        url: `/products/${productId}`,
        method: 'PATCH',
        body: {
          quantity,
          price,
          costPrice,
          targetMarketplace: targetMarketplace || 'all',
        },
      }),
      invalidatesTags: ['Products'],
    }),
    batchUpdateProduct: build.mutation<any, BatchUpdateProductQuantity>({
      query: ({ products, targetMarketplace }) => ({
        url: `/products/batch`,
        method: 'PATCH',
        body: {
          products,
          targetMarketplace: targetMarketplace || 'all',
        },
      }),
      invalidatesTags: ['Products'],
    }),
    syncProductsFromMarketplaces: build.mutation<SyncMarketplacesResult, void>({
      query: () => ({
        url: '/products/sync/marketplaces',
        method: 'POST',
      }),
      invalidatesTags: ['Products'],
    }),
    getUsers: build.query<User[], void>({
      query: () => '/users',
      providesTags: ['Users'],
    }),
    getExpensesByCategory: build.query<ExpenseByCategorySummary[], void>({
      query: () => '/expenses',
      providesTags: ['Expenses'],
    }),
  }),
})

export const {
  useGetDashboardMetricsQuery,
  useGetProductsQuery,
  useGetProductStatsQuery,
  useCreateProductMutation,
  useGetUsersQuery,
  useGetExpensesByCategoryQuery,
  useUpdateProductMutation,
  useBatchUpdateProductMutation,
  useSyncProductsFromMarketplacesMutation,
} = api
