### This version is different from version-2 by Products model and syncMarketplaces function

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

### Implemented .cron-initialized file for preventing nodemon running cron jobs on every code change. Now cron jobs run only on server srart up