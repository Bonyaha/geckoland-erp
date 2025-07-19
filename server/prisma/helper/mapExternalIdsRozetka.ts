import * as fs from 'fs/promises'

async function updateProductsExternalIds() {
	try {
		// Read products.json
		const productsData = await fs.readFile(
			'prisma/data/products.json',
			'utf-8'
		)
		let products = JSON.parse(productsData)

		// Read rozetkaProducts.json
		const rozetkaProductsData = await fs.readFile(
			'prisma/data/rozetkaProducts.json',
			'utf-8'
		)
		const rozetkaProducts = JSON.parse(rozetkaProductsData)

		// Create a map for quick lookup: uniqueProductKey -> productId
		const rozetkaProductsMap = new Map()
		rozetkaProducts.forEach((rozetkaProduct: any) => {
			rozetkaProductsMap.set(rozetkaProduct.uniqueProductKey, rozetkaProduct.productId)
		})

		let updatedCount = 0
		let notFoundCount = 0

		// Update products with matching SKUs
		products = products.map((product: any) => {
			const matchingRozetkaProductId = rozetkaProductsMap.get(product.sku)

			if (matchingRozetkaProductId) {
				updatedCount++
				return {
          ...product,
          externalIds: {
            ...product.externalIds,
            rozetka: matchingRozetkaProductId,
          },
        }
			} else {
				notFoundCount++
				// Keep the product as is if no match found
				return product
			}
		})

		// Write the updated products back to the file
		await fs.writeFile(
			'prisma/data/products.json',
			JSON.stringify(products, null, 2)
		)

		console.log('Products external IDs updated successfully!')
		console.log(`Total products processed: ${products.length}`)
		console.log(`Products updated with rozetka ID: ${updatedCount}`)
		console.log(`Products without matching rozetka ID: ${notFoundCount}`)
		console.log(`Available rozetka products: ${rozetkaProducts.length}`)
	} catch (error) {
		console.error('Error updating products external IDs:', error)
		throw error
	}
}

updateProductsExternalIds()
