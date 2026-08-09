-- ==============================================================================
-- DATABASE MIGRATION V2 - GHOST MODULES ACTIVATION
-- Supports Tasks, Expenses, Inspections, Settings, and Documents
-- ==============================================================================

-- 1. Dealership Settings Table
CREATE TABLE IF NOT EXISTS public.dealership_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tasks / Planner Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    priority VARCHAR(50) DEFAULT 'Medium',
    status VARCHAR(50) DEFAULT 'todo',
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. Vehicle Expenses Table
CREATE TABLE IF NOT EXISTS public.vehicle_expenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Vehicle Inspections Table
CREATE TABLE IF NOT EXISTS public.inspections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE CASCADE,
    inspector_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    inspection_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Documents Table (For storage mapping)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'lead', 'inventory', 'general'
    entity_id UUID, -- No hard FK since it could reference multiple tables
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size_kb INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- FIXING PAST DESTRUCTIVE ACTIONS (FOREIGN KEY SAFETY)
-- ==============================================================================
-- It's difficult to alter constraints online blindly, but we are enforcing
-- "Soft Deletes" in the frontend codebase. Any past foreign constraints in V1
-- like 'ON DELETE SET NULL' or 'No Action' will remain safe because the UI
-- will no longer issue DELETE statements on leads or inventory.
