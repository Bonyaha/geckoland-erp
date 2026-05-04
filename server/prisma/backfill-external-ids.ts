// server/prisma/backfill-external-ids.ts
// One-time backfill script to populate denormalized external ID columns
// Run AFTER migration: npm run backfill-external-ids
// Safe to run multiple times — skips products that already have values set.

import 'dotenv/config'
import prisma from '../src/config/database'

// shape of the externalIds JSON field
interface ExternalIds {
  prom?: string | number | null
  rozetka?: {
    item_id?: string | number | null
    rz_item_id?: string | number | null
  } | null
}

async function backfill() {
  console.log('🔄 Starting backfill of denormalized external IDs...')

  const products = await prisma.products.findMany({
    select: { productId: true, externalIds: true },
  })

  console.log(`📦 Found ${products.length} products to process`)

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const product of products) {
    try {
      const ext = product.externalIds as ExternalIds

      // extract each ID, converting to string if present
      const promId =
        ext?.prom != null && ext.prom !== '' ? String(ext.prom) : null

      const rozetkaItemId =
        ext?.rozetka?.item_id != null && ext.rozetka.item_id !== ''
          ? String(ext.rozetka.item_id)
          : null

      const rozetkaRzItemId =
        ext?.rozetka?.rz_item_id != null && ext.rozetka.rz_item_id !== ''
          ? String(ext.rozetka.rz_item_id)
          : null

      // Skip products with nothing to set
      if (!promId && !rozetkaItemId && !rozetkaRzItemId) {
        skipped++
        continue
      }

      // write only the three new columns — never touch anything else
      await prisma.products.update({
        where: { productId: product.productId },
        data: {
          promId,
          rozetkaItemId,
          rozetkaRzItemId,
        },
      })

      updated++

      if (updated % 50 === 0) {
        console.log(`  ✅ ${updated} products updated so far...`)
      }
    } catch (err: any) {
      // Unique constraint violation means another product already has this ID.
      // Log and continue — don't abort the whole backfill.
      if (err?.code === 'P2002') {
        console.warn(
          `⚠️  Duplicate external ID detected for product ${product.productId} — skipping (${err.meta?.target})`,
        )
      } else {
        console.error(
          `❌ Failed to update product ${product.productId}:`,
          err.message,
        )
      }
      errors++
    }
  }

  console.log('\n✅ Backfill complete!')
  console.log(`   Updated : ${updated}`)
  console.log(`   Skipped : ${skipped}  (no external IDs to set)`)
  console.log(`   Errors  : ${errors}`)
}

backfill()
  .catch((err) => {
    console.error('❌ Backfill failed fatally:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
