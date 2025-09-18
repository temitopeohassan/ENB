#!/usr/bin/env tsx

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

import { getRedis } from '../src/lib/redis';

interface FIDBatch {
  batchNumber: number;
  fids: number[];
  count: number;
}

interface FIDFetchResult {
  totalFIDs: number;
  totalBatches: number;
  batches: FIDBatch[];
  executionTime: number;
}

/**
 * Extract FID from a Redis key
 * Key format: "fid:{fid}:notifications"
 */
function extractFIDFromKey(key: string): number | null {
  const match = key.match(/^fid:(\d+):notifications$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Fetch all FIDs from Redis and organize them into batches
 */
async function fetchFIDsInBatches(batchSize: number = 99): Promise<FIDFetchResult> {
  const startTime = Date.now();
  
  console.log('🔍 Starting FID fetch process...');
  console.log(`📦 Batch size: ${batchSize}`);
  console.log('---');

  const redis = getRedis();
  if (!redis) {
    throw new Error('❌ Redis connection failed. Please check your environment variables.');
  }

  console.log('✅ Redis connection established');

  try {
    // Get all keys matching the FID pattern
    console.log('🔍 Scanning for FID keys...');
    const allKeys = await redis.keys('fid:*:notifications');
    
    console.log(`📊 Found ${allKeys.length} FID keys`);

    // Extract FIDs from keys
    const fids: number[] = [];
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
    const batches: FIDBatch[] = [];
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

    const result: FIDFetchResult = {
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
function displayResults(result: FIDFetchResult): void {
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
    console.log(`   FIDs: ${batch.fids.join(', ')}`);
    
    // Show first few and last few FIDs if batch is large
    if (batch.count > 10) {
      const firstFew = batch.fids.slice(0, 5);
      const lastFew = batch.fids.slice(-5);
      console.log(`   Preview: ${firstFew.join(', ')} ... ${lastFew.join(', ')}`);
    }
  });

  console.log('\n' + '='.repeat(50));
}

/**
 * Export batches to JSON file
 */
async function exportBatchesToFile(result: FIDFetchResult, filename?: string): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
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
async function main(): Promise<void> {
  try {
    const batchSize = 99;
    
    console.log('🚀 FID Batch Fetcher');
    console.log('==================');
    
    const result = await fetchFIDsInBatches(batchSize);
    
    displayResults(result);
    
    // Ask if user wants to export to file
    const args = process.argv.slice(2);
    const shouldExport = args.includes('--export') || args.includes('-e');
    
    if (shouldExport) {
      const filename = args.find(arg => arg.startsWith('--file='))?.split('=')[1];
      await exportBatchesToFile(result, filename);
    } else {
      console.log('\n💡 Tip: Use --export flag to save results to JSON file');
      console.log('   Example: npm run fetch-fids -- --export --file=my-fids.json');
    }

  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { fetchFIDsInBatches, FIDBatch, FIDFetchResult };
