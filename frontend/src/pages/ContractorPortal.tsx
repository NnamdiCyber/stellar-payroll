import { useState } from 'react';
import { ExternalLink, Wallet, ArrowDown } from 'lucide-react';

export function ContractorPortal() {
  const [walletAddress, setWalletAddress] = useState('');
  const [view, setView] = useState<'login' | 'dashboard'>('login');

  const mockPayments = [
    { date: '2026-05-15', amount: '5,000 USDC', status: 'Paid', tx: 'abc...def' },
    { date: '2026-05-01', amount: '5,000 USDC', status: 'Paid', tx: '123...456' },
    { date: '2026-04-15', amount: '5,000 USDC', status: 'Paid', tx: '789...012' },
  ];

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

          <button
            onClick={() => walletAddress && setView('dashboard')}
            disabled={!walletAddress}
            className="w-full px-4 py-2.5 bg-stellar-600 hover:bg-stellar-500 disabled:bg-stellar-700 rounded-lg text-sm text-white font-medium transition-colors"
          >
            Connect Wallet
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-4">
          <div className="text-xs text-stellar-400 mb-1">Total Received</div>
          <div className="text-xl font-bold text-white">15,000 USDC</div>
        </div>
        <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-4">
          <div className="text-xs text-stellar-400 mb-1">Active Stream</div>
          <div className="text-xl font-bold text-white">2.5 USDC/sec</div>
        </div>
        <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-4">
          <div className="text-xs text-stellar-400 mb-1">Next Payment</div>
          <div className="text-xl font-bold text-white">Jun 1, 2026</div>
        </div>
      </div>

      <div className="bg-stellar-900 border border-stellar-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-stellar-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-stellar-300">Payment History</h2>
          <span className="text-xs text-stellar-500">3 payments</span>
        </div>

        <div className="divide-y divide-stellar-800">
          {mockPayments.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 hover:bg-stellar-950/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-900/30 rounded-lg">
                  <ArrowDown className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <div className="text-sm text-white">{p.amount}</div>
                  <div className="text-xs text-stellar-500">{p.date}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded border border-green-800">
                  {p.status}
                </span>
                <code className="text-xs text-stellar-500">{p.tx}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
