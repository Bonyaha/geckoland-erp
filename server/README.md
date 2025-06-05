# Database Seeding Instructions

Follow these steps to set up and seed the database:

1. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```
2. **Run Migrations**
   ```bash
   npx prisma migrate dev --name init
   ```
3. **Seed the Database**
   ```bash
   npm run seed
   ```