'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { ENB_MINI_APP_ABI, ENB_MINI_APP_ADDRESS } from '../constants/enbMiniAppAbi';
import { API_BASE_URL } from '../config';
import {
  createPublicClient,
  encodeFunctionData,
  http,
  EIP1193Provider,
  Hash
} from 'viem';
import { base } from 'viem/chains';
import { Button } from "./Button";
import { Icon } from "./Icon";
import { sdk } from '@farcaster/frame-sdk';



interface CreateProps {
  setActiveTabAction: (tab: string) => void;
}

export const Create: React.FC<CreateProps> = ({ setActiveTabAction }) => {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [accountCreated, setAccountCreated] = useState(false);
  const [hasUnactivatedAccount, setHasUnactivatedAccount] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [isCheckingAccount, setIsCheckingAccount] = useState(true);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [showCreatedModal, setShowCreatedModal] = useState(false);
  const [showActivatedModal, setShowActivatedModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkExistingAccount = async () => {
      console.log('🔍 Checking existing account...');
      console.log('📋 Check data:', { address, isConnected });
      
      if (!address || !isConnected) {
        console.log('❌ No address or not connected, skipping check');
        setIsCheckingAccount(false);
        return;
      }

      try {
        console.log('📤 Fetching profile from API...');
        const response = await fetch(`${API_BASE_URL}/api/profile/${address}`);
        console.log('📥 Profile response status:', response.status);

        if (response.status === 404) {
          console.log('🆕 No existing account found for this wallet');
          setAccountCreated(false);
          setHasUnactivatedAccount(false);
          return;
        }
        
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          console.error('❌ Failed to fetch profile:', err);
          throw new Error(err.error || 'Failed to fetch profile');
        }

        const profile = await response.json();
        console.log('📋 Profile data received:', profile);

        if (profile.isActivated) {
            console.log('✅ User account is activated');
            setAccountCreated(true);
          setHasUnactivatedAccount(false);
          } else {
            console.log('⚠️ User account exists but not activated');
          setAccountCreated(true);
            setHasUnactivatedAccount(true);
        }
      } catch (error) {
        console.error('❌ Error checking account:', error);
        setError('Failed to check account status');
      } finally {
        setIsCheckingAccount(false);
        console.log('🏁 Account check finished');
      }
    };

    checkExistingAccount();
  }, [address, isConnected]);

  const handleCreateAccount = async () => {
    console.log('🚀 Starting account creation process...');
    console.log('📋 Current state:', { address, isConnected });
    
    if (!address || !isConnected) {
      console.log('❌ Wallet not connected');
      setError('Please connect your wallet first');
      return;
    }

    setIsCreatingAccount(true);
    setError(null);
    console.log('✅ Wallet connected, proceeding with account creation');

    try {
      console.log('🔧 Creating public client...');
      const publicClient = createPublicClient({ 
        chain: base, 
        transport: http() 
      });
      console.log('✅ Public client created');

      // Prepare transaction data
      console.log('📝 Preparing transaction data...');
      const baseTxData = encodeFunctionData({
        abi: ENB_MINI_APP_ABI,
        functionName: 'createAccount',
        args: []
      });
      console.log('✅ Transaction data prepared:', baseTxData);

      // Estimate gas
      console.log('⛽ Estimating gas...');
      let gasEstimate: bigint;
      try {
        gasEstimate = await publicClient.estimateGas({
          account: address,
          to: ENB_MINI_APP_ADDRESS,
          data: baseTxData
        });
        // Add 20% buffer for gas estimation
        gasEstimate = gasEstimate + (gasEstimate * BigInt(20)) / BigInt(100);
        console.log('✅ Gas estimated:', gasEstimate.toString());
      } catch (error) {
        console.warn('⚠️ Gas estimation failed, using fallback:', error);
        gasEstimate = BigInt(150000); // Increased fallback
        console.log('🔄 Using fallback gas:', gasEstimate.toString());
      }

      // Execute transaction
      console.log('💸 Executing transaction...');
      let txHash: Hash;
      
      if (window.ethereum) {
        console.log('🔗 Using window.ethereum for transaction');
        const txParams = {
          from: address,
          to: ENB_MINI_APP_ADDRESS as `0x${string}`,
          data: baseTxData,
          gas: `0x${gasEstimate.toString(16)}` as `0x${string}`
        };
        console.log('📋 Transaction params:', txParams);
        
        txHash = await (window.ethereum as EIP1193Provider).request({
          method: 'eth_sendTransaction',
          params: [txParams]
        }) as Hash;
        console.log('✅ Transaction sent via window.ethereum, hash:', txHash);
      } else {
        console.log('🔗 Using wagmi writeContract as fallback');
        txHash = await writeContractAsync({
          address: ENB_MINI_APP_ADDRESS,
          abi: ENB_MINI_APP_ABI,
          functionName: 'createAccount',
          args: [],
        });
        console.log('✅ Transaction sent via wagmi, hash:', txHash);
      }

      // Wait for blockchain confirmation
      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log('✅ Transaction confirmed in block:', receipt.blockNumber);

      // Sync with backend
      console.log('🔄 Syncing with backend...');
      const backendPayload = { 
        walletAddress: address, 
        transactionHash: txHash 
      };
      console.log('📤 Backend payload:', backendPayload);
      
      const backendResponse = await fetch(`${API_BASE_URL}/api/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload)
      });

      console.log('📥 Backend response status:', backendResponse.status);
      
      if (!backendResponse.ok) {
        const errorData = await backendResponse.json();
        console.error('❌ Backend sync failed:', errorData);
        throw new Error(errorData.error || 'Backend sync failed');
      }

      const backendData = await backendResponse.json();
      console.log('✅ Backend sync successful:', backendData);

      setShowCreatedModal(true);
      setAccountCreated(true);
      setHasUnactivatedAccount(true);
      console.log('🎉 Account creation completed successfully');
    } catch (error) {
      console.error('❌ Account creation failed:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to create account';
      setError(errorMessage);
    } finally {
      setIsCreatingAccount(false);
      console.log('🏁 Account creation process finished');
    }
  };

  const handleCreatedWarpcastShare = async () => {
    try {
      await sdk.actions.composeCast({
        text: "I just created my $ENB mining account. I am looking for an account activation code",
        embeds: ["https://enb-crushers.vercel.app"]
      });
    } catch (error) {
      console.error('Failed to share on Farcaster:', error);
    }
  };

  const handleActivatedWarpcastShare = async () => {
    try {
      await sdk.actions.composeCast({
        text: "I Just Activated My Base Layer Account. I am now earning $ENB everyday! Join me",
        embeds: ["https://enb-crushers.vercel.app"]
      });
    } catch (error) {
      console.error('Failed to share on Farcaster:', error);
    }
  };

  const handleActivateAccount = async (e: FormEvent) => {
    e.preventDefault();
    console.log('🔓 Starting account activation process...');
    console.log('📋 Activation data:', { address, activationCode: activationCode.trim() });

    if (!address || !activationCode.trim()) {
      console.log('❌ Missing required data for activation');
      setError('Please enter a valid invitation code');
      return;
    }

    setIsActivating(true);
    setError(null);
    console.log('✅ Proceeding with activation');

    try {
      const activationPayload = {
        walletAddress: address,
        invitationCode: activationCode.trim()
      };
      console.log('📤 Sending activation request:', activationPayload);
      
      const response = await fetch(`${API_BASE_URL}/api/activate-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activationPayload)
      });

      console.log('📥 Activation response status:', response.status);
      
      const data = await response.json();
      console.log('📋 Activation response data:', data);
      
      if (!response.ok) {
        console.error('❌ Activation failed:', data);
        throw new Error(data.error || 'Activation failed');
      }

      console.log('✅ Activation successful');
      setShowActivatedModal(true);
      setAccountCreated(true);
      setHasUnactivatedAccount(false);
      setActivationCode('');
      
      // Account activation successful - user can manually refresh to see updated data
    } catch (error) {
      console.error('❌ Activation failed:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Activation failed';
      setError(errorMessage);
    } finally {
      setIsActivating(false);
      console.log('🏁 Activation process finished');
    }
  };

  if (isCheckingAccount) {
    return (
      <div className="space-y-6 text-center animate-fade-in">
        <h1 className="text-xl font-bold">Welcome To ENB Mini App</h1>
        <p className="text-gray-600">Checking your account status...</p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="space-y-6 text-center animate-fade-in">
        <h1 className="text-xl font-bold">Welcome To ENB Mini App</h1>
        <p className="text-gray-600">Please connect your wallet to continue</p>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">
            Connect your wallet to create a mining account and start earning ENB.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold">Welcome To ENB Mini App</h1>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {!accountCreated && !hasUnactivatedAccount && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Create Mining Account</h3>
            <p className="text-blue-800">
              Create your mining account to start earning ENB. This will:
            </p>
            <ul className="mt-2 text-blue-800 text-sm space-y-1">
              <li>• Register your wallet with the ENB protocol</li>
           
              <li>• Require activation with an invitation code</li>
            </ul>
          </div>
          
          <button
            onClick={handleCreateAccount}
            disabled={isCreatingAccount}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreatingAccount ? 'Creating Account...' : 'Create Mining Account'}
          </button>
        </div>
      )}

      {hasUnactivatedAccount && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-medium text-amber-900 mb-2">Account Activation Required</h3>
            <p className="text-amber-800">
              Your account has been created but needs activation. Enter your invitation code below.
            </p>
          </div>
          
          <form onSubmit={handleActivateAccount} className="space-y-4">
            <input
              type="text"
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
              placeholder="Enter invitation code"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isActivating}
            />
            <button
              type="submit"
              disabled={isActivating || !activationCode.trim()}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isActivating ? 'Activating...' : 'Activate Account'}
            </button>
          </form>
        </div>
      )}

      {accountCreated && !hasUnactivatedAccount && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-medium text-green-900 mb-2">Account Active</h3>
          <p className="text-green-800">
            Your mining account is active and earning ENB!
          </p>
        </div>
      )}

      {/* Created Modal */}
      {showCreatedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <Icon name="check" size="lg" className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Account Created Successfully
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your mining account has been created.
                You&apos;ll need an activation code to start earning.
              </p>
            </div>
            <div className="flex justify-center space-x-4">
              <Button onClick={() => setShowCreatedModal(false)}>
                Continue
              </Button>
              <Button onClick={handleCreatedWarpcastShare} variant="outline">
                Share on Farcaster
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Activated Modal */}
      {showActivatedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <Icon name="check" size="lg" className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Account Activated Successfully!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your account is now active and earning ENB.
              </p>
            </div>
            <div className="flex justify-center space-x-4">
              <Button onClick={() => {
                setShowActivatedModal(false);
                setActiveTabAction("account");
              }}>
                Continue to Account
              </Button>
              <Button onClick={handleActivatedWarpcastShare} variant="outline">
                Share on Farcaster
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};