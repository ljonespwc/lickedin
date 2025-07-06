#!/usr/bin/env node

/**
 * Clear Test Data Script
 * 
 * This script clears all test data from the Supabase database while preserving:
 * - User profiles
 * - Supabase auth users
 * 
 * Tables that will be cleared:
 * - interview_feedback
 * - interview_sessions  
 * - job_descriptions
 * - resumes
 * 
 * Usage: node scripts/clear-test-data.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  console.error('\nMake sure your .env.local file is properly configured.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function clearTestData() {
  console.log('🧹 Starting test data cleanup...\n')

  try {
    // Clear tables in dependency order (child tables first)
    const tablesToClear = [
      'interview_feedback',
      'interview_sessions',
      'job_descriptions', 
      'resumes'
    ]

    for (const table of tablesToClear) {
      console.log(`🗑️  Clearing ${table}...`)
      
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows
      
      if (error) {
        console.error(`❌ Error clearing ${table}:`, error.message)
      } else {
        console.log(`✅ Cleared ${table}`)
      }
    }

    console.log('\n🎉 Test data cleanup completed!')
    console.log('\n📋 Preserved data:')
    console.log('   - User profiles')
    console.log('   - Supabase auth users')
    console.log('\n💡 You can now test the application with fresh data.')

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    process.exit(1)
  }
}

// Add confirmation prompt
async function confirmClearance() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    readline.question('⚠️  This will clear all test data. Are you sure? (y/N): ', (answer) => {
      readline.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

async function main() {
  console.log('🚀 LickedIn Test Data Cleanup Script')
  console.log('=====================================\n')
  
  const confirmed = await confirmClearance()
  
  if (!confirmed) {
    console.log('❌ Operation cancelled.')
    process.exit(0)
  }

  await clearTestData()
}

// Run the script
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { clearTestData }
