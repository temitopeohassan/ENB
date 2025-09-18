#!/usr/bin/env node

/**
 * Test Redis status check function
 */

const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Import the Redis status check function (we'll implement it here since it's TypeScript)
const { Redis } = require('@upstash/redis');

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN;

  if (!url || !token) {
    return null;
  }

  try {
    return new Redis({ url, token });
  } catch (error) {
    console.error('Failed to initialize Redis client:', error);
    return null;
  }
}

async function checkRedisStatus() {
  try {
    const redis = getRedis();
    if (!redis) {
      return {
        isConnected: false,
        status: 'disconnected',
        message: 'Redis not configured'
      };
    }

    // Test the connection
    await redis.ping();
    return {
      isConnected: true,
      status: 'connected',
      message: 'Redis connected successfully'
    };
  } catch (error) {
    return {
      isConnected: false,
      status: 'error',
      message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function testRedisStatus() {
  console.log('🧪 Testing Redis Status Check');
  console.log('============================');
  
  try {
    console.log('🔍 Checking Redis status...');
    const status = await checkRedisStatus();
    
    console.log('\n📊 Redis Status Result:');
    console.log(`   Connected: ${status.isConnected ? '✅ Yes' : '❌ No'}`);
    console.log(`   Status: ${status.status}`);
    console.log(`   Message: ${status.message}`);
    
    if (status.isConnected) {
      console.log('\n🎉 Redis status check PASSED!');
      console.log('   The notifications page should now show green Redis status.');
    } else {
      console.log('\n⚠️  Redis status check shows issues:');
      console.log(`   ${status.message}`);
    }
    
    return status.isConnected;
    
  } catch (error) {
    console.log('\n❌ Redis status check FAILED!');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testRedisStatus().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testRedisStatus };
