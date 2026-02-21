# Edge Function Logs Table Schema

## Prompt

You are a Supabase database architect. Create the `edge_function_logs` table schema for the Laundry Marketplace Platform to track Edge Function executions, errors, and performance metrics for observability.

### Requirements

1. **Table Name**: `edge_function_logs`
2. **Primary Key**: `id` (UUID)
3. **Purpose**: Centralized logging for all Edge Function executions, errors, and performance tracking

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `function_name` (TEXT, NOT NULL) - Name of Edge Function: `'dispatch_driver' | 'accept_order' | 'process_payouts' | ...`
- `execution_id` (UUID, nullable) - Unique execution ID for tracing
- `status` (TEXT, NOT NULL) - `'success' | 'error' | 'timeout'`
- `request_payload` (JSONB, nullable) - Input parameters (sanitized, no sensitive data)
- `response_payload` (JSONB, nullable) - Response data (on success)
- `error_code` (TEXT, nullable) - Error code: `'ERR_INVALID_TRANSITION' | 'ERR_CAPACITY_EXCEEDED' | ...`
- `error_message` (TEXT, nullable) - Error message
- `error_stack` (TEXT, nullable) - Stack trace (truncated if too long)
- `duration_ms` (INTEGER, nullable) - Execution time in milliseconds
- `invoked_by` (UUID, nullable, references `profiles.id`) - User who triggered (if applicable)
- `invoked_by_role` (TEXT, nullable) - Role of invoker
- `ip_address` (INET, nullable) - IP address of request
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- Every Edge Function execution should create a log entry
- Sensitive data (passwords, tokens) should not be logged in `request_payload`
- Error logs are retained for 90 days (can be archived)
- Success logs can be retained for shorter periods (30 days)
- `execution_id` enables distributed tracing

### Row Level Security (RLS) Policies

1. **Admins can see all logs**
   ```sql
   CREATE POLICY "admins_see_all_function_logs"
   ON edge_function_logs FOR SELECT
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

2. **System can create logs (service_role)**
   - Log creation via Edge Functions themselves

### Indexes

- Index on `function_name` for function-specific queries
- Index on `status` for error filtering
- Index on `created_at` for time-based queries
- Index on `execution_id` for tracing
- Composite index on `(function_name, status, created_at DESC)` for monitoring dashboards
- Index on `error_code` for error analysis

### Triggers

- Trigger to archive old logs (optional, can be handled via cron)

### Migration SQL

```sql
-- Create edge_function_logs table
CREATE TABLE IF NOT EXISTS edge_function_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  execution_id UUID,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  request_payload JSONB,
  response_payload JSONB,
  error_code TEXT,
  error_message TEXT,
  error_stack TEXT,
  duration_ms INTEGER CHECK (duration_ms >= 0),
  invoked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  invoked_by_role TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_function ON edge_function_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_status ON edge_function_logs(status);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_created_at ON edge_function_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_execution_id ON edge_function_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_function_status_time ON edge_function_logs(function_name, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_error_code ON edge_function_logs(error_code) WHERE error_code IS NOT NULL;

-- Enable RLS
ALTER TABLE edge_function_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see above)

-- Create function to archive old logs (optional)
CREATE OR REPLACE FUNCTION archive_old_function_logs()
RETURNS void AS $$
BEGIN
  -- Archive logs older than 90 days (move to separate archive table or delete)
  DELETE FROM edge_function_logs
  WHERE created_at < now() - INTERVAL '90 days'
  AND status = 'success';
  
  -- Keep error logs longer (180 days)
  DELETE FROM edge_function_logs
  WHERE created_at < now() - INTERVAL '180 days'
  AND status = 'error';
END;
$$ LANGUAGE plpgsql;

-- Schedule archiving (run via cron or Edge Function)
```

### Notes

- Logs are created by Edge Functions using `console.error` and explicit log inserts
- `request_payload` should exclude sensitive fields (passwords, tokens, bank details)
- `execution_id` enables correlation with external monitoring tools (e.g., Sentry, Datadog)
- Performance monitoring: track `duration_ms` to identify slow functions
- Error analysis: use `error_code` for categorizing and alerting on common errors
- Log retention policies can be adjusted based on storage costs
- Consider partitioning by date for large-scale deployments
