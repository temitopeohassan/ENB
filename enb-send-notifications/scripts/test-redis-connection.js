#!/usr/bin/env node

/**
 * Test Redis connection for the main application
 */

const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { Redis } = require('@upstash/redis');

async function testRedisConnection() {
  console.log('🧪 Testing Redis Connection for Main App');
  console.log('========================================');
  
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN;

  console.log('🔍 Environment Variables:');
  console.log(`   UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`   REDIS_URL: ${process.env.REDIS_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`   UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ Set' : '❌ Not set'}`);
  console.log(`   REDIS_TOKEN: ${process.env.REDIS_TOKEN ? '✅ Set' : '❌ Not set'}`);
  console.log(`   Final URL: ${url ? `${url.substring(0, 30)}...` : 'MISSING'}`);
  console.log(`   Final Token: ${token ? `${token.substring(0, 10)}...` : 'MISSING'}`);

  if (!url || !token) {
    console.log('\n❌ Missing Redis credentials');
    return false;
  }

  try {
    console.log('\n🔌 Creating Redis client...');
    const redis = new Redis({ url, token });
    
    console.log('🔍 Testing connection with ping...');
    const pingResult = await redis.ping();
    console.log(`✅ Ping result: ${pingResult}`);
    
    console.log('\n🔍 Testing basic operations...');
    
    // Test set/get
    await redis.set('test:connection', 'success');
    const getResult = await redis.get('test:connection');
    console.log(`✅ Set/Get test: ${getResult}`);
    
    // Test list operations (used by notification system)
    await redis.lpush('test:list', 'item1', 'item2');
    const listResult = await redis.lrange('test:list', 0, -1);
    console.log(`✅ List operations: ${JSON.stringify(listResult)}`);
    
    // Clean up test data
    await redis.del('test:connection');
    await redis.del('test:list');
    console.log('✅ Cleanup completed');
    
    console.log('\n🎉 Redis connection test PASSED!');
    console.log('   Your Redis configuration is working correctly.');
    console.log('   The notification system should now show green status.');
    
    return true;
    
  } catch (error) {
    console.log('\n❌ Redis connection test FAILED!');
    console.log(`   Error: ${error.message}`);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your Redis URL and token');
    console.log('   2. Ensure your Upstash database is active');
    console.log('   3. Verify network connectivity');
    
    return false;
  }
}

// Run the test
if (require.main === module) {
  testRedisConnection().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testRedisConnection };
