import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { supabase } from './config/supabase.js';
import { ethers } from 'ethers';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current file directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load JSON file for ES modules
const enbMiniAppPath = join(__dirname, 'abis', 'EnbMiniApp.json');
const enbMiniApp = JSON.parse(readFileSync(enbMiniAppPath, 'utf8'));
const enbMiniAppAbi = enbMiniApp.abi;

// Load environment variables from .env
dotenv.config();

// === Supabase Initialization ===
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found. Exiting.');
  process.exit(1);
}

// === Blockchain Setup ===
if (!process.env.RPC_URL || !process.env.PRIVATE_KEY || !process.env.CONTRACT_ADDRESS) {
  console.error('❌ Missing RPC_URL, PRIVATE_KEY, or CONTRACT_ADDRESS in .env');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const relayerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, enbMiniAppAbi, relayerWallet);

// === Express Setup ===
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://test-flight-six.vercel.app',
    'https://enb-crushers.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: false,
  maxAge: 86400
}));

// === Helper Functions ===
const generateInvitationCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

const isInvitationCodeUnique = async (code) => {
  const { data, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('invitation_code', code)
    .limit(1);
  
  if (error) throw error;
  return !data || data.length === 0;
};

const generateUniqueInvitationCode = async () => {
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = generateInvitationCode();
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error('Failed to generate unique invitation code after 10 attempts');
    }
  } while (!(await isInvitationCodeUnique(code)));

  return code;
};

// === Routes ===
// Basic route
app.get('/', (req, res) => {
  res.send('ENB API is running.');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Create user account
app.post('/api/create-account', async (req, res) => {
  console.log('📥 Incoming /api/create-account call');
  console.log('Request body:', req.body);

  const { walletAddress, transactionHash } = req.body;

  if (!walletAddress || !transactionHash) {
    console.warn('⚠️ Missing fields', { walletAddress, transactionHash });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log('Generating invitation code for:', walletAddress);
    const invitationCode = await generateUniqueInvitationCode();
    console.log('Generated invitation code:', invitationCode);

    const { error } = await supabase
      .from('accounts')
      .insert({
        wallet_address: walletAddress,
        transaction_hash: transactionHash,
        membership_level: 'Based',
        invitation_code: invitationCode,
        created_at: new Date(),
        last_daily_claim_time: null,
        consecutive_days: 0,
        enb_balance: 0,
        total_earned: 0,
        is_activated: false,
      });

    if (error) throw error;

    console.log('✅ Account created', { walletAddress, invitationCode });
    return res.status(201).json({ message: 'Account created successfully' });
  } catch (error) {
    console.error('❌ Error creating account for', walletAddress, error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
});

// Create default user with limited invitation code
app.post('/api/create-default-user', async (req, res) => {
  const { walletAddress, invitationCode, maxUses } = req.body;

  if (!walletAddress || !invitationCode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if invitation code already exists
    const { data: existingCode, error: checkError } = await supabase
      .from('accounts')
      .select('id')
      .eq('invitation_code', invitationCode)
      .limit(1);

    if (checkError) throw checkError;

    if (existingCode && existingCode.length > 0) {
      return res.status(400).json({ error: 'Invitation code already exists' });
    }

    // Create the default user
    const { error } = await supabase
      .from('accounts')
      .insert({
        wallet_address: walletAddress,
        membership_level: 'Based',
        invitation_code: invitationCode,
        max_invitation_uses: maxUses || 105, // Default to 105 uses
        current_invitation_uses: 0,
        created_at: new Date(),
        last_daily_claim_time: null,
        consecutive_days: 0,
        enb_balance: 0,
        total_earned: 0,
        is_activated: true, // Default user is activated
        activated_at: new Date()
      });

    if (error) throw error;

    return res.status(201).json({ 
      message: 'Default user created successfully',
      invitationCode,
      maxUses: maxUses || 105
    });
  } catch (error) {
    console.error('Error creating default user:', error);
    return res.status(500).json({ error: 'Failed to create default user' });
  }
});

// Activate user account
app.post('/api/activate-account', async (req, res) => {
  const { walletAddress, invitationCode } = req.body;

  if (!walletAddress || !invitationCode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Fetch user account
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (accountError || !accountData) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (accountData.is_activated) {
      return res.status(400).json({ error: 'Account is already activated' });
    }

    // Find the user with the invitation code
    const { data: inviterData, error: inviterError } = await supabase
      .from('accounts')
      .select('*')
      .eq('invitation_code', invitationCode)
      .single();

    if (inviterError || !inviterData) {
      return res.status(400).json({ error: 'Invalid invitation code' });
    }

    // Check if the inviter is activated
    if (!inviterData.is_activated) {
      return res.status(400).json({ error: 'Invitation code is from an inactive account' });
    }

    // Check if invitation code has reached its usage limit
    const maxUses = inviterData.max_invitation_uses || 5; // Default to 5 for regular users
    const currentUses = inviterData.current_invitation_uses || 0;

    if (currentUses >= maxUses) {
      return res.status(400).json({ error: 'Invitation code usage limit exceeded' });
    }

    // Check if this wallet has already used this invitation code
    const { data: existingUsage, error: usageError } = await supabase
      .from('invitation_usage')
      .select('id')
      .eq('invitation_code', invitationCode)
      .eq('used_by', walletAddress)
      .limit(1);

    if (usageError) throw usageError;

    if (existingUsage && existingUsage.length > 0) {
      return res.status(400).json({ error: 'You have already used this invitation code' });
    }

    // Use Supabase transactions for atomic operations
    const { error: transactionError } = await supabase.rpc('activate_account_with_usage', {
      p_wallet_address: walletAddress,
      p_invitation_code: invitationCode,
      p_inviter_wallet: inviterData.wallet_address,
      p_current_uses: currentUses
    });

    if (transactionError) throw transactionError;

    return res.status(200).json({
      message: 'Account activated successfully',
      membershipLevel: accountData.membershipLevel || 'Based',
      inviterWallet: inviterData.walletAddress,
      remainingUses: maxUses - (currentUses + 1)
    });

  } catch (error) {
    console.error('Error activating account:', error);
    return res.status(500).json({ error: 'Failed to activate account' });
  }
});

app.get('/api/profile/:walletAddress', async (req, res) => {
  const walletAddress = req.params.walletAddress;
  
  console.log('📥 Incoming /api/profile call for wallet:', walletAddress);

  try {
    const { data: accountData, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (error || !accountData) {
      console.log('❌ Account not found for wallet:', walletAddress);
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Get invitation usage data if user has an invitation code
    let invitationUsage = null;
    if (accountData.invitation_code) {
      const maxUses = accountData.max_invitation_uses || 5;
      const currentUses = accountData.current_invitation_uses || 0;
      
      invitationUsage = {
        totalUses: currentUses,
        maxUses: maxUses,
        remainingUses: maxUses - currentUses
      };
    }
    
    const profileData = {
      walletAddress: accountData.wallet_address,
      membershipLevel: accountData.membership_level || 'Based',
      invitationCode: accountData.invitation_code || null,
      invitationUsage: invitationUsage,
      enbBalance: accountData.enb_balance || 0,
      lastDailyClaimTime: accountData.last_daily_claim_time ? accountData.last_daily_claim_time.toISOString() : null,
      consecutiveDays: accountData.consecutive_days || 0,
      totalEarned: accountData.total_earned || 0,
      isActivated: accountData.is_activated || false,
      activatedAt: accountData.activated_at ? accountData.activated_at.toISOString() : null,
      joinDate: accountData.created_at ? accountData.created_at.toISOString() : null
    };

    console.log('✅ Profile data retrieved for wallet:', walletAddress, { isActivated: accountData.is_activated, membershipLevel: accountData.membership_level });
    return res.status(200).json(profileData);
  } catch (error) {
    console.error('❌ Error fetching profile for wallet:', walletAddress, error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});


// Updated: Daily claim with smart contract interaction via trusted relayer
app.post('/api/daily-claim', async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: 'Missing or invalid wallet address' });
  }

  try {
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (accountError || !accountData) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!accountData.is_activated) {
      return res.status(400).json({ error: 'Account is not activated' });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Check if user already claimed today
    if (accountData.last_daily_claim_time) {
      const lastClaim = new Date(accountData.last_daily_claim_time);
      const lastClaimDate = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());

      if (lastClaimDate.getTime() === today.getTime()) {
        return res.status(400).json({ error: 'Already claimed today' });
      }
    }

    // Calculate streak & base reward
    let consecutiveDays = 1;
    let enbReward = 10;

    if (accountData.last_daily_claim_time) {
      const lastClaim = new Date(accountData.last_daily_claim_time);
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const lastClaimDate = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());

      if (lastClaimDate.getTime() === yesterday.getTime()) {
        consecutiveDays = (accountData.consecutive_days || 0) + 1;
        const multiplier = Math.min(consecutiveDays, 5);
        enbReward = 10 * multiplier;
      }
    }

    // Apply membership multiplier
    const membershipMultiplier = {
      'Based': 1,
      'Super Based': 1.5,
      'Legendary': 2
    };

    const finalReward = Math.floor(enbReward * (membershipMultiplier[accountData.membership_level] || 1));

    // === Trusted Relayer executes smart contract call ===
    const tx = await contract.dailyClaim(walletAddress);
    await tx.wait();

    // Update Supabase
    const { error: updateError } = await supabase
      .from('accounts')
      .update({
        last_daily_claim_time: now.toISOString(),
        consecutive_days: consecutiveDays,
        enb_balance: (accountData.enb_balance || 0) + finalReward,
        total_earned: (accountData.total_earned || 0) + finalReward,
        last_transaction_hash: tx.hash
      })
      .eq('wallet_address', walletAddress);

    if (updateError) throw updateError;

    // Optional: Log claim
    const { error: claimError } = await supabase
      .from('claims')
      .upsert({
        wallet_address: walletAddress,
        claimed_at: now.toISOString(),
        reward: finalReward,
        consecutive_days: consecutiveDays,
        tx_hash: tx.hash
      });

    if (claimError) console.error('Warning: Failed to log claim:', claimError);

    return res.status(200).json({
      message: 'Daily claim successful via relayer',
      reward: finalReward,
      txHash: tx.hash,
      newBalance: (accountData.enbBalance || 0) + finalReward,
      consecutiveDays
    });

  } catch (error) {
    console.error('Daily claim error:', error);
    return res.status(500).json({ error: 'Failed to process daily claim' });
  }
});

// Get daily claim status
// Daily claim functionality
app.post('/api/daily-claim', async (req, res) => {
  const { walletAddress, transactionHash } = req.body;

  if (!walletAddress || !transactionHash) {
    return res.status(400).json({ error: 'Missing wallet address or transaction hash' });
  }

  try {
    const accountRef = db.collection('accounts').doc(walletAddress);
    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const accountData = accountDoc.data();

    if (!accountData.isActivated) {
      return res.status(400).json({ error: 'Account is not activated' });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Check if user already claimed today
    if (accountData.lastDailyClaimTime) {
      const lastClaim = accountData.lastDailyClaimTime.toDate();
      const lastClaimDate = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());

      if (lastClaimDate.getTime() === today.getTime()) {
        return res.status(400).json({ error: 'Already claimed today' });
      }
    }

    // Calculate consecutive days and rewards
    let consecutiveDays = 1;
    let enbReward = 10; // Base reward

    if (accountData.lastDailyClaimTime) {
      const lastClaim = accountData.lastDailyClaimTime.toDate();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const lastClaimDate = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());

      if (lastClaimDate.getTime() === yesterday.getTime()) {
        consecutiveDays = (accountData.consecutiveDays || 0) + 1;
        const multiplier = Math.min(consecutiveDays, 5);
        enbReward = 10 * multiplier;
      }
    }

    // Membership level bonuses
    const membershipMultiplier = {
      'Based': 1,
      'Super Based': 1.5,
      'Legendary': 2
    };

    const finalReward = Math.floor(enbReward * (membershipMultiplier[accountData.membershipLevel] || 1));

    // Update account with claim info
    await accountRef.update({
      lastDailyClaimTime: now,
      consecutiveDays: consecutiveDays,
      enbBalance: (accountData.enbBalance || 0) + finalReward,
      totalEarned: (accountData.totalEarned || 0) + finalReward,
      lastTransactionHash: transactionHash
    });

    return res.status(200).json({
      message: 'Daily claim successful',
      reward: finalReward,
      consecutiveDays: consecutiveDays,
      newBalance: (accountData.enbBalance || 0) + finalReward
    });

  } catch (error) {
    console.error('Error during daily claim:', error);
    return res.status(500).json({ error: 'Failed to process daily claim' });
  }
});


// Update ENB balance (for transactions)

app.post('/api/update-balance', async (req, res) => {
  const { walletAddress, amount, type, description } = req.body;

  if (!walletAddress || amount === undefined || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['credit', 'debit'].includes(type)) {
    return res.status(400).json({ error: 'Invalid transaction type' });
  }

  try {
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('enb_balance')
      .eq('wallet_address', walletAddress)
      .single();

    if (accountError || !accountData) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const currentBalance = accountData.enb_balance || 0;
    const transactionAmount = parseFloat(amount);

    // Calculate new balance
    let newBalance;
    if (type === 'credit') {
      newBalance = currentBalance + transactionAmount;
    } else {
      if (currentBalance < transactionAmount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      newBalance = currentBalance - transactionAmount;
    }

    // Use Supabase transaction for atomic operations
    const { error: transactionError } = await supabase.rpc('update_balance_with_transaction', {
      p_wallet_address: walletAddress,
      p_new_balance: newBalance,
      p_amount: transactionAmount,
      p_type: type,
      p_description: description || ''
    });

    if (transactionError) throw transactionError;

    return res.status(200).json({
      message: 'Balance updated successfully',
      previousBalance: currentBalance,
      newBalance: newBalance,
      transactionId: transactionRef.id
    });

  } catch (error) {
    console.error('Error updating balance:', error);
    return res.status(500).json({ error: 'Failed to update balance' });
  }
});

// Get transaction history
app.get('/api/transactions/:walletAddress', async (req, res) => {
  const walletAddress = req.params.walletAddress;
  const limit = parseInt(req.query.limit) || 50;

  try {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      walletAddress: tx.wallet_address,
      amount: tx.amount,
      type: tx.type,
      description: tx.description,
      balanceBefore: tx.balance_before,
      balanceAfter: tx.balance_after,
      timestamp: tx.timestamp
    }));

    return res.status(200).json({ transactions: formattedTransactions });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Leaderboard - Top ENB Balance
app.get('/api/leaderboard/balance', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;

  try {
    const { data: leaderboard, error } = await supabase
      .from('accounts')
      .select('wallet_address, enb_balance, membership_level, consecutive_days')
      .eq('is_activated', true)
      .order('enb_balance', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      walletAddress: entry.wallet_address,
      enbBalance: entry.enb_balance || 0,
      membershipLevel: entry.membership_level || 'Based',
      consecutiveDays: entry.consecutive_days || 0
    }));

    return res.status(200).json({ leaderboard: formattedLeaderboard });

  } catch (error) {
    console.error('Error fetching balance leaderboard:', error);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Leaderboard - Top Total Earned
app.get('/api/leaderboard/earnings', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;

  try {
    const { data: leaderboard, error } = await supabase
      .from('accounts')
      .select('wallet_address, total_earned, membership_level, consecutive_days')
      .eq('is_activated', true)
      .order('total_earned', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      walletAddress: entry.wallet_address,
      totalEarned: entry.total_earned || 0,
      membershipLevel: entry.membership_level || 'Based',
      consecutiveDays: entry.consecutive_days || 0
    }));

    return res.status(200).json({ leaderboard: formattedLeaderboard });

  } catch (error) {
    console.error('Error fetching earnings leaderboard:', error);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Leaderboard - Top Consecutive Days
app.get('/api/leaderboard/streaks', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;

  try {
    const { data: leaderboard, error } = await supabase
      .from('accounts')
      .select('wallet_address, consecutive_days, membership_level, enb_balance')
      .eq('is_activated', true)
      .order('consecutive_days', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      walletAddress: entry.wallet_address,
      consecutiveDays: entry.consecutive_days || 0,
      membershipLevel: entry.membership_level || 'Based',
      enbBalance: entry.enb_balance || 0
    }));

    return res.status(200).json({ leaderboard: formattedLeaderboard });

  } catch (error) {
    console.error('Error fetching streaks leaderboard:', error);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get user ranking across all leaderboards
app.get('/api/user-rankings/:walletAddress', async (req, res) => {
  const walletAddress = req.params.walletAddress;

  try {
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (accountError || !accountData) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!accountData.is_activated) {
      return res.status(400).json({ error: 'Account is not activated' });
    }

    // Get balance ranking
    const { count: balanceCount } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('is_activated', true)
      .gt('enb_balance', accountData.enb_balance || 0);
    const balanceRank = (balanceCount || 0) + 1;

    // Get earnings ranking
    const { count: earningsCount } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('is_activated', true)
      .gt('total_earned', accountData.total_earned || 0);
    const earningsRank = (earningsCount || 0) + 1;

    // Get streak ranking
    const { count: streakCount } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('is_activated', true)
      .gt('consecutive_days', accountData.consecutive_days || 0);
    const streakRank = (streakCount || 0) + 1;

    return res.status(200).json({
      walletAddress,
      rankings: {
        balance: {
          rank: balanceRank,
          value: accountData.enbBalance || 0
        },
        earnings: {
          rank: earningsRank,
          value: accountData.totalEarned || 0
        },
        streak: {
          rank: streakRank,
          value: accountData.consecutiveDays || 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user rankings:', error);
    return res.status(500).json({ error: 'Failed to fetch user rankings' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  const membershipLevel = req.query.membershipLevel;
  const isActivated = req.query.isActivated;

  try {
    let query = supabase
      .from('accounts')
      .select('*', { count: 'exact' });

    // Apply filters if provided
    if (membershipLevel) {
      query = query.eq('membership_level', membershipLevel);
    }
    
    if (isActivated !== undefined) {
      query = query.eq('is_activated', isActivated === 'true');
    }

    // Apply ordering and pagination
    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) throw error;

    const formattedUsers = users.map(user => ({
      id: user.id,
      walletAddress: user.wallet_address,
      membershipLevel: user.membership_level || 'Based',
      invitationCode: user.invitation_code || null,
      maxInvitationUses: user.max_invitation_uses || 5,
      currentInvitationUses: user.current_invitation_uses || 0,
      enbBalance: user.enb_balance || 0,
      totalEarned: user.total_earned || 0,
      consecutiveDays: user.consecutive_days || 0,
      isActivated: user.is_activated || false,
      createdAt: user.created_at ? user.created_at.toISOString() : null,
      activatedAt: user.activated_at ? user.activated_at.toISOString() : null,
      lastDailyClaimTime: user.last_daily_claim_time ? user.last_daily_claim_time.toISOString() : null
    }));

    return res.status(200).json({
      users: formattedUsers,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: formattedUsers.length === limit
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Updated: Membership upgrade via smart contract relayer
app.post('/api/update-membership', async (req, res) => {
  const { walletAddress, membershipLevel } = req.body;

  if (!walletAddress || !ethers.isAddress(walletAddress) || !membershipLevel) {
    return res.status(400).json({ error: 'Missing or invalid input fields' });
  }

  // Validate membership level
  const levelMapping = {
    'Based': 0,
    'Super Based': 1,
    'Legendary': 2
  };

  if (!(membershipLevel in levelMapping)) {
    return res.status(400).json({ error: 'Invalid membership level' });
  }

  const targetLevel = levelMapping[membershipLevel];

  try {
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (accountError || !accountData) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!accountData.is_activated) {
      return res.status(400).json({ error: 'Account is not activated' });
    }

    // Call upgradeMembership onchain using relayer
    const tx = await contract.upgradeMembership(walletAddress, targetLevel);
    await tx.wait();

    // Update Supabase
    const { error: updateError } = await supabase
      .from('accounts')
      .update({
        membership_level: membershipLevel,
        last_upgrade_at: new Date().toISOString(),
        upgrade_transaction_hash: tx.hash
      })
      .eq('wallet_address', walletAddress);

    if (updateError) throw updateError;

    // Optional log
    const { error: logError } = await supabase
      .from('upgrades')
      .upsert({
        wallet_address: walletAddress,
        upgraded_at: new Date().toISOString(),
        level: targetLevel,
        tx_hash: tx.hash
      });

    if (logError) console.error('Warning: Failed to log upgrade:', logError);

    return res.status(200).json({
      message: 'Membership level upgraded via relayer',
      newLevel: membershipLevel,
      txHash: tx.hash
    });

  } catch (error) {
    console.error('Error upgrading membership level:', error);
    return res.status(500).json({ error: 'Failed to upgrade membership level' });
  }
});


// Get invitation code usage count
app.get('/api/invitation-usage/:invitationCode', async (req, res) => {
  const invitationCode = req.params.invitationCode;

  if (!invitationCode) {
    return res.status(400).json({ error: 'Invitation code is required' });
  }

  try {
    // Get the inviter's account to check max uses
    const { data: inviterData, error: inviterError } = await supabase
      .from('accounts')
      .select('*')
      .eq('invitation_code', invitationCode)
      .single();

    if (inviterError || !inviterData) {
      return res.status(404).json({ error: 'Invitation code not found' });
    }

    const maxUses = inviterData.max_invitation_uses || 5;
    const currentUses = inviterData.current_invitation_uses || 0;

    // Get detailed usage history
    const { data: usageHistory, error: usageError } = await supabase
      .from('invitation_usage')
      .select('*')
      .eq('invitation_code', invitationCode)
      .order('used_at', { ascending: false });

    if (usageError) throw usageError;

    const formattedUsageHistory = usageHistory.map(usage => ({
      id: usage.id,
      usedBy: usage.used_by,
      usedAt: usage.used_at,
      inviterWallet: usage.inviter_wallet
    }));

          return res.status(200).json({
        invitationCode,
        totalUses: currentUses,
        maxUses: maxUses,
        remainingUses: maxUses - currentUses,
        usageHistory: formattedUsageHistory,
        inviterWallet: inviterData.wallet_address,
        isInviterActivated: inviterData.is_activated || false
      });

  } catch (error) {
    console.error('Error fetching invitation usage:', error);
    return res.status(500).json({ error: 'Failed to fetch invitation usage' });
  }
});


// === Trusted Relayer Routes ===

// Relayed daily claim via smart contract
app.post('/relay/daily-claim', async (req, res) => {
  const { user } = req.body;

  if (!user || !ethers.isAddress(user)) {
    return res.status(400).json({ error: 'Invalid user address' });
  }

  try {
    console.log('🔄 Attempting daily claim for user:', user);
    
    const tx = await contract.dailyClaim(user);
    console.log('✅ Daily claim transaction sent:', tx.hash);
    
    await tx.wait();
    console.log('✅ Daily claim transaction confirmed');

    const { error: claimError } = await supabase
      .from('claims')
      .upsert({
        wallet_address: user,
        last_claimed: new Date().toISOString(),
        tx_hash: tx.hash
      });

    if (claimError) console.error('Warning: Failed to log claim:', claimError);

    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("❌ Relay daily claim error:", err);
    
    // Handle specific custom errors
    if (err.data === '0x786e0a99' || err.info?.error?.data === '0x786e0a99') {
      return res.status(400).json({ 
        error: 'DailyClaimOnCooldown',
        message: 'You can only claim daily rewards once every 24 hours. Please wait until your next claim is available.'
      });
    }
    
    // Handle other common errors
    if (err.code === 'CALL_EXCEPTION') {
      return res.status(400).json({ 
        error: 'ContractError',
        message: 'Transaction failed. This could be due to insufficient funds, account not existing, or other contract restrictions.'
      });
    }
    
    res.status(500).json({ 
      error: 'RelayError',
      message: err.message || 'Failed to process daily claim'
    });
  }
});

// Relayed membership upgrade via smart contract
app.post('/relay/upgrade-membership', async (req, res) => {
  const { user, targetLevel } = req.body;

  if (!user || !ethers.isAddress(user)) {
    return res.status(400).json({ error: 'Invalid user address' });
  }

  if (![1, 2].includes(targetLevel)) {
    return res.status(400).json({ error: 'Invalid membership level (must be 1 or 2)' });
  }

  try {
    const tx = await contract.upgradeMembership(user, targetLevel);
    await tx.wait();

    const { error: upgradeError } = await supabase
      .from('upgrades')
      .upsert({
        wallet_address: user,
        upgraded_at: new Date().toISOString(),
        level: targetLevel,
        tx_hash: tx.hash
      });

    if (upgradeError) console.error('Warning: Failed to log upgrade:', upgradeError);

    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("Relay upgrade error:", err);
    res.status(500).json({ error: err.message });
  }
});


// === Start Server ===
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
