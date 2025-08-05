import admin from 'firebase-admin';
import { supabase } from './config/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin (for reading existing data)
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON not found. Cannot migrate without Firebase access.');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const migrateAccounts = async () => {
  console.log('🔄 Migrating accounts...');
  
  try {
    const snapshot = await db.collection('accounts').get();
    const accounts = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      accounts.push({
        wallet_address: data.walletAddress,
        transaction_hash: data.transactionHash,
        membership_level: data.membershipLevel || 'Based',
        invitation_code: data.invitationCode,
        max_invitation_uses: data.maxInvitationUses || 5,
        current_invitation_uses: data.currentInvitationUses || 0,
        enb_balance: data.enbBalance || 0,
        total_earned: data.totalEarned || 0,
        consecutive_days: data.consecutiveDays || 0,
        is_activated: data.isActivated || false,
        activated_at: data.activatedAt ? new Date(data.activatedAt.toDate()) : null,
        activated_by: data.activatedBy,
        inviter_wallet: data.inviterWallet,
        last_daily_claim_time: data.lastDailyClaimTime ? new Date(data.lastDailyClaimTime.toDate()) : null,
        last_transaction_hash: data.lastTransactionHash,
        last_upgrade_at: data.lastUpgradeAt ? new Date(data.lastUpgradeAt.toDate()) : null,
        upgrade_transaction_hash: data.upgradeTransactionHash,
        created_at: data.createdAt ? new Date(data.createdAt.toDate()) : new Date(),
        updated_at: new Date()
      });
    });

    if (accounts.length > 0) {
      const { error } = await supabase
        .from('accounts')
        .upsert(accounts, { onConflict: 'wallet_address' });

      if (error) throw error;
      console.log(`✅ Migrated ${accounts.length} accounts`);
    } else {
      console.log('ℹ️ No accounts to migrate');
    }
  } catch (error) {
    console.error('❌ Error migrating accounts:', error);
  }
};

const migrateInvitationUsage = async () => {
  console.log('🔄 Migrating invitation usage...');
  
  try {
    const snapshot = await db.collection('invitationUsage').get();
    const usageRecords = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      usageRecords.push({
        invitation_code: data.invitationCode,
        used_by: data.usedBy,
        used_at: data.usedAt ? new Date(data.usedAt.toDate()) : new Date(),
        inviter_wallet: data.inviterWallet
      });
    });

    if (usageRecords.length > 0) {
      const { error } = await supabase
        .from('invitation_usage')
        .upsert(usageRecords, { onConflict: 'invitation_code,used_by' });

      if (error) throw error;
      console.log(`✅ Migrated ${usageRecords.length} invitation usage records`);
    } else {
      console.log('ℹ️ No invitation usage records to migrate');
    }
  } catch (error) {
    console.error('❌ Error migrating invitation usage:', error);
  }
};

const migrateTransactions = async () => {
  console.log('🔄 Migrating transactions...');
  
  try {
    const snapshot = await db.collection('transactions').get();
    const transactions = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        wallet_address: data.walletAddress,
        amount: data.amount,
        type: data.type,
        description: data.description || '',
        balance_before: data.balanceBefore,
        balance_after: data.balanceAfter,
        timestamp: data.timestamp ? new Date(data.timestamp.toDate()) : new Date()
      });
    });

    if (transactions.length > 0) {
      const { error } = await supabase
        .from('transactions')
        .insert(transactions);

      if (error) throw error;
      console.log(`✅ Migrated ${transactions.length} transactions`);
    } else {
      console.log('ℹ️ No transactions to migrate');
    }
  } catch (error) {
    console.error('❌ Error migrating transactions:', error);
  }
};

const migrateClaims = async () => {
  console.log('🔄 Migrating claims...');
  
  try {
    const snapshot = await db.collection('claims').get();
    const claims = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      claims.push({
        wallet_address: doc.id,
        claimed_at: data.claimedAt ? new Date(data.claimedAt) : new Date(),
        reward: data.reward || 0,
        consecutive_days: data.consecutiveDays || 0,
        tx_hash: data.txHash,
        last_claimed: data.lastClaimed ? new Date(data.lastClaimed) : null
      });
    });

    if (claims.length > 0) {
      const { error } = await supabase
        .from('claims')
        .upsert(claims, { onConflict: 'wallet_address' });

      if (error) throw error;
      console.log(`✅ Migrated ${claims.length} claims`);
    } else {
      console.log('ℹ️ No claims to migrate');
    }
  } catch (error) {
    console.error('❌ Error migrating claims:', error);
  }
};

const migrateUpgrades = async () => {
  console.log('🔄 Migrating upgrades...');
  
  try {
    const snapshot = await db.collection('upgrades').get();
    const upgrades = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      upgrades.push({
        wallet_address: doc.id,
        upgraded_at: data.upgradedAt ? new Date(data.upgradedAt) : new Date(),
        level: data.level,
        tx_hash: data.txHash
      });
    });

    if (upgrades.length > 0) {
      const { error } = await supabase
        .from('upgrades')
        .upsert(upgrades, { onConflict: 'wallet_address' });

      if (error) throw error;
      console.log(`✅ Migrated ${upgrades.length} upgrades`);
    } else {
      console.log('ℹ️ No upgrades to migrate');
    }
  } catch (error) {
    console.error('❌ Error migrating upgrades:', error);
  }
};

const migrateGameData = async () => {
  console.log('🔄 Migrating game data...');
  
  try {
    // Migrate game status
    const gameStatusSnapshot = await db.collection('gameStatus').get();
    if (!gameStatusSnapshot.empty) {
      const gameStatusData = gameStatusSnapshot.docs[0].data();
      const { error: statusError } = await supabase
        .from('game_status')
        .upsert({
          status_key: 'current',
          status_data: gameStatusData
        });
      if (!statusError) console.log('✅ Migrated game status');
    }

    // Migrate voting data
    const votingSnapshot = await db.collection('voting').get();
    if (!votingSnapshot.empty) {
      const votingData = votingSnapshot.docs[0].data();
      const { error: votingError } = await supabase
        .from('voting')
        .upsert({
          voting_key: 'current',
          voting_data: votingData
        });
      if (!votingError) console.log('✅ Migrated voting data');
    }

    // Migrate leaderboard
    const leaderboardSnapshot = await db.collection('leaderboard').get();
    const leaderboardData = [];
    leaderboardSnapshot.forEach(doc => {
      const data = doc.data();
      leaderboardData.push({
        player_id: doc.id,
        score: data.score || 0
      });
    });
    if (leaderboardData.length > 0) {
      const { error: leaderboardError } = await supabase
        .from('leaderboard')
        .upsert(leaderboardData, { onConflict: 'player_id' });
      if (!leaderboardError) console.log(`✅ Migrated ${leaderboardData.length} leaderboard entries`);
    }

    // Migrate profiles
    const profilesSnapshot = await db.collection('profiles').get();
    const profilesData = [];
    profilesSnapshot.forEach(doc => {
      const data = doc.data();
      profilesData.push({
        player_id: doc.id,
        profile_data: data
      });
    });
    if (profilesData.length > 0) {
      const { error: profilesError } = await supabase
        .from('profiles')
        .upsert(profilesData, { onConflict: 'player_id' });
      if (!profilesError) console.log(`✅ Migrated ${profilesData.length} profiles`);
    }

    // Migrate rewards
    const rewardsSnapshot = await db.collection('rewards').get();
    if (!rewardsSnapshot.empty) {
      const rewardsData = rewardsSnapshot.docs[0].data();
      const { error: rewardsError } = await supabase
        .from('rewards')
        .upsert({
          rewards_key: 'current',
          rewards_data: rewardsData
        });
      if (!rewardsError) console.log('✅ Migrated rewards data');
    }

    // Migrate game rules
    const rulesSnapshot = await db.collection('gameRules').get();
    if (!rulesSnapshot.empty) {
      const rulesData = rulesSnapshot.docs[0].data();
      const { error: rulesError } = await supabase
        .from('game_rules')
        .upsert({
          rules_key: 'current',
          rules_data: rulesData
        });
      if (!rulesError) console.log('✅ Migrated game rules');
    }

  } catch (error) {
    console.error('❌ Error migrating game data:', error);
  }
};

const runMigration = async () => {
  console.log('🚀 Starting Firebase to Supabase migration...');
  
  try {
    await migrateAccounts();
    await migrateInvitationUsage();
    await migrateTransactions();
    await migrateClaims();
    await migrateUpgrades();
    await migrateGameData();
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

// Run the migration
runMigration(); 