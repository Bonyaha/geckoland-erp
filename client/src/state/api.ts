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

export interface UpdateProductQuantity {
  productId: string
  quantity: number
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
    updateProductQuantity: build.mutation<Product, UpdateProductQuantity>({
      query: ({ productId, quantity, targetMarketplace }) => ({
        url: `/products/${productId}`,
        method: 'PATCH',
        body: {
          quantity,
          targetMarketplace: targetMarketplace || 'all',
        },
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
  useUpdateProductQuantityMutation,
} = api
