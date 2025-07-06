# LickedIn Scripts

This directory contains utility scripts for managing the LickedIn application.

## Available Scripts

### `clear-test-data.js`

Clears all test data from the Supabase database while preserving user profiles and authentication data.

**What it clears:**
- `interview_feedback` - All interview feedback records
- `interview_sessions` - All interview session records  
- `job_descriptions` - All job description records
- `resumes` - All resume records

**What it preserves:**
- `profiles` - User profile data
- Supabase auth users

**Usage:**
```bash
# Run directly
node scripts/clear-test-data.js

# Or use the npm script
npm run clear-test-data
```

**Requirements:**
- `.env.local` file with proper Supabase credentials
- `NEXT_PUBLIC_SUPABASE_URL` environment variable
- `SUPABASE_SERVICE_ROLE_KEY` environment variable

**Safety Features:**
- Confirmation prompt before execution
- Clears tables in proper dependency order
- Error handling and reporting
- Detailed logging of operations

This script is particularly useful for:
- Testing the application with fresh data
- Cleaning up after development/testing sessions
- Preparing demo environments
- Resetting the application state for new tests
