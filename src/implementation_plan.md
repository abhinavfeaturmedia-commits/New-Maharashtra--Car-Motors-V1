# Overview
Currently, the Admin panel successfully *reads* all information perfectly. However, there are a few isolated UX branches—primarily in public booking and internal task management—that are dropping data or not sending payloads to their literal storage destinations. 

This Phase 9 Implementation Plan addresses wiring up all remaining frontend inserts to `supabase.from().insert()`.

## User Review Required
> [!IMPORTANT]
> Please review the strategy laid out below, especially regarding File Uploads (Documents). Since we have no initialized backend Storage bucket, I recommend bypassing genuine PDF generation for now and just storing external links, or bypassing Document fixes entirely until Phase 2 to focus on core CRM Bookings and Tasks.

## Proposed Changes

---

### [Bookings Engine]

*Currently, when a user books a test drive or service, the UI only logs a Lead, leaving the Admin Bookings calendar desolate.*

#### [MODIFY] [BookTestDrive.tsx](file:///c:/Users/Abhinav/Documents/Antigravity Files/swami-motors-Vol1/src/pages/BookTestDrive.tsx)
*   Update `handleSubmit`. After creating a Lead inside `leads`, capture that inserted `lead.id`.
*   Pass the `lead.id` and user-selected date/time into a `supabase.from('bookings').insert()` sequence, categorizing it as `booking_type: 'test_drive'`.

#### [MODIFY] [ServiceBooking.tsx](file:///c:/Users/Abhinav/Documents/Antigravity Files/swami-motors-Vol1/src/pages/ServiceBooking.tsx)
*   Perform the exact same dual-insert orchestration. Log the lead, then grab the ID and submit to `bookings` with `booking_type: 'service'`.

---

### [Activity Tracker (Tasks)]

*Currently, tasks are read-only. Admins cannot create follow-up tasks from the CRM.*

#### [MODIFY] [LeadDetail.tsx](file:///c:/Users/Abhinav/Documents/Antigravity Files/swami-motors-Vol1/src/pages/admin/LeadDetail.tsx)
*   Add a "New Schedule Task" modal alongside the internal notes block. 
*   Generate an insert mutation mapping `lead_id`, `title`, `due_date`, and `priority` directly to the `tasks` table.

#### [MODIFY] [FollowUps.tsx](file:///c:/Users/Abhinav/Documents/Antigravity Files/swami-motors-Vol1/src/pages/admin/FollowUps.tsx)
*   Introduce a global "Add Reminder" floating action button. This will let GMs schedule global operational tasks across the dealership without tying them exclusively to a specific Lead.

---

### [Identity (Customers)]

*Customers are successfully vaulted when a deal is Marked as Won, but there's no way to type in a customer who bypassed the Lead pipe.*

#### [MODIFY] [Customers.tsx](file:///c:/Users/Abhinav/Documents/Antigravity Files/swami-motors-Vol1/src/pages/admin/Customers.tsx)
*   Integrate a generic "Add Manual Customer Profile" slide-out form allowing administrators to insert rows straight to the `customers` model (Full Name, Contact, Address, Loyalty Value).

---

## Open Questions

> [!WARNING]  
> Documents (`Documents.tsx`) face a physical constraint. A standard Supabase Postgres table cannot store physical `.pdf` files without converting them entirely to bulky blobbing Base64. To upload documents optimally, we need **Supabase Storage** enabled.
> 
> *Question for you:* Should I leave `Documents.tsx` strictly mimicking the upload (as it currently does, validating the SQL relational compliance check correctly but not storing an actual PDF to a bucket), or do you want me to attempt hacking Base64 literal blobs into the SQL schema which might slow down the database? I strongly recommend leaving it simulated until Supabase Storage is activated.

## Verification Plan

### Automated Tests
*   Run local environment `npm run dev`.

### Manual Local Verification
*   **Bookings**: Visit `/book-test-drive`, complete the stepper format. Return to `/admin/bookings` to authenticate that the calendar explicitly shows a populated reservation block.
*   **Tasks**: Visit `/admin/leads`, open a profile, trigger an "Add Task". Cross-check against the Global `DailyPlanner` to verify the module propagates across all views immediately.
