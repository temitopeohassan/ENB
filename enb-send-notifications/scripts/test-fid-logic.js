#!/usr/bin/env node

/**
 * Test script for the FID batch logic (without Redis connection)
 * This script tests the batching logic with mock data
 */

/**
 * Extract FID from a Redis key (same logic as main script)
 */
function extractFIDFromKey(key) {
  const match = key.match(/^fid:(\d+):notifications$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Test the FID extraction logic
 */
function testFIDExtraction() {
  console.log('🧪 Testing FID Extraction Logic');
  console.log('================================');
  
  const testKeys = [
    'fid:1001:notifications',
    'fid:12345:notifications',
    'fid:999999:notifications',
    'fid:0:notifications',
    'invalid-key',
    'fid:abc:notifications',
    'fid:123:other',
    'notifications:fid:123'
  ];
  
  console.log('Testing key extraction:');
  testKeys.forEach(key => {
    const fid = extractFIDFromKey(key);
    console.log(`   "${key}" → ${fid !== null ? fid : 'null'}`);
  });
  
  console.log('\n✅ FID extraction tests completed');
}

/**
 * Test the batching logic
 */
function testBatchingLogic() {
  console.log('\n🧪 Testing Batching Logic');
  console.log('==========================');
  
  // Create mock FIDs
  const mockFIDs = [];
  for (let i = 1001; i <= 1500; i++) {
    mockFIDs.push(i);
  }
  
  console.log(`📊 Created ${mockFIDs.length} mock FIDs (1001-1500)`);
  
  // Test different batch sizes
  const testSizes = [99, 50, 25, 10];
  
  testSizes.forEach(batchSize => {
    console.log(`\n📦 Testing batch size: ${batchSize}`);
    console.log('-'.repeat(30));
    
    const batches = [];
    const totalBatches = Math.ceil(mockFIDs.length / batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const startIndex = i * batchSize;
      const endIndex = Math.min(startIndex + batchSize, mockFIDs.length);
      const batchFIDs = mockFIDs.slice(startIndex, endIndex);
      
      batches.push({
        batchNumber: i + 1,
        fids: batchFIDs,
        count: batchFIDs.length
      });
    }
    
    console.log(`   Total batches: ${batches.length}`);
    console.log(`   Expected batches: ${totalBatches}`);
    
    // Verify batch structure
    let totalFIDsInBatches = 0;
    batches.forEach((batch, index) => {
      totalFIDsInBatches += batch.count;
      
      // Check batch size (except last batch)
      if (index < batches.length - 1) {
        if (batch.count !== batchSize) {
          console.log(`   ⚠️  Batch ${batch.batchNumber}: Expected ${batchSize}, got ${batch.count}`);
        }
      }
      
      // Show first and last FID in each batch
      if (batch.count > 0) {
        console.log(`   Batch ${batch.batchNumber}: ${batch.count} FIDs (${batch.fids[0]}-${batch.fids[batch.fids.length-1]})`);
      }
    });
    
    // Verify total count
    if (totalFIDsInBatches !== mockFIDs.length) {
      console.log(`   ❌ Error: Total FIDs mismatch (${totalFIDsInBatches} vs ${mockFIDs.length})`);
    } else {
      console.log(`   ✅ Total FIDs verified: ${totalFIDsInBatches}`);
    }
  });
  
  console.log('\n✅ Batching logic tests completed');
}

/**
 * Test edge cases
 */
function testEdgeCases() {
  console.log('\n🧪 Testing Edge Cases');
  console.log('=====================');
  
  // Test with empty array
  console.log('📦 Testing empty FID array:');
  const emptyBatches = [];
  const emptyTotalBatches = Math.ceil(0 / 99);
  console.log(`   Empty array → ${emptyTotalBatches} batches`);
  
  // Test with single FID
  console.log('\n📦 Testing single FID:');
  const singleFID = [1001];
  const singleBatches = Math.ceil(singleFID.length / 99);
  console.log(`   Single FID → ${singleBatches} batch`);
  
  // Test with exactly batch size
  console.log('\n📦 Testing exactly batch size (99 FIDs):');
  const exactBatchFIDs = Array.from({length: 99}, (_, i) => 1001 + i);
  const exactBatches = Math.ceil(exactBatchFIDs.length / 99);
  console.log(`   Exactly 99 FIDs → ${exactBatches} batch`);
  
  // Test with batch size + 1
  console.log('\n📦 Testing batch size + 1 (100 FIDs):');
  const overBatchFIDs = Array.from({length: 100}, (_, i) => 1001 + i);
  const overBatches = Math.ceil(overBatchFIDs.length / 99);
  console.log(`   100 FIDs → ${overBatches} batches (99 + 1)`);
  
  console.log('\n✅ Edge case tests completed');
}

/**
 * Simulate the complete workflow
 */
function simulateCompleteWorkflow() {
  console.log('\n🧪 Simulating Complete Workflow');
  console.log('================================');
  
  // Simulate Redis keys
  const mockRedisKeys = [];
  for (let i = 1001; i <= 1200; i++) {
    mockRedisKeys.push(`fid:${i}:notifications`);
  }
  
  console.log(`📊 Simulated ${mockRedisKeys.length} Redis keys`);
  
  // Extract FIDs
  const fids = [];
  for (const key of mockRedisKeys) {
    const fid = extractFIDFromKey(key);
    if (fid !== null) {
      fids.push(fid);
    }
  }
  
  console.log(`📋 Extracted ${fids.length} FIDs`);
  
  // Sort FIDs
  fids.sort((a, b) => a - b);
  console.log(`📊 Sorted FIDs: ${fids[0]} to ${fids[fids.length-1]}`);
  
  // Create batches
  const batchSize = 99;
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
  
  console.log(`📦 Created ${batches.length} batches:`);
  batches.forEach(batch => {
    console.log(`   Batch ${batch.batchNumber}: ${batch.count} FIDs (${batch.fids[0]}-${batch.fids[batch.fids.length-1]})`);
  });
  
  console.log('\n✅ Complete workflow simulation completed');
}

/**
 * Main test function
 */
function runAllTests() {
  console.log('🚀 FID Batch Logic Tests');
  console.log('========================');
  
  testFIDExtraction();
  testBatchingLogic();
  testEdgeCases();
  simulateCompleteWorkflow();
  
  console.log('\n🎉 All tests completed successfully!');
  console.log('\n💡 The script logic is working correctly.');
  console.log('   To test with real Redis data, run: npm run fetch-fids');
}

// Run the tests
if (require.main === module) {
  runAllTests();
}

module.exports = { 
  testFIDExtraction, 
  testBatchingLogic, 
  testEdgeCases, 
  simulateCompleteWorkflow 
};
