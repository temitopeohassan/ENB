# Firebase to Supabase Migration Guide

This guide will help you migrate your ENB application from Firebase to Supabase.

## Prerequisites

1. **Supabase Account**: Create a Supabase account at [supabase.com](https://supabase.com)
2. **Supabase Project**: Create a new project in your Supabase dashboard
3. **Environment Variables**: You'll need your Supabase project credentials

## Step 1: Set Up Supabase Environment Variables

Add the following environment variables to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Keep your existing blockchain configuration
RPC_URL=your_ethereum_rpc_url
PRIVATE_KEY=your_relayer_private_key
CONTRACT_ADDRESS=your_smart_contract_address
```

You can find these values in your Supabase project settings:
- Go to your Supabase project dashboard
- Navigate to Settings > API
- Copy the Project URL, anon public key, and service_role secret key

## Step 2: Install Dependencies

Update your dependencies by running:

```bash
npm install @supabase/supabase-js
npm uninstall firebase-admin
```

## Step 3: Initialize the Database Schema

Run the database initialization script:

```bash
npm run init-db
```

This will create all the necessary tables and stored procedures in your Supabase database.

## Step 4: Migrate Existing Data (Optional)

If you have existing data in Firebase that you want to migrate to Supabase:

1. **Keep Firebase credentials temporarily**: Add your Firebase service account JSON to the `.env` file:
   ```env
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   ```

2. **Run the migration script**:
   ```bash
   node migrate-firebase-to-supabase.js
   ```

3. **Remove Firebase credentials**: Once migration is complete, remove the `FIREBASE_SERVICE_ACCOUNT_JSON` from your `.env` file.

## Step 5: Update Your Application

The main server file (`server.js`) has been updated to use Supabase instead of Firebase. Key changes include:

### Database Operations
- **Firebase**: `db.collection('accounts').doc(walletAddress).get()`
- **Supabase**: `supabase.from('accounts').select('*').eq('wallet_address', walletAddress).single()`

### Field Names
- **Firebase**: `walletAddress`, `isActivated`, `enbBalance`
- **Supabase**: `wallet_address`, `is_activated`, `enb_balance`

### Transactions
- **Firebase**: Batch operations with `db.batch()`
- **Supabase**: Stored procedures for atomic operations

## Step 6: Test Your Application

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Test the endpoints**:
   - Create an account: `POST /api/create-account`
   - Get profile: `GET /api/profile/:walletAddress`
   - Daily claim: `POST /api/daily-claim`
   - Leaderboards: `GET /api/leaderboard/balance`

## Database Schema

The migration includes the following tables:

### Core Tables
- `accounts` - User accounts and balances
- `invitation_usage` - Invitation code usage tracking
- `transactions` - Transaction history
- `claims` - Daily claim records
- `upgrades` - Membership upgrade records

### Game Tables
- `game_status` - Game state information
- `voting` - Voting system data
- `leaderboard` - Player scores
- `profiles` - Player profiles
- `rewards` - Rewards configuration
- `game_rules` - Game rules

### Stored Procedures
- `activate_account_with_usage()` - Atomic account activation
- `update_balance_with_transaction()` - Atomic balance updates

## Key Differences

### 1. Data Structure
- **Firebase**: Document-based, flexible schema
- **Supabase**: Relational database with strict schema

### 2. Queries
- **Firebase**: NoSQL-style queries with `.where()`, `.orderBy()`
- **Supabase**: SQL-style queries with `.eq()`, `.order()`

### 3. Transactions
- **Firebase**: Batch operations
- **Supabase**: Stored procedures for complex operations

### 4. Real-time Features
- **Firebase**: Built-in real-time listeners
- **Supabase**: Real-time subscriptions available

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Verify your Supabase URL and keys are correct
   - Check that your Supabase project is active

2. **Schema Errors**
   - Run the initialization script: `npm run init-db`
   - Check the SQL console in your Supabase dashboard

3. **Migration Errors**
   - Ensure Firebase credentials are correct
   - Check that all required environment variables are set

### Performance Considerations

1. **Indexes**: The schema includes indexes for common queries
2. **Stored Procedures**: Use them for complex operations
3. **Connection Pooling**: Supabase handles this automatically

## Rollback Plan

If you need to rollback to Firebase:

1. **Keep Firebase dependencies**: Don't remove `firebase-admin` immediately
2. **Maintain both configurations**: Keep both Firebase and Supabase credentials
3. **Gradual migration**: Test thoroughly before removing Firebase code

## Support

For issues with:
- **Supabase**: Check the [Supabase documentation](https://supabase.com/docs)
- **Migration**: Review the migration script and database schema
- **Application**: Check the updated server.js file

## Next Steps

After successful migration:

1. **Remove Firebase dependencies**: `npm uninstall firebase-admin`
2. **Update documentation**: Update any API documentation
3. **Monitor performance**: Check Supabase dashboard for usage metrics
4. **Enable real-time features**: If needed, implement Supabase real-time subscriptions 