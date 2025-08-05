import { supabase } from './config/supabase.js';

const testConnection = async () => {
  try {
    console.log('🔍 Testing Supabase connection...');

    // Test basic connection
    const { data, error } = await supabase
      .from('accounts')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Connection failed:', error);
      return false;
    }

    console.log('✅ Supabase connection successful!');
    console.log(`📊 Found ${data || 0} accounts in database`);

    // Test table structure
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
    } else {
      console.log('📋 Available tables:', tables.map(t => t.table_name).join(', '));
    }

    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
};

// Run the test
testConnection().then(success => {
  if (success) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('💥 Tests failed!');
    process.exit(1);
  }
}); 