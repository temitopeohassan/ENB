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

// Load InviteAirdrop ABI
const inviteAirdropPath = join(__dirname, 'abis', 'InviteAirdrop.json');
const inviteAirdrop = JSON.parse(readFileSync(inviteAirdropPath, 'utf8'));
const inviteAirdropAbi = inviteAirdrop.abi;

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

// Check for airdrop contract configuration
if (!process.env.AIRDROP_CONTRACT_ADDRESS) {
  console.error('❌ Missing AIRDROP_CONTRACT_ADDRESS in .env');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const relayerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, enbMiniAppAbi, relayerWallet);

// Initialize airdrop contract with proper ABI
const airdropContract = new ethers.Contract(
  process.env.AIRDROP_CONTRACT_ADDRESS,
  inviteAirdropAbi,
  relayerWallet
);

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

// Helper function to decode custom errors from EnbMiniAppUpgradeable contract
const decodeCustomError = (errorData) => {
  const errorMap = {
    '0x786e0a99': 'DailyClaimOnCooldown',
    '0x9dca362f': 'AccountDoesNotExist',
    '0x5c975abb': 'EnforcedPause',
    '0x0905f560': 'EmergencyModeActive',
    '0x15db5d7c': 'InvalidMembershipLevel',
    '0x8f83ab13': 'OnlyRelayerAllowed',
    '0x4e487b71': 'AccountAlreadyExists',
    '0x8f83ab13': 'AlreadyAtMaxLevel',
    '0x8f83ab13': 'CannotSkipLevels'
  };
  
  return errorMap[errorData] || 'UnknownCustomError';
};

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

// Helper function to handle airdrop when invitation usage reaches threshold
const handleInviteAirdrop = async (inviterWalletAddress) => {
  try {
    console.log('🎁 Processing airdrop for inviter:', inviterWalletAddress);
    
    // Check current usage BEFORE calling recordInviteUse
    const currentUses = await airdropContract.inviteUses(inviterWalletAddress);
    const threshold = await airdropContract.THRESHOLD();
    const isRewarded = await airdropContract.rewarded(inviterWalletAddress);
    
    console.log('📊 Pre-check airdrop status:', {
      currentUses: currentUses.toString(),
      threshold: threshold.toString(),
      isRewarded: isRewarded
    });
    
    // Only proceed if threshold is reached and user hasn't been rewarded yet
    if (Number(currentUses) >= Number(threshold) && !isRewarded) {
      console.log('🎯 Threshold reached! Triggering airdrop...');
      
      // Record the invite use on the airdrop contract
      const tx = await airdropContract.recordInviteUse(inviterWalletAddress);
      console.log('📝 Airdrop transaction sent:', tx.hash);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log('✅ Airdrop transaction confirmed in block:', receipt.blockNumber);
      
      // Verify the airdrop was successful
      const newUses = await airdropContract.inviteUses(inviterWalletAddress);
      const newIsRewarded = await airdropContract.rewarded(inviterWalletAddress);
      const rewardAmount = await airdropContract.REWARD_AMOUNT();
      
      console.log('📊 Post-airdrop status:', {
        newUses: newUses.toString(),
        threshold: threshold.toString(),
        newIsRewarded: newIsRewarded,
        rewardAmount: ethers.formatEther(rewardAmount)
      });
      
      if (newIsRewarded) {
        console.log('🎉 Airdrop triggered successfully! 25 ENB sent to:', inviterWalletAddress);
        
        // Log the airdrop in the database
        const { error: airdropLogError } = await supabase
          .from('airdrops')
          .insert({
            wallet_address: inviterWalletAddress,
            amount: ethers.formatEther(rewardAmount),
            triggered_at: new Date().toISOString(),
            tx_hash: tx.hash,
            invitation_uses_at_trigger: newUses.toString()
          });
        
        if (airdropLogError) {
          console.error('Warning: Failed to log airdrop:', airdropLogError);
        }
        
        return {
          success: true,
          airdropTriggered: true,
          rewardAmount: ethers.formatEther(rewardAmount),
          txHash: tx.hash,
          currentUses: newUses.toString(),
          threshold: threshold.toString()
        };
      } else {
        console.log('⚠️ Airdrop transaction succeeded but user not marked as rewarded');
        return {
          success: false,
          airdropTriggered: false,
          error: 'Airdrop transaction succeeded but reward not processed',
          currentUses: newUses.toString(),
          threshold: threshold.toString()
        };
      }
    } else {
      console.log('⏳ Threshold not reached yet or already rewarded:', {
        currentUses: currentUses.toString(),
        threshold: threshold.toString(),
        isRewarded: isRewarded
      });
      
      return {
        success: true,
        airdropTriggered: false,
        currentUses: currentUses.toString(),
        threshold: threshold.toString(),
        reason: isRewarded ? 'Already rewarded' : 'Threshold not reached'
      };
    }
    
  } catch (error) {
    console.error('❌ Airdrop error:', error);
    throw error;
  }
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
        has_seen_tips: false,
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
        activated_at: new Date(),
        has_seen_tips: false,
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

    // Process airdrop for the inviter
    let airdropResult = null;
    try {
      airdropResult = await handleInviteAirdrop(inviterData.wallet_address);
      
      // If airdrop was triggered, reset the invitation usage counter
      if (airdropResult.airdropTriggered) {
        const { error: resetError } = await supabase
          .from('accounts')
          .update({ current_invitation_uses: 0 })
          .eq('wallet_address', inviterData.wallet_address);
        
        if (resetError) {
          console.error('Warning: Failed to reset invitation usage counter:', resetError);
        } else {
          console.log('🔄 Reset invitation usage counter for:', inviterData.wallet_address);
        }
      }
    } catch (airdropError) {
      console.error('Warning: Airdrop processing failed:', airdropError);
      // Continue with account activation even if airdrop fails
    }

    return res.status(200).json({
      message: 'Account activated successfully',
      membershipLevel: accountData.membershipLevel || 'Based',
      inviterWallet: inviterData.walletAddress,
      remainingUses: maxUses - (currentUses + 1),
      airdrop: airdropResult
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
      lastDailyClaimTime: accountData.last_daily_claim_time ? new Date(accountData.last_daily_claim_time).toISOString() : null,
      consecutiveDays: accountData.consecutive_days || 0,
      totalEarned: accountData.total_earned || 0,
      isActivated: accountData.is_activated || false,
      activatedAt: accountData.activated_at ? new Date(accountData.activated_at).toISOString() : null,
      joinDate: accountData.created_at ? new Date(accountData.created_at).toISOString() : null
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
      newBalance: (accountData.enb_balance || 0) + finalReward,
      consecutiveDays
    });

  } catch (error) {
    console.error('Daily claim error:', error);
    return res.status(500).json({ error: 'Failed to process daily claim' });
  }
});

// Get daily claim status

// Daily claim status endpoint
app.get('/api/daily-claim-status/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;

  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  try {
    // Get account data from database
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('last_daily_claim_time, is_activated, created_at')
      .eq('wallet_address', walletAddress)
      .single();

    if (accountError || !accountData) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!accountData.is_activated) {
      return res.status(400).json({ error: 'Account not activated' });
    }

    // Debug: Log raw database response
    console.log('📊 Raw database response:', {
      walletAddress,
      accountData,
      lastDailyClaimTime: accountData.last_daily_claim_time,
      isActivated: accountData.is_activated,
      createdAt: accountData.created_at
    });

    // Check claims table for additional debugging
    const { data: claimsData, error: claimsError } = await supabase
      .from('claims')
      .select('claimed_at, tx_hash')
      .eq('wallet_address', walletAddress)
      .order('claimed_at', { ascending: false });

    if (claimsError) {
      console.error('❌ Error querying claims table:', claimsError);
    } else {
      console.log('📊 Claims table data:', {
        walletAddress,
        claimsCount: claimsData.length,
        claims: claimsData
      });
      
      // Check for data inconsistency: if there are claims but last_daily_claim_time is null
      if (claimsData.length > 0 && !accountData.last_daily_claim_time) {
        console.warn('⚠️ Data inconsistency detected: claims exist but last_daily_claim_time is null');
        console.warn('This suggests the relayer endpoint failed to update the accounts table');
        
        // Use the most recent claim time as the last claim time
        const mostRecentClaim = new Date(claimsData[0].claimed_at);
        console.log('🔄 Using most recent claim time as last claim time:', mostRecentClaim.toISOString());
        
        // Update the accounts table to fix the inconsistency
        const { error: updateError } = await supabase
          .from('accounts')
          .update({
            last_daily_claim_time: mostRecentClaim.toISOString()
          })
          .eq('wallet_address', walletAddress);
        
        if (updateError) {
          console.error('❌ Failed to fix data inconsistency:', updateError);
        } else {
          console.log('✅ Fixed data inconsistency in accounts table');
          // Update our local variable
          accountData.last_daily_claim_time = mostRecentClaim.toISOString();
        }
      }
    }

    // Check smart contract state for additional validation
    let smartContractCanClaim = null;
    let smartContractLastClaimTime = null;
    
    try {
      console.log('🔍 Checking smart contract state...');
      console.log('📊 Contract address:', process.env.CONTRACT_ADDRESS);
      console.log('📊 Contract object:', contract ? 'exists' : 'null');
      
      // Check if user account exists in smart contract
      const userAccount = await contract.userAccounts(walletAddress);
      console.log('📊 User account from contract:', userAccount);
      
      if (userAccount.exists) {
        // Get last claim time from smart contract
        smartContractLastClaimTime = userAccount.lastDailyClaimTime;
        console.log('📊 Smart contract data:', {
          exists: userAccount.exists,
          lastDailyClaimTime: smartContractLastClaimTime.toString(),
          lastDailyClaimTimeDate: new Date(Number(smartContractLastClaimTime) * 1000).toISOString()
        });
        
        // Check if user can claim according to smart contract
        const now = Math.floor(Date.now() / 1000); // Current time in seconds
        const cooldownPeriod = 24 * 60 * 60; // 24 hours in seconds
        const timeSinceLastClaim = now - Number(smartContractLastClaimTime);
        
        smartContractCanClaim = timeSinceLastClaim >= cooldownPeriod;
        
        console.log('🔍 Smart contract eligibility check:', {
          now,
          lastClaimTime: Number(smartContractLastClaimTime),
          timeSinceLastClaim,
          cooldownPeriod,
          smartContractCanClaim
        });
        
        // If smart contract shows user can't claim, but database shows they can, update database
        if (!smartContractCanClaim && smartContractLastClaimTime > 0) {
          const smartContractLastClaimDate = new Date(Number(smartContractLastClaimTime) * 1000);
          console.log('🔄 Smart contract shows user cannot claim. Updating database with smart contract data...');
          
          const { error: updateError } = await supabase
            .from('accounts')
            .update({
              last_daily_claim_time: smartContractLastClaimDate.toISOString()
            })
            .eq('wallet_address', walletAddress);
          
          if (updateError) {
            console.error('❌ Failed to update database with smart contract data:', updateError);
          } else {
            console.log('✅ Updated database with smart contract data');
            // Update our local variable
            accountData.last_daily_claim_time = smartContractLastClaimDate.toISOString();
          }
        }
      } else {
        console.log('⚠️ User account does not exist in smart contract');
      }
    } catch (contractError) {
      console.error('❌ Error checking smart contract state:', contractError);
      console.error('❌ Contract error details:', {
        message: contractError.message,
        code: contractError.code,
        data: contractError.data,
        reason: contractError.reason
      });
      console.log('⚠️ Proceeding with database-only logic');
    }
    
    const now = new Date();
    const lastClaimTime = accountData.last_daily_claim_time ? new Date(accountData.last_daily_claim_time) : null;
    const accountCreatedAt = accountData.created_at ? new Date(accountData.created_at) : now;
    
    // Debug logging
    console.log('🔍 Daily claim status debug:', {
      walletAddress,
      lastClaimTime: lastClaimTime?.toISOString(),
      accountCreatedAt: accountCreatedAt.toISOString(),
      now: now.toISOString(),
      isFirstTimeUser: !lastClaimTime,
      timeSinceCreation: now.getTime() - accountCreatedAt.getTime(),
      timeSinceLastClaim: lastClaimTime ? now.getTime() - lastClaimTime.getTime() : 0,
      rawLastClaimTime: accountData.last_daily_claim_time,
      rawCreatedAt: accountData.created_at
    });
    
    // Calculate next claim time and eligibility
    let nextClaimTime, canClaim, timeRemaining, timeLeft;
    
    if (!lastClaimTime) {
      // No previous claim - calculate from account creation time
      const timeSinceAccountCreation = now.getTime() - accountCreatedAt.getTime();
      const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours
      
      if (timeSinceAccountCreation >= cooldownPeriod) {
        // Account is old enough - can claim immediately
        canClaim = true;
        nextClaimTime = now;
        timeRemaining = 0;
        timeLeft = { hours: 0, minutes: 0, seconds: 0 };
      } else {
        // Account is too new - calculate time until first claim
        const timeUntilFirstClaim = cooldownPeriod - timeSinceAccountCreation;
        nextClaimTime = new Date(accountCreatedAt.getTime() + cooldownPeriod);
        timeRemaining = timeUntilFirstClaim;
        canClaim = false; // Can't claim yet, account too new
        
        const totalSeconds = Math.floor(timeUntilFirstClaim / 1000);
        timeLeft = {
          hours: Math.floor(totalSeconds / 3600),
          minutes: Math.floor((totalSeconds % 3600) / 60),
          seconds: totalSeconds % 60
        };
      }
    } else {
      // Calculate next claim time (24 hours from last claim)
      nextClaimTime = new Date(lastClaimTime.getTime() + (24 * 60 * 60 * 1000));
      timeRemaining = nextClaimTime.getTime() - now.getTime();
      
      // Check if user can claim (24 hours have passed)
      canClaim = timeRemaining <= 0;
      
      // Calculate time left components
      if (!canClaim && timeRemaining > 0) {
        const totalSeconds = Math.floor(timeRemaining / 1000);
        timeLeft = {
          hours: Math.floor(totalSeconds / 3600),
          minutes: Math.floor((totalSeconds % 3600) / 60),
          seconds: totalSeconds % 60
        };
      } else {
        timeLeft = { hours: 0, minutes: 0, seconds: 0 };
      }
    }

    // Calculate additional metadata for better countdown
    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const timeSinceLastClaim = lastClaimTime ? now.getTime() - lastClaimTime.getTime() : 0;
    
    // Calculate when the user will be eligible next (for countdown display)
    let eligibilityTime;
    if (lastClaimTime) {
      // User has claimed before - next eligibility is 24 hours from last claim
      eligibilityTime = new Date(lastClaimTime.getTime() + cooldownPeriod);
    } else {
      // First-time user - eligibility is 24 hours from account creation
      eligibilityTime = new Date(accountCreatedAt.getTime() + cooldownPeriod);
    }
    
    // Ensure eligibility time is always in the future
    if (eligibilityTime <= now) {
      // If eligibility time is in the past, user can claim now
      canClaim = true;
      eligibilityTime = now;
    }
    
    // Calculate time until eligibility (more accurate than nextClaimTime)
    let timeUntilEligibility = Math.max(0, eligibilityTime.getTime() - now.getTime());
    
    // Calculate progress percentage
    let progressToNextClaim;
    if (lastClaimTime) {
      // For returning users, progress is based on time since last claim
      progressToNextClaim = Math.min(100, (timeSinceLastClaim / cooldownPeriod) * 100);
    } else {
      // For first-time users, progress is based on time since account creation
      const timeSinceCreation = now.getTime() - accountCreatedAt.getTime();
      progressToNextClaim = Math.min(100, (timeSinceCreation / cooldownPeriod) * 100);
    }
    
    // Ensure progress is logical
    if (canClaim) {
      progressToNextClaim = 100;
    }
    
    // Ensure timeLeft is consistent with canClaim status
    if (canClaim) {
      timeLeft = { hours: 0, minutes: 0, seconds: 0 };
    }
    
    // Final validation - ensure all data is consistent
    if (canClaim) {
      // If user can claim, ensure all countdown data reflects this
      timeUntilEligibility = 0;
      progressToNextClaim = 100;
    }
    
    // Ensure eligibility time is never in the past when user can't claim
    if (!canClaim && eligibilityTime <= now) {
      console.warn('⚠️ Warning: eligibility time is in the past but user cannot claim. Adjusting...');
      eligibilityTime = new Date(now.getTime() + cooldownPeriod);
    }
    
    // Final sanity check - ensure canClaim and timeUntilEligibility are consistent
    if (canClaim && timeUntilEligibility > 0) {
      console.warn('⚠️ Inconsistency detected: canClaim is true but timeUntilEligibility > 0. Fixing...');
      timeUntilEligibility = 0;
    }
    
    if (!canClaim && timeUntilEligibility === 0) {
      console.warn('⚠️ Inconsistency detected: canClaim is false but timeUntilEligibility is 0. Fixing...');
      canClaim = true;
    }
    
    // Format time components for eligibility countdown
    const eligibilityCountdown = {
      totalSeconds: Math.floor(timeUntilEligibility / 1000),
      hours: Math.floor(timeUntilEligibility / (60 * 60 * 1000)),
      minutes: Math.floor((timeUntilEligibility % (60 * 60 * 1000)) / (60 * 1000)),
      seconds: Math.floor((timeUntilEligibility % (60 * 1000)) / 1000)
    };

    return res.json({
      canClaim,
      timeLeft,
      nextClaimTime: nextClaimTime.toISOString(),
      lastClaimTime: lastClaimTime ? lastClaimTime.toISOString() : null,
      
      // Enhanced countdown information
      countdown: {
        timeUntilEligibility: timeUntilEligibility,
        eligibilityTime: eligibilityTime.toISOString(),
        countdownComponents: eligibilityCountdown,
        progress: progressToNextClaim,
        cooldownPeriod: cooldownPeriod,
        timeSinceLastClaim: timeSinceLastClaim
      },
      
      // Additional metadata
      metadata: {
        accountCreatedAt: accountCreatedAt.toISOString(),
        isFirstTimeUser: !lastClaimTime,
        totalDaysSinceCreation: Math.floor((now.getTime() - accountCreatedAt.getTime()) / (24 * 60 * 60 * 1000)),
        cooldownHours: 24,
        cooldownMinutes: 24 * 60,
        cooldownSeconds: 24 * 60 * 60
      },
      
      // Debug information
      debug: {
        lastClaimTimeFromDB: accountData.last_daily_claim_time,
        lastClaimTimeParsed: lastClaimTime?.toISOString(),
        accountCreatedAtFromDB: accountData.created_at,
        accountCreatedAtParsed: accountCreatedAt.toISOString(),
        currentTime: now.toISOString(),
        timeSinceCreationMs: now.getTime() - accountCreatedAt.getTime(),
        timeSinceLastClaimMs: lastClaimTime ? now.getTime() - lastClaimTime.getTime() : 0,
        cooldownPeriodMs: cooldownPeriod,
        eligibilityTimeMs: eligibilityTime.getTime(),
        timeUntilEligibilityMs: timeUntilEligibility,
        claimsCount: claimsData?.length || 0,
        mostRecentClaim: claimsData?.[0]?.claimed_at || null,
        dataInconsistencyFixed: claimsData?.length > 0 && !accountData.last_daily_claim_time,
        smartContractValidation: {
          checked: smartContractCanClaim !== null,
          canClaim: smartContractCanClaim,
          lastClaimTime: smartContractLastClaimTime ? Number(smartContractLastClaimTime) * 1000 : null,
          lastClaimTimeDate: smartContractLastClaimTime ? new Date(Number(smartContractLastClaimTime) * 1000).toISOString() : null
        }
      }
    });

  } catch (error) {
    console.error('Error checking daily claim status:', error);
    return res.status(500).json({ error: 'Failed to check daily claim status' });
  }
});

// Has seen tips endpoint
app.get('/api/has-seen-tips/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;

  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  try {
    // Get account data from database
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('has_seen_tips, is_activated')
      .eq('wallet_address', walletAddress)
      .single();

    if (accountError || !accountData) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!accountData.is_activated) {
      return res.status(400).json({ error: 'Account not activated' });
    }

    return res.json({
      hasSeenTips: accountData.has_seen_tips || false
    });

  } catch (error) {
    console.error('Error checking has seen tips status:', error);
    return res.status(500).json({ error: 'Failed to check has seen tips status' });
  }
});

// Mark tips as seen endpoint
app.post('/api/mark-tips-seen/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;

  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  try {
    // Update account to mark tips as seen
    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update({ 
        has_seen_tips: true,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress)
      .eq('is_activated', true)
      .select('has_seen_tips')
      .single();

    if (updateError || !updatedAccount) {
      return res.status(404).json({ error: 'Account not found or not activated' });
    }

    return res.json({
      success: true,
      hasSeenTips: updatedAccount.has_seen_tips,
      message: 'Tips marked as seen successfully'
    });

  } catch (error) {
    console.error('Error marking tips as seen:', error);
    return res.status(500).json({ error: 'Failed to mark tips as seen' });
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

// Check daily claim eligibility using EnbMiniAppUpgradeable contract
app.get('/relay/daily-claim-status/:user', async (req, res) => {
  const { user } = req.params;

  if (!user || !ethers.isAddress(user)) {
    return res.status(400).json({ error: 'Invalid user address' });
  }

  try {
    console.log('🔍 Checking daily claim status for user:', user);
    
    // Get user account info from the smart contract
    const userAccount = await contract.userAccounts(user);
    
    if (!userAccount.exists) {
      return res.json({ 
        canClaim: false,
        reason: 'AccountDoesNotExist',
        message: 'Account does not exist. Please create an account first.'
      });
    }
    
    // Check if contract is paused
    const isPaused = await contract.paused();
    if (isPaused) {
      return res.json({ 
        canClaim: false,
        reason: 'ContractPaused',
        message: 'Contract is currently paused. Please try again later.'
      });
    }
    
    // Check if emergency mode is active
    const isEmergencyMode = await contract.emergencyMode();
    if (isEmergencyMode) {
      return res.json({ 
        canClaim: false,
        reason: 'EmergencyModeActive',
        message: 'Contract is in emergency mode. Please try again later.'
      });
    }
    
    // Get cooldown period from contract
    const cooldownPeriod = await contract.DAILY_CLAIM_COOLDOWN();
    const lastClaimTime = Number(userAccount.lastDailyClaimTime);
    const cooldownSeconds = Number(cooldownPeriod);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceLastClaim = currentTime - lastClaimTime;
    const timeRemaining = cooldownSeconds - timeSinceLastClaim;
    
    const canClaim = timeSinceLastClaim >= cooldownSeconds;
    
    return res.json({
      canClaim,
      userAccount: {
        lastDailyClaimTime: lastClaimTime,
        accountCreatedAt: userAccount.accountCreatedAt,
        totalDailyClaims: userAccount.totalDailyClaims,
        totalYieldClaimed: userAccount.totalYieldClaimed,
        membershipLevel: userAccount.membershipLevel
      },
      cooldownInfo: {
        cooldownPeriod: cooldownPeriod.toString(),
        timeSinceLastClaim: timeSinceLastClaim,
        timeRemaining: canClaim ? 0 : timeRemaining
      },
      reason: canClaim ? null : 'DailyClaimOnCooldown',
      message: canClaim ? 'Ready to claim daily rewards!' : `Please wait ${Math.ceil(timeRemaining / 3600)} hours before next claim.`
    });
    
  } catch (err) {
    console.error("❌ Error checking daily claim status:", err);
    res.status(500).json({ 
      error: 'StatusCheckError',
      message: err.message || 'Failed to check daily claim status'
    });
  }
});

// Relayed daily claim via EnbMiniAppUpgradeable smart contract
app.post('/relay/daily-claim', async (req, res) => {
  const { user } = req.body;

  if (!user || !ethers.isAddress(user)) {
    return res.status(400).json({ error: 'Invalid user address' });
  }

  try {
    console.log('🔄 Attempting daily claim for user:', user);
    
    // Check if user account exists first
    try {
      const userAccount = await contract.userAccounts(user);
      if (!userAccount.exists) {
        return res.status(400).json({ 
          error: 'AccountDoesNotExist',
          message: 'Account does not exist. Please create an account first.'
        });
      }
      
      // Check if contract is paused
      const isPaused = await contract.paused();
      if (isPaused) {
        return res.status(400).json({ 
          error: 'ContractPaused',
          message: 'Contract is currently paused. Please try again later.'
        });
      }
      
      // Check if emergency mode is active
      const isEmergencyMode = await contract.emergencyMode();
      if (isEmergencyMode) {
        return res.status(400).json({ 
          error: 'EmergencyModeActive',
          message: 'Contract is in emergency mode. Please try again later.'
        });
      }
      
      console.log('✅ Pre-flight checks passed for user:', user);
    
      // Additional debugging: Try to estimate gas to see if there are hidden issues
      try {
        console.log('🔍 Estimating gas for dailyClaim transaction...');
        const gasEstimate = await contract.dailyClaim.estimateGas(user);
        console.log('✅ Gas estimate successful:', gasEstimate.toString());
      } catch (gasError) {
        console.error('❌ Gas estimation failed:', gasError);
        console.error('Gas error details:', {
          code: gasError.code,
          data: gasError.data,
          reason: gasError.reason,
          shortMessage: gasError.shortMessage
        });
        
        // If gas estimation fails, return the error instead of proceeding
        if (gasError.data === '0x786e0a99') {
          return res.status(400).json({ 
            error: 'DailyClaimOnCooldown',
            message: 'You can only claim daily rewards once every 24 hours. Please wait until your next claim is available.',
            errorCode: '0x786e0a99'
          });
        }
        
        // Check for other known error codes
        if (gasError.data === '0xf1cd8460') {
          return res.status(400).json({ 
            error: 'DailyClaimOnCooldown',
            message: 'You can only claim daily rewards once every 24 hours. Please wait until your next claim is available.',
            errorCode: '0xf1cd8460',
            details: 'Smart contract validation failed - user is still on cooldown'
          });
        }
        
        return res.status(400).json({ 
          error: 'GasEstimationError',
          message: 'Failed to estimate gas for transaction. This indicates a contract state issue.',
          details: gasError.message,
          errorCode: gasError.data
        });
      }
    } catch (checkError) {
      console.warn('⚠️ Pre-flight check failed, proceeding with transaction:', checkError.message);
    }
    
    console.log('🚀 Executing dailyClaim transaction for user:', user);
    const tx = await contract.dailyClaim(user);
    console.log('✅ Daily claim transaction sent:', tx.hash);
    
    console.log('⏳ Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    console.log('✅ Daily claim transaction confirmed in block:', receipt.blockNumber);
    console.log('📊 Gas used:', receipt.gasUsed.toString());

    // Get current account data to calculate consecutive days
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('consecutive_days, last_daily_claim_time')
      .eq('wallet_address', user)
      .single();

    if (accountError) {
      console.error('❌ Failed to fetch account data:', accountError);
      // Continue with default values if we can't fetch account data
    } else {
      console.log('📊 Current account data:', {
        wallet_address: user,
        current_consecutive_days: accountData?.consecutive_days || 0,
        last_daily_claim_time: accountData?.last_daily_claim_time
      });
    }

    // Calculate consecutive days logic
    let newConsecutiveDays = 1; // Default to 1 for first claim
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (accountData && accountData.last_daily_claim_time) {
      const lastClaim = new Date(accountData.last_daily_claim_time);
      const lastClaimDate = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      console.log('📅 Date calculations:', {
        today: today.toISOString(),
        yesterday: yesterday.toISOString(),
        lastClaimDate: lastClaimDate.toISOString(),
        lastClaimTimestamp: lastClaim.getTime(),
        yesterdayTimestamp: yesterday.getTime(),
        todayTimestamp: today.getTime()
      });

      // Check if last claim was yesterday (allowing for small time differences)
      if (lastClaimDate.getTime() === yesterday.getTime()) {
        // Streak continues - increment consecutive days
        newConsecutiveDays = (accountData.consecutive_days || 0) + 1;
        console.log(`🔥 Streak continues! New consecutive days: ${newConsecutiveDays}`);
      } else if (lastClaimDate.getTime() === today.getTime()) {
        // User already claimed today (shouldn't happen with smart contract, but safety check)
        console.log('⚠️ User already claimed today, resetting consecutive days');
        newConsecutiveDays = 1;
      } else {
        // Streak broken - reset to 1
        console.log('💔 Streak broken, resetting consecutive days to 1');
        newConsecutiveDays = 1;
      }
    } else {
      // First time claiming
      console.log('🎉 First daily claim! Starting streak at 1');
      newConsecutiveDays = 1;
    }

    console.log(`🎯 Final consecutive days calculation: ${newConsecutiveDays}`);

    // Log the claim in database with consecutive days
    const { error: claimError } = await supabase
      .from('claims')
      .upsert({
        wallet_address: user,
        claimed_at: now.toISOString(),
        reward: 0, // Add default reward value since it's required by schema
        consecutive_days: newConsecutiveDays,
        tx_hash: tx.hash
      });

    if (claimError) {
      console.error('❌ Failed to log claim:', claimError);
      console.error('Claim insert details:', {
        wallet_address: user,
        claimed_at: now.toISOString(),
        reward: 0,
        consecutive_days: newConsecutiveDays,
        tx_hash: tx.hash
      });
    } else {
      console.log(`✅ Claim logged with consecutive days: ${newConsecutiveDays}`);
    }

    // Update the accounts table with new consecutive days and last claim time
    const updateData = {
      last_daily_claim_time: now.toISOString(),
      consecutive_days: newConsecutiveDays
    };
    
    console.log('🔄 Updating accounts table with data:', {
      wallet_address: user,
      update_data: updateData
    });
    
    const { error: updateError } = await supabase
      .from('accounts')
      .update(updateData)
      .eq('wallet_address', user);

    if (updateError) {
      console.error('❌ Failed to update accounts table:', updateError);
      console.error('Update details:', {
        table: 'accounts',
        wallet_address: user,
        update_data: updateData,
        error: updateError
      });
      // Don't fail the request, but log the error
    } else {
      console.log(`✅ Successfully updated accounts table for user: ${user}, new consecutive days: ${newConsecutiveDays}`);
      
      // Verify the update by fetching the updated data
      const { data: verifyData, error: verifyError } = await supabase
        .from('accounts')
        .select('consecutive_days, last_daily_claim_time')
        .eq('wallet_address', user)
        .single();
        
      if (verifyError) {
        console.error('❌ Failed to verify account update:', verifyError);
      } else {
        console.log('✅ Verification - Updated account data:', {
          wallet_address: user,
          consecutive_days: verifyData.consecutive_days,
          last_daily_claim_time: verifyData.last_daily_claim_time
        });
      }
    }

    res.json({ 
      success: true, 
      txHash: tx.hash,
      consecutiveDays: newConsecutiveDays,
      message: newConsecutiveDays === 1 ? 'Daily claim successful! Starting your streak.' : `Daily claim successful! Your streak is now ${newConsecutiveDays} days!`
    });
  } catch (err) {
    console.error("❌ Relay daily claim error:", err);
    
    // Log detailed error information for debugging
    console.error("Error details:", {
      code: err.code,
      data: err.data,
      reason: err.reason,
      shortMessage: err.shortMessage,
      action: err.action,
      info: err.info
    });
    
    // Handle specific custom errors from EnbMiniAppUpgradeable contract
    if (err.data === '0x786e0a99' || err.info?.error?.data === '0x786e0a99') {
      console.log("✅ Detected DailyClaimOnCooldown error");
      return res.status(400).json({ 
        error: 'DailyClaimOnCooldown',
        message: 'You can only claim daily rewards once every 24 hours. Please wait until your next claim is available.',
        errorCode: '0x786e0a99'
      });
    }
    
    // Handle other common errors
    if (err.code === 'CALL_EXCEPTION') {
      // Check for specific custom error data
      const errorData = err.data || err.info?.error?.data;
      
      if (errorData === '0x786e0a99') {
        console.log("✅ Detected DailyClaimOnCooldown error via CALL_EXCEPTION");
        return res.status(400).json({ 
          error: 'DailyClaimOnCooldown',
          message: 'You can only claim daily rewards once every 24 hours. Please wait until your next claim is available.',
          errorCode: '0x786e0a99'
        });
      }
      
      // Check for other known custom errors from EnbMiniAppUpgradeable
      if (errorData === '0x9dca362f') { // AccountDoesNotExist
        console.log("✅ Detected AccountDoesNotExist error");
        return res.status(400).json({ 
          error: 'AccountDoesNotExist',
          message: 'Account does not exist. Please create an account first.',
          errorCode: '0x9dca362f'
        });
      }
      
      if (errorData === '0x5c975abb') { // EnforcedPause
        console.log("✅ Detected EnforcedPause error");
        return res.status(400).json({ 
          error: 'ContractPaused',
          message: 'Contract is currently paused. Please try again later.',
          errorCode: '0x5c975abb'
        });
      }
      
      if (errorData === '0x0905f560') { // EmergencyModeActive
        console.log("✅ Detected EmergencyModeActive error");
        return res.status(400).json({ 
          error: 'EmergencyModeActive',
          message: 'Contract is in emergency mode. Please try again later.',
          errorCode: '0x0905f560'
        });
      }
      
      // Handle gas estimation errors specifically
      if (err.action === 'estimateGas') {
        console.log("✅ Detected gas estimation error");
        return res.status(400).json({ 
          error: 'GasEstimationError',
          message: 'Failed to estimate gas for transaction. This usually indicates a contract state issue.',
          errorCode: err.code,
          errorData: errorData,
          action: err.action
        });
      }
      
      return res.status(400).json({ 
        error: 'ContractError',
        message: 'Transaction failed. This could be due to insufficient funds, account not existing, or other contract restrictions.',
        details: errorData ? `Error code: ${errorData}` : 'Unknown error',
        errorCode: err.code,
        errorData: errorData
      });
    }
    
    // Handle other specific error types
    if (err.code === 'INSUFFICIENT_FUNDS') {
      console.log("✅ Detected INSUFFICIENT_FUNDS error");
      return res.status(400).json({ 
        error: 'InsufficientFunds',
        message: 'Relayer wallet has insufficient funds to process this transaction.',
        errorCode: err.code
      });
    }
    
    if (err.code === 'NONCE_EXPIRED') {
      console.log("✅ Detected NONCE_EXPIRED error");
      return res.status(400).json({ 
        error: 'NonceExpired',
        message: 'Transaction nonce is too low. Please try again.',
        errorCode: err.code
      });
    }
    
    res.status(500).json({ 
      error: 'RelayError',
      message: err.message || 'Failed to process daily claim',
      errorCode: err.code,
      errorData: err.data
    });
  }
});

// Relayed membership upgrade via EnbMiniAppUpgradeable smart contract
app.post('/relay/upgrade-membership', async (req, res) => {
  const { user, targetLevel } = req.body;

  if (!user || !ethers.isAddress(user)) {
    return res.status(400).json({ error: 'Invalid user address' });
  }

  if (![1, 2].includes(targetLevel)) {
    return res.status(400).json({ error: 'Invalid membership level (must be 1 or 2)' });
  }

  try {
    console.log('🔄 Upgrading membership for user:', user, 'to level:', targetLevel);
    
    // Execute the upgrade on the smart contract
    const tx = await contract.upgradeMembership(user, targetLevel);
    console.log('✅ Membership upgrade transaction sent:', tx.hash);
    
    await tx.wait();
    console.log('✅ Membership upgrade transaction confirmed');

    // Log the upgrade in database
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
    console.error("❌ Relay upgrade error:", err);
    
    // Handle specific custom errors from EnbMiniAppUpgradeable
    if (err.data === '0x15db5d7c') { // InvalidMembershipLevel
      return res.status(400).json({ 
        error: 'InvalidMembershipLevel',
        message: 'Invalid membership level specified.',
        errorCode: '0x15db5d7c'
      });
    }
    
    if (err.data === '0x8f83ab13') { // AlreadyAtMaxLevel
      return res.status(400).json({ 
        error: 'AlreadyAtMaxLevel',
        message: 'User is already at the maximum membership level.',
        errorCode: '0x8f83ab13'
      });
    }
    
    if (err.data === '0x8f83ab13') { // CannotSkipLevels
      return res.status(400).json({ 
        error: 'CannotSkipLevels',
        message: 'Cannot skip membership levels. Must upgrade sequentially.',
        errorCode: '0x8f83ab13'
      });
    }
    
    res.status(500).json({ error: err.message });
  }
});

// Force daily claim endpoint (admin/emergency use)
app.post('/relay/force-daily-claim', async (req, res) => {
  const { user } = req.body;

  if (!user || !ethers.isAddress(user)) {
    return res.status(400).json({ error: 'Invalid user address' });
  }

  try {
    console.log('🚨 Force daily claim for user:', user);
    
    // Execute force daily claim on the smart contract
    const tx = await contract.forceDailyClaim(user);
    console.log('✅ Force daily claim transaction sent:', tx.hash);
    
    await tx.wait();
    console.log('✅ Force daily claim transaction confirmed');

    // Log the forced claim
    const { error: claimError } = await supabase
      .from('claims')
      .upsert({
        wallet_address: user,
        claimed_at: new Date().toISOString(),
        reward: 0, // Add default reward value since it's required by schema
        consecutive_days: 1, // Force claims start a new streak
        tx_hash: tx.hash,
        is_forced: true
      });

    if (claimError) console.error('Warning: Failed to log forced claim:', claimError);

    res.json({ success: true, txHash: tx.hash, message: 'Force daily claim successful' });
  } catch (err) {
    console.error("❌ Force daily claim error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get contract statistics from EnbMiniAppUpgradeable
app.get('/relay/contract-stats', async (req, res) => {
  try {
    console.log('📊 Fetching contract statistics...');
    
    const stats = await contract.getContractStats();
    
    const contractStats = {
      totalUsers: stats.totalUsers.toString(),
      totalClaims: stats.totalClaims.toString(),
      totalYieldDistributed: ethers.formatEther(stats.totalYieldDistributed),
      contractBalance: ethers.formatEther(stats.contractBalance),
      reserveAmount: ethers.formatEther(stats.reserveAmount),
      totalResets: stats.totalResets.toString()
    };
    
    console.log('✅ Contract stats retrieved:', contractStats);
    res.json({ success: true, stats: contractStats });
    
  } catch (err) {
    console.error("❌ Error fetching contract stats:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get airdrop status for a wallet
app.get('/relay/airdrop-status/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;

  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  try {
    const currentUses = await airdropContract.inviteUses(walletAddress);
    const isRewarded = await airdropContract.rewarded(walletAddress);
    const threshold = await airdropContract.THRESHOLD();
    const rewardAmount = await airdropContract.REWARD_AMOUNT();
    
    // Get database info
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('current_invitation_uses, max_invitation_uses')
      .eq('wallet_address', walletAddress)
      .single();
    
    const dbUses = accountData?.current_invitation_uses || 0;
    const maxUses = accountData?.max_invitation_uses || 5;
    
    res.json({
      walletAddress,
      contractUses: currentUses.toString(),
      databaseUses: dbUses,
      maxUses: maxUses,
      threshold: threshold.toString(),
      rewardAmount: ethers.formatEther(rewardAmount),
      isRewarded,
      canTriggerAirdrop: Number(currentUses) >= Number(threshold) && !isRewarded,
      usesUntilAirdrop: Math.max(0, Number(threshold) - Number(currentUses))
    });
    
  } catch (err) {
    console.error("Airdrop status check error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get airdrop history for a wallet
app.get('/api/airdrop-history/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  try {
    const { data: airdrops, error, count } = await supabase
      .from('airdrops')
      .select('*', { count: 'exact' })
      .eq('wallet_address', walletAddress)
      .order('triggered_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const formattedAirdrops = airdrops.map(airdrop => ({
      id: airdrop.id,
      walletAddress: airdrop.wallet_address,
      amount: airdrop.amount,
      triggeredAt: airdrop.triggered_at,
      txHash: airdrop.tx_hash,
      invitationUsesAtTrigger: airdrop.invitation_uses_at_trigger,
      createdAt: airdrop.created_at
    }));

    res.json({
      airdrops: formattedAirdrops,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: formattedAirdrops.length === limit
      }
    });

  } catch (err) {
    console.error("Error fetching airdrop history:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all airdrops (admin endpoint)
app.get('/api/airdrops', async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  const walletAddress = req.query.walletAddress;

  try {
    let query = supabase
      .from('airdrops')
      .select('*', { count: 'exact' });

    if (walletAddress && ethers.isAddress(walletAddress)) {
      query = query.eq('wallet_address', walletAddress);
    }

    query = query.order('triggered_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: airdrops, error, count } = await query;

    if (error) throw error;

    const formattedAirdrops = airdrops.map(airdrop => ({
      id: airdrop.id,
      walletAddress: airdrop.wallet_address,
      amount: airdrop.amount,
      triggeredAt: airdrop.triggered_at,
      txHash: airdrop.tx_hash,
      invitationUsesAtTrigger: airdrop.invitation_uses_at_trigger,
      createdAt: airdrop.created_at
    }));

    res.json({
      airdrops: formattedAirdrops,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: formattedAirdrops.length === limit
      }
    });

  } catch (err) {
    console.error("Error fetching all airdrops:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get mining activity and consecutive days for a wallet
app.get('/api/mining-activity/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;

  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  try {
    console.log('📊 Fetching mining activity for wallet:', walletAddress);
    
    // Get account data from database
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (accountError || !accountData) {
      console.log('❌ Account not found for wallet:', walletAddress);
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!accountData.is_activated) {
      return res.status(400).json({ error: 'Account not activated' });
    }

    // Get all claims for this wallet to calculate consecutive days
    const { data: claimsData, error: claimsError } = await supabase
      .from('claims')
      .select('claimed_at, tx_hash')
      .eq('wallet_address', walletAddress)
      .order('claimed_at', { ascending: true });

    if (claimsError) {
      console.error('❌ Error querying claims table:', claimsError);
      return res.status(500).json({ error: 'Failed to fetch claims data' });
    }

    // Calculate consecutive days based on actual claim history
    let consecutiveDays = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let lastClaimDate = null;
    let canClaimToday = false;
    let nextClaimTime = null;
    let timeUntilNextClaim = null;

    if (claimsData && claimsData.length > 0) {
      // Sort claims by date
      const sortedClaims = claimsData.sort((a, b) => 
        new Date(a.claimed_at).getTime() - new Date(b.claimed_at).getTime()
      );

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Find the most recent claim
      const mostRecentClaim = sortedClaims[sortedClaims.length - 1];
      lastClaimDate = new Date(mostRecentClaim.claimed_at);
      const lastClaimDay = new Date(lastClaimDate.getFullYear(), lastClaimDate.getMonth(), lastClaimDate.getDate());

      // Check if user can claim today
      const timeSinceLastClaim = today.getTime() - lastClaimDay.getTime();
      const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      canClaimToday = timeSinceLastClaim >= cooldownPeriod;
      
      if (canClaimToday) {
        nextClaimTime = now;
        timeUntilNextClaim = 0;
      } else {
        nextClaimTime = new Date(lastClaimDay.getTime() + cooldownPeriod);
        timeUntilNextClaim = nextClaimTime.getTime() - now.getTime();
      }

      // Calculate consecutive days by checking for consecutive dates
      let currentDate = new Date(sortedClaims[0].claimed_at);
      let streakStart = new Date(currentDate);
      let tempStreak = 1;

      for (let i = 1; i < sortedClaims.length; i++) {
        const claimDate = new Date(sortedClaims[i].claimed_at);
        const expectedDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
        
        // Check if this claim is on the next day (allowing for small time differences)
        const dayDiff = Math.abs(claimDate.getTime() - expectedDate.getTime());
        const isConsecutive = dayDiff <= 2 * 24 * 60 * 60 * 1000; // Allow 2 days tolerance
        
        if (isConsecutive) {
          tempStreak++;
          currentDate = claimDate;
        } else {
          // Streak broken, update longest streak if needed
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
          }
          
          // Start new streak
          tempStreak = 1;
          currentDate = claimDate;
          streakStart = claimDate;
        }
      }

      // Update longest streak with current streak if it's longer
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }

      // Current consecutive days is the length of the current streak
      consecutiveDays = tempStreak;
      currentStreak = tempStreak;
    } else {
      // No claims yet - check if account is old enough to claim
      const accountCreatedAt = new Date(accountData.created_at);
      const now = new Date();
      const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours
      
      if (now.getTime() - accountCreatedAt.getTime() >= cooldownPeriod) {
        canClaimToday = true;
        nextClaimTime = now;
        timeUntilNextClaim = 0;
      } else {
        nextClaimTime = new Date(accountCreatedAt.getTime() + cooldownPeriod);
        timeUntilNextClaim = nextClaimTime.getTime() - now.getTime();
      }
    }

    // Format time components for countdown
    const formatTimeLeft = (milliseconds) => {
      if (milliseconds <= 0) return { hours: 0, minutes: 0, seconds: 0 };
      
      const totalSeconds = Math.floor(milliseconds / 1000);
      return {
        hours: Math.floor(totalSeconds / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60
      };
    };

    const timeLeft = formatTimeLeft(timeUntilNextClaim);

    // Calculate progress towards next milestone
    let nextMilestone = null;
    let progressToMilestone = 0;
    
    if (accountData.membership_level === 'Based' && consecutiveDays < 14) {
      nextMilestone = {
        level: 'Super Based',
        required: 14,
        current: consecutiveDays,
        remaining: 14 - consecutiveDays
      };
      progressToMilestone = (consecutiveDays / 14) * 100;
    } else if (accountData.membership_level === 'Super Based' && consecutiveDays < 28) {
      nextMilestone = {
        level: 'Legendary',
        required: 28,
        current: consecutiveDays,
        remaining: 28 - consecutiveDays
      };
      progressToMilestone = (consecutiveDays / 28) * 100;
    } else if (accountData.membership_level === 'Legendary') {
      nextMilestone = {
        level: 'Maximum',
        required: 28,
        current: consecutiveDays,
        remaining: 0
      };
      progressToMilestone = 100;
    }

    const miningActivity = {
      walletAddress,
      consecutiveDays,
      currentStreak,
      longestStreak,
      totalClaims: claimsData ? claimsData.length : 0,
      lastClaimDate: lastClaimDate ? lastClaimDate.toISOString() : null,
      canClaimToday,
      nextClaimTime: nextClaimTime ? nextClaimTime.toISOString() : null,
      timeLeft,
      timeUntilNextClaim,
      nextMilestone,
      progressToMilestone,
      membershipLevel: accountData.membership_level || 'Based',
      accountCreatedAt: accountData.created_at ? new Date(accountData.created_at).toISOString() : null,
      isActivated: accountData.is_activated || false,
      // Include recent claims for detailed tracking
      recentClaims: claimsData ? claimsData.slice(-5).map(claim => ({
        claimedAt: claim.claimed_at,
        txHash: claim.tx_hash
      })) : []
    };

    console.log('✅ Mining activity retrieved for wallet:', walletAddress, {
      consecutiveDays,
      canClaimToday,
      nextMilestone: nextMilestone?.level
    });

    return res.status(200).json(miningActivity);

  } catch (error) {
    console.error('❌ Error fetching mining activity for wallet:', walletAddress, error);
    return res.status(500).json({ error: 'Failed to fetch mining activity' });
  }
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
