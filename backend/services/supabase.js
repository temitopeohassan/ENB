import { supabase } from '../config/supabase.js';

// Game Status Operations
const getGameStatus = async () => {
  try {
    const { data, error } = await supabase
      .from('game_status')
      .select('status_data')
      .eq('status_key', 'current')
      .single();

    if (error) throw error;
    return data?.status_data || null;
  } catch (error) {
    console.error('Error getting game status:', error);
    throw error;
  }
};

const updateGameStatus = async (status) => {
  try {
    const { error } = await supabase
      .from('game_status')
      .upsert({
        status_key: 'current',
        status_data: status
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating game status:', error);
    throw error;
  }
};

// Voting Operations
const getVotingData = async () => {
  try {
    const { data, error } = await supabase
      .from('voting')
      .select('voting_data')
      .eq('voting_key', 'current')
      .single();

    if (error) throw error;
    return data?.voting_data || null;
  } catch (error) {
    console.error('Error getting voting data:', error);
    throw error;
  }
};

const submitVote = async (voterId, votedForId) => {
  try {
    const { data: existingData, error: fetchError } = await supabase
      .from('voting')
      .select('voting_data')
      .eq('voting_key', 'current')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    const currentVotes = existingData?.voting_data?.votes || [];
    const newVote = {
      voterId,
      votedForId,
      timestamp: new Date().toISOString()
    };

    const updatedVotes = [...currentVotes, newVote];

    const { error } = await supabase
      .from('voting')
      .upsert({
        voting_key: 'current',
        voting_data: { votes: updatedVotes }
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error submitting vote:', error);
    throw error;
  }
};

// Leaderboard Operations
const getLeaderboard = async () => {
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    throw error;
  }
};

const updatePlayerScore = async (playerId, score) => {
  try {
    const { error } = await supabase
      .from('leaderboard')
      .upsert({
        player_id: playerId,
        score: score
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating player score:', error);
    throw error;
  }
};

// Profile Operations
const getPlayerProfile = async (playerId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('profile_data')
      .eq('player_id', playerId)
      .single();

    if (error) throw error;
    return data?.profile_data || null;
  } catch (error) {
    console.error('Error getting player profile:', error);
    throw error;
  }
};

const updatePlayerProfile = async (playerId, profileData) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        player_id: playerId,
        profile_data: profileData
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating player profile:', error);
    throw error;
  }
};

// Rewards Operations
const getRewardsData = async () => {
  try {
    const { data, error } = await supabase
      .from('rewards')
      .select('rewards_data')
      .eq('rewards_key', 'current')
      .single();

    if (error) throw error;
    return data?.rewards_data || null;
  } catch (error) {
    console.error('Error getting rewards data:', error);
    throw error;
  }
};

const updateRewardsData = async (rewardsData) => {
  try {
    const { error } = await supabase
      .from('rewards')
      .upsert({
        rewards_key: 'current',
        rewards_data: rewardsData
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating rewards data:', error);
    throw error;
  }
};

// Game Rules Operations
const getGameRules = async () => {
  try {
    const { data, error } = await supabase
      .from('game_rules')
      .select('rules_data')
      .eq('rules_key', 'current')
      .single();

    if (error) throw error;
    return data?.rules_data || null;
  } catch (error) {
    console.error('Error getting game rules:', error);
    throw error;
  }
};

const updateGameRules = async (rules) => {
  try {
    const { error } = await supabase
      .from('game_rules')
      .upsert({
        rules_key: 'current',
        rules_data: rules
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating game rules:', error);
    throw error;
  }
};

export {
  getGameStatus,
  updateGameStatus,
  getVotingData,
  submitVote,
  getLeaderboard,
  updatePlayerScore,
  getPlayerProfile,
  updatePlayerProfile,
  getRewardsData,
  updateRewardsData,
  getGameRules,
  updateGameRules
}; 