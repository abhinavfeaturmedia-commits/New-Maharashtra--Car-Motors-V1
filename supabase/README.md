# Database & Supabase Guide — Maharashtra Motors (Swami Motors)

This folder contains all the database schemas, SQL queries, migration scripts, and Supabase integration files for the Maharashtra Motors application.

---

## 📁 SQL Directory Layout

```
supabase/
├── master_complete_schema.sql         <-- 🌟 COMPLETE ALL-IN-ONE MASTER SQL SCRIPT
├── schema.sql                         <-- Core database schema definitions
├── storage_setup.sql                  <-- Storage bucket setup and policies
├── dealer_contact_fields_migration.sql <-- Dealer contact updates
├── fix_incentives_staff_access.sql    <-- Staff incentive policies
├── fix_leads_scoped_access.sql        <-- Lead access RLS policies
├── fix_remaining_rls.sql              <-- General RLS fixes
└── migrations/                        <-- Individual modular feature migrations
    ├── create_attendance_tables.sql
    ├── create_club_members_table.sql
    ├── create_finance_services_table.sql
    ├── create_staff_accountability_tables.sql
    ├── create_video_reviews_table.sql
    ├── create_visits_table.sql
    ├── improve_shared_catalogs.sql
    └── sync_leaves_to_attendance_trigger.sql
```

---

## 🚀 How to Apply Database Migrations

### Option 1: Via Supabase SQL Editor (Recommended)
1. Open your **[Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/sxshzxbkjsrruqmrwkfb/sql/new)**.
2. Open [`supabase/master_complete_schema.sql`](master_complete_schema.sql) in your code editor.
3. Copy the entire file content.
4. Paste it into the Supabase SQL Editor and click **Run**.

---

### Option 2: Programmatically via Node.js
With `SUPABASE_SERVICE_ROLE_KEY` added to your `.env` file, you can run automated checks & migrations directly from your terminal:

```bash
# Check database schema status
node execution/check_migration.cjs

# Run automated audit migration
node execution/run_migration.cjs
```

---

## 📋 Tables Included in Schema

1. **`profiles`** - User accounts & roles (`admin`, `staff`, `customer`, `dealer`).
2. **`inventory`** - Pre-owned & new vehicle listings, purchase costs, consignment data.
3. **`leads`** - Customer inquiries, trade-in buy/sell leads, finance & insurance requests.
4. **`bookings`** - Test drive requests, service appointments, car reservations.
5. **`sales`** - Completed vehicle sales records, profit metrics, sales agent attribution.
6. **`customers`** - Verified customer accounts and purchasing history.
7. **`dealers`** - Partner dealership profiles.
8. **`shared_catalogs` & `shared_catalog_items`** - Dynamic WhatsApp/Social vehicle catalogs.
9. **`user_wishlist`** - Saved favorite cars per user.
10. **`attendance_records`** - HR & staff attendance logging.
11. **`club_members`** - Loyalty & rewards program.
12. **`storage.buckets`** - `car-images`, `documents`, `avatars`, `dealership-assets`.
