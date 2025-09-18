#!/usr/bin/env node

/**
 * Script to fetch FIDs from Redis database in batches of 99
 * 
 * This script:
 * 1. Connects to Redis using the same configuration as the main app
 * 2. Scans for all keys matching the pattern "fid:*:notifications"
 * 3. Extracts FIDs from these keys
 * 4. Groups them into batches of 99
 * 5. Outputs each batch with a name (batch 1, batch 2, etc.)
 */

const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { Redis } = require('@upstash/redis');
const fs = require('fs').promises;

/**
 * Get Redis instance using the same configuration as the main app
 */
function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN;

  console.log('🔍 Checking environment variables...');
  console.log(`   UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`   REDIS_URL: ${process.env.REDIS_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`   UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ Set' : '❌ Not set'}`);
  console.log(`   REDIS_TOKEN: ${process.env.REDIS_TOKEN ? '✅ Set' : '❌ Not set'}`);

  if (!url || !token) {
    console.error('❌ Missing Redis credentials');
    console.error('   Please set either:');
    console.error('   - UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (preferred)');
    console.error('   - REDIS_URL and REDIS_TOKEN (fallback)');
    return null;
  }

  try {
    const redis = new Redis({ url, token });
    console.log('✅ Redis client initialized');
    return redis;
  } catch (error) {
    console.error('❌ Failed to initialize Redis client:', error.message);
    return null;
  }
}

/**
 * Extract FID from a Redis key
 * Key format: "fid:{fid}:notifications"
 */
function extractFIDFromKey(key) {
  const match = key.match(/^fid:(\d+):notifications$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Fetch all FIDs from Redis and organize them into batches
 */
async function fetchFIDsInBatches(batchSize = 99) {
  const startTime = Date.now();
  
  console.log('🔍 Starting FID fetch process...');
  console.log(`📦 Batch size: ${batchSize}`);
  console.log('---');

  const redis = getRedis();
  if (!redis) {
    throw new Error('❌ Redis connection failed. Please check your environment variables.');
  }

  try {
    // Test Redis connection
    console.log('🔍 Testing Redis connection...');
    await redis.ping();
    console.log('✅ Redis connection test successful');

    // Get all keys matching the FID pattern
    console.log('🔍 Scanning for FID keys...');
    const allKeys = await redis.keys('fid:*:notifications');
    
    console.log(`📊 Found ${allKeys.length} FID keys`);

    // Extract FIDs from keys
    const fids = [];
    for (const key of allKeys) {
      const fid = extractFIDFromKey(key);
      if (fid !== null) {
        fids.push(fid);
      }
    }

    // Sort FIDs for consistent ordering
    fids.sort((a, b) => a - b);

    console.log(`📋 Extracted ${fids.length} unique FIDs`);

    // Group FIDs into batches
    const batches = [];
    const totalBatches = Math.ceil(fids.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const startIndex = i * batchSize;
      const endIndex = Math.min(startIndex + batchSize, fids.length);
      const batchFIDs = fids.slice(startIndex, endIndex);

      batches.push({
        batchNumber: i + 1,
        fids: batchFIDs,
        count: batchFIDs.length
      });
    }

    const executionTime = Date.now() - startTime;

    const result = {
      totalFIDs: fids.length,
      totalBatches: batches.length,
      batches,
      executionTime
    };

    return result;

  } catch (error) {
    console.error('❌ Error fetching FIDs:', error);
    throw error;
  }
}

/**
 * Display the results in a formatted way
 */
function displayResults(result) {
  console.log('\n🎉 FID Fetch Complete!');
  console.log('='.repeat(50));
  console.log(`📊 Total FIDs found: ${result.totalFIDs}`);
  console.log(`📦 Total batches created: ${result.totalBatches}`);
  console.log(`⏱️  Execution time: ${result.executionTime}ms`);
  console.log('='.repeat(50));

  console.log('\n📋 Batch Details:');
  console.log('-'.repeat(30));

  result.batches.forEach((batch, index) => {
    console.log(`\n📦 Batch ${batch.batchNumber}:`);
    console.log(`   Count: ${batch.count} FIDs`);
    
    // Show FIDs in a readable format
    if (batch.count <= 20) {
      console.log(`   FIDs: ${batch.fids.join(', ')}`);
    } else {
      const firstFew = batch.fids.slice(0, 10);
      const lastFew = batch.fids.slice(-10);
      console.log(`   FIDs (first 10): ${firstFew.join(', ')}`);
      console.log(`   FIDs (last 10): ${lastFew.join(', ')}`);
      console.log(`   ... and ${batch.count - 20} more FIDs in between`);
    }
  });

  console.log('\n' + '='.repeat(50));
}

/**
 * Export batches to JSON file
 */
async function exportBatchesToFile(result, filename) {
  const exportFilename = filename || `fid-batches-${new Date().toISOString().split('T')[0]}.json`;
  const exportPath = path.join(process.cwd(), 'scripts', 'exports', exportFilename);
  
  // Ensure exports directory exists
  const exportsDir = path.dirname(exportPath);
  try {
    await fs.mkdir(exportsDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  const exportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      totalFIDs: result.totalFIDs,
      totalBatches: result.totalBatches,
      batchSize: result.batches[0]?.count || 0,
      executionTime: result.executionTime
    },
    batches: result.batches
  };

  await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
  console.log(`\n💾 Exported to: ${exportPath}`);
}

/**
 * Main execution function
 */
async function main() {
  try {
    const batchSize = 99;
    
    console.log('🚀 FID Batch Fetcher');
    console.log('==================');
    
    const result = await fetchFIDsInBatches(batchSize);
    
    displayResults(result);
    
    // Check command line arguments
    const args = process.argv.slice(2);
    const shouldExport = args.includes('--export') || args.includes('-e');
    
    if (shouldExport) {
      const filename = args.find(arg => arg.startsWith('--file='))?.split('=')[1];
      await exportBatchesToFile(result, filename);
    } else {
      console.log('\n💡 Tip: Use --export flag to save results to JSON file');
      console.log('   Example: node scripts/fetch-fids-batch.js --export --file=my-fids.json');
    }

  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = { fetchFIDsInBatches, getRedis };
