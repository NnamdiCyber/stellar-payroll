import { useState } from 'react';
import { ExternalLink, Wallet, ArrowDown, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';

export function ContractorPortal() {
  const [walletAddress, setWalletAddress] = useState('');
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        <button
          onClick={() => setView('login')}
          className="text-xs text-stellar-400 hover:text-stellar-200"
        >
          Disconnect
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-4">
          <div className="text-xs text-stellar-400 mb-1">XLM Balance</div>
          <div className="text-xl font-bold text-white">
            {balance !== null ? `${balance} XLM` : '—'}
          </div>
        </div>
      </div>

      <div className="bg-stellar-900 border border-stellar-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-stellar-800">
          <h2 className="text-sm font-medium text-stellar-300">Payment History</h2>
        </div>

        <div className="p-8 text-center space-y-3">
          <div className="p-2 bg-yellow-900/30 rounded-lg w-fit mx-auto">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-sm text-stellar-400">
            On-chain payment history requires indexing payroll and stream events.
            Check back soon.
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-stellar-500">
            <ArrowDown className="w-3 h-3" />
            Payments are recorded on Stellar and will appear here once indexed.
          </div>
        </div>
      </div>
    </div>
  );
}