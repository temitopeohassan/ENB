-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    transaction_hash VARCHAR(66),
    membership_level VARCHAR(20) DEFAULT 'Based',
    invitation_code VARCHAR(8) UNIQUE,
    max_invitation_uses INTEGER DEFAULT 5,
    current_invitation_uses INTEGER DEFAULT 0,
    enb_balance DECIMAL(20, 8) DEFAULT 0,
    total_earned DECIMAL(20, 8) DEFAULT 0,
    consecutive_days INTEGER DEFAULT 0,
    is_activated BOOLEAN DEFAULT FALSE,
    activated_at TIMESTAMP WITH TIME ZONE,
    activated_by VARCHAR(8),
    inviter_wallet VARCHAR(42),
    last_daily_claim_time TIMESTAMP WITH TIME ZONE,
    last_transaction_hash VARCHAR(66),
    last_upgrade_at TIMESTAMP WITH TIME ZONE,
    upgrade_transaction_hash VARCHAR(66),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invitation_usage table
CREATE TABLE IF NOT EXISTS invitation_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invitation_code VARCHAR(8) NOT NULL,
    used_by VARCHAR(42) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    inviter_wallet VARCHAR(42) NOT NULL,
    UNIQUE(invitation_code, used_by)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('credit', 'debit')),
    description TEXT,
    balance_before DECIMAL(20, 8) NOT NULL,
    balance_after DECIMAL(20, 8) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create claims table
CREATE TABLE IF NOT EXISTS claims (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reward DECIMAL(20, 8) NOT NULL,
    consecutive_days INTEGER NOT NULL,
    tx_hash VARCHAR(66),
    last_claimed TIMESTAMP WITH TIME ZONE
);

-- Create upgrades table
CREATE TABLE IF NOT EXISTS upgrades (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    upgraded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    level INTEGER NOT NULL,
    tx_hash VARCHAR(66)
);

-- Create game_status table
CREATE TABLE IF NOT EXISTS game_status (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    status_key VARCHAR(50) DEFAULT 'current' UNIQUE,
    status_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create voting table
CREATE TABLE IF NOT EXISTS voting (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    voting_key VARCHAR(50) DEFAULT 'current' UNIQUE,
    voting_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id VARCHAR(100) NOT NULL,
    score DECIMAL(20, 8) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id VARCHAR(100) NOT NULL UNIQUE,
    profile_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rewards table
CREATE TABLE IF NOT EXISTS rewards (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    rewards_key VARCHAR(50) DEFAULT 'current' UNIQUE,
    rewards_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create game_rules table
CREATE TABLE IF NOT EXISTS game_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    rules_key VARCHAR(50) DEFAULT 'current' UNIQUE,
    rules_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_accounts_wallet_address ON accounts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_accounts_invitation_code ON accounts(invitation_code);
CREATE INDEX IF NOT EXISTS idx_accounts_is_activated ON accounts(is_activated);
CREATE INDEX IF NOT EXISTS idx_accounts_enb_balance ON accounts(enb_balance);
CREATE INDEX IF NOT EXISTS idx_accounts_total_earned ON accounts(total_earned);
CREATE INDEX IF NOT EXISTS idx_accounts_consecutive_days ON accounts(consecutive_days);

CREATE INDEX IF NOT EXISTS idx_invitation_usage_code ON invitation_usage(invitation_code);
CREATE INDEX IF NOT EXISTS idx_invitation_usage_used_by ON invitation_usage(used_by);

CREATE INDEX IF NOT EXISTS idx_transactions_wallet_address ON transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);

CREATE INDEX IF NOT EXISTS idx_claims_wallet_address ON claims(wallet_address);
CREATE INDEX IF NOT EXISTS idx_claims_claimed_at ON claims(claimed_at);

CREATE INDEX IF NOT EXISTS idx_upgrades_wallet_address ON upgrades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_upgrades_upgraded_at ON upgrades(upgraded_at);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leaderboard_updated_at BEFORE UPDATE ON leaderboard FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_game_status_updated_at BEFORE UPDATE ON game_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_voting_updated_at BEFORE UPDATE ON voting FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rewards_updated_at BEFORE UPDATE ON rewards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_game_rules_updated_at BEFORE UPDATE ON game_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create stored procedure for account activation with usage tracking
CREATE OR REPLACE FUNCTION activate_account_with_usage(
  p_wallet_address VARCHAR(42),
  p_invitation_code VARCHAR(8),
  p_inviter_wallet VARCHAR(42),
  p_current_uses INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- Update the account to be activated
  UPDATE accounts 
  SET 
    is_activated = true,
    activated_at = NOW(),
    activated_by = p_invitation_code,
    inviter_wallet = p_inviter_wallet
  WHERE wallet_address = p_wallet_address;

  -- Update inviter's usage count
  UPDATE accounts 
  SET current_invitation_uses = p_current_uses + 1
  WHERE wallet_address = p_inviter_wallet;

  -- Add usage log
  INSERT INTO invitation_usage (
    invitation_code,
    used_by,
    used_at,
    inviter_wallet
  ) VALUES (
    p_invitation_code,
    p_wallet_address,
    NOW(),
    p_inviter_wallet
  );
END;
$$ LANGUAGE plpgsql;

-- Create stored procedure for balance updates with transaction logging
CREATE OR REPLACE FUNCTION update_balance_with_transaction(
  p_wallet_address VARCHAR(42),
  p_new_balance DECIMAL(20, 8),
  p_amount DECIMAL(20, 8),
  p_type VARCHAR(10),
  p_description TEXT
)
RETURNS VOID AS $$
DECLARE
  v_current_balance DECIMAL(20, 8);
BEGIN
  -- Get current balance
  SELECT enb_balance INTO v_current_balance 
  FROM accounts 
  WHERE wallet_address = p_wallet_address;

  -- Update account balance
  UPDATE accounts 
  SET enb_balance = p_new_balance
  WHERE wallet_address = p_wallet_address;

  -- Add transaction record
  INSERT INTO transactions (
    wallet_address,
    amount,
    type,
    description,
    balance_before,
    balance_after,
    timestamp
  ) VALUES (
    p_wallet_address,
    p_amount,
    p_type,
    p_description,
    v_current_balance,
    p_new_balance,
    NOW()
  );
END;
$$ LANGUAGE plpgsql; 