import axios from 'axios'
import * as dotenv from 'dotenv'
dotenv.config()

const apiKey = process.env.PROM_API_KEY


const baseUrl = 'https://my.prom.ua/api/v1/products'
const getHeaders = () => {
  if (!apiKey) throw new Error('PROM_API_KEY is not defined in .env')
  return { Authorization: `Bearer ${apiKey}` }
}


export const getProductQuantity = async (productId: string) => {
const headers = getHeaders()
  const response = await axios.get(`${baseUrl}/${productId}`, {
    headers,
  })
  return response.data.quantity // Adjust based on Prom’s actual response structure
}

export const updateProductQuantity = async (
  productId: string,
  quantity: number
) => {
const headers = getHeaders()
const url = `${baseUrl}/edit`
const payload = [
  {
    id: productId,
    quantity_in_stock: quantity,
  },
]
  const response = await axios.post(url, payload, { headers })

  // Return the response data, which includes processed_ids and errors
  return response.data
}
