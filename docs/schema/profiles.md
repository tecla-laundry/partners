# Profiles Table Schema

## Prompt

You are a Supabase database architect. Create the `profiles` table schema that extends Supabase Auth's `auth.users` table for the Laundry Marketplace Platform.

### Requirements

1. **Table Name**: `profiles`
2. **Primary Key**: `id` (UUID, references `auth.users.id`)
3. **Purpose**: Extend Supabase Auth users with role-based access control and user profile information

### Columns

- `id` (UUID, PRIMARY KEY, references `auth.users.id`)
- `role` (TEXT, NOT NULL, CHECK constraint: `'customer' | 'laundry_owner' | 'admin' | 'driver'`)
- `full_name` (TEXT, nullable)
- `phone` (TEXT, nullable, unique)
- `avatar_url` (TEXT, nullable - Supabase Storage URL)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- Default role on signup: `'customer'`
- Only one role per user
- Role changes must be audited (via admin_audit_logs for admin role changes)
- Phone numbers must be unique across all users
- Avatar URLs must be valid Supabase Storage signed URLs

### Row Level Security (RLS) Policies

1. **Users can read their own profile**
   ```sql
   CREATE POLICY "users_read_own_profile"
   ON profiles FOR SELECT
   TO authenticated
   USING (id = auth.uid());
   ```

2. **Users can update their own profile (except role)**
   ```sql
   CREATE POLICY "users_update_own_profile"
   ON profiles FOR UPDATE
   TO authenticated
   USING (id = auth.uid())
   WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));
   ```

3. **Admins can read all profiles**
   ```sql
   CREATE POLICY "admins_read_all_profiles"
   ON profiles FOR SELECT
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

### Indexes

- Index on `role` for role-based queries
- Index on `phone` for phone lookups
- Unique constraint on `phone`

### Triggers

- `updated_at` trigger to automatically update timestamp on row changes

### Migration SQL

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'laundry_owner', 'admin', 'driver')),
  full_name TEXT,
  phone TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see above)

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Notes

- This table extends Supabase Auth's built-in `auth.users` table
- Role-based access control is enforced at the database level via RLS policies
- Profile creation should be handled via database trigger on `auth.users` insert or via Edge Function
- Phone number validation should be done at the application level before insert
