import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Wallet, Waves, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { store } from '../api/storage';
import { useRecipientStreams } from '../hooks/queries';
import { usePersistentState } from './usePersistentState';

export function ContractorPortal() {
  const [walletAddress, setWalletAddress] = usePersistentState(
    'stellarpay.walletAddress',
    store.getWalletAddress(),
  );
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();
  const { data: streams, isLoading } = useRecipientStreams(walletAddress);

  async function handleConnect() {
    if (!walletAddress) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getBalance(walletAddress);
      setBalance(data.balance);
      setView('dashboard');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load account. Is it funded on this network?',
      );
    } finally {
      setLoading(false);
    }
  }

  if (view === 'login') {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-8 text-center space-y-6">
          <div className="p-3 bg-stellar-800 rounded-full w-fit mx-auto">
            <ExternalLink className="w-6 h-6 text-stellar-300" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">Contractor Portal</h1>
            <p className="text-sm text-stellar-400 mt-1">
              Connect your Stellar wallet to view payments
            </p>
          </div>

          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500 text-center"
            placeholder="Enter your Stellar public key (G...)"
          />

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={!walletAddress || loading}
            className="w-full px-4 py-2.5 bg-stellar-600 hover:bg-stellar-500 disabled:bg-stellar-700 rounded-lg text-sm text-white font-medium transition-colors"
          >
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>

          <p className="text-xs text-stellar-500">
            Your wallet address is used to look up your payment history on Stellar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Payments</h1>
          <p className="text-stellar-400 mt-1 text-sm">
            <Wallet className="w-3 h-3 inline mr-1" />
            {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => queryClient.invalidateQueries()}
            className="flex items-center gap-1 text-xs text-stellar-400 hover:text-stellar-200"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <button
            onClick={() => setView('login')}
            className="text-xs text-stellar-400 hover:text-stellar-200"
          >
            Disconnect
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-4">
          <div className="text-xs text-stellar-400 mb-1">XLM Balance</div>
          <div className="text-xl font-bold text-white">
            {balance !== null ? `${balance} XLM` : '—'}
          </div>
        </div>
        <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-4">
          <div className="text-xs text-stellar-400 mb-1">Active Streams</div>
          <div className="text-xl font-bold text-white">
            {isLoading ? '…' : (streams?.filter((s) => !s.cancelled).length ?? 0)}
          </div>
        </div>
      </div>

      <div className="bg-stellar-900 border border-stellar-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-stellar-800">
          <h2 className="text-sm font-medium text-stellar-300">Payment Streams</h2>
        </div>

        {streams === undefined && isLoading ? (
          <div className="p-8 text-center text-sm text-stellar-500">
            Loading payment streams...
          </div>
        ) : (streams?.length ?? 0) === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="p-2 bg-stellar-800 rounded-lg w-fit mx-auto">
              <Waves className="w-5 h-5 text-stellar-400" />
            </div>
            <div className="text-sm text-stellar-400">
              No payment streams for this wallet yet.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-stellar-800">
            {streams?.map((stream) => (
              <div key={stream.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white font-medium">
                      Stream #{stream.id}
                    </div>
                    <div className="text-xs text-stellar-400">
                      From {stream.sender.slice(0, 8)}...
                      {stream.sender.slice(-4)}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded border ${
                      stream.cancelled
                        ? 'text-stellar-400 bg-stellar-800/30 border-stellar-700'
                        : 'text-green-400 bg-green-900/30 border-green-800'
                    }`}
                  >
                    {stream.cancelled ? 'Cancelled' : 'Active'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div className="bg-stellar-950 rounded-lg p-3">
                    <div className="text-[11px] text-stellar-500">
                      Available to withdraw
                    </div>
                    <div className="text-sm text-white mt-1">
                      {stream.availableAmount ?? '0'}
                    </div>
                  </div>
                  <div className="bg-stellar-950 rounded-lg p-3">
                    <div className="text-[11px] text-stellar-500">Withdrawn</div>
                    <div className="text-sm text-white mt-1">{stream.withdrawn}</div>
                  </div>
                  <div className="bg-stellar-950 rounded-lg p-3">
                    <div className="text-[11px] text-stellar-500">Rate</div>
                    <div className="text-sm text-white mt-1">
                      {stream.amountPerSecond}/sec
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
