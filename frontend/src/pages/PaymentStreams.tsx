import { useState } from 'react';
import { Waves, Clock, XCircle } from 'lucide-react';
import { api } from '../api/client';

export function PaymentStreams() {
  const [senderSecret, setSenderSecret] = useState('');
  const [recipient, setRecipient] = useState('');
  const [token, setToken] = useState('');
  const [amountPerSec, setAmountPerSec] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [streams, setStreams] = useState<
    Array<{
      id: number;
      recipient: string;
      amountPerSec: string;
      status: string;
    }>
  >([]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await api.createStream({
        senderSecretKey: senderSecret,
        recipientAddress: recipient,
        tokenAddress: token,
        amountPerSecond: amountPerSec,
        maxAmount: maxAmount,
        durationSeconds: parseInt(duration),
        memo: `Stream to ${recipient.slice(0, 8)}`,
      });

      setStreams([
        {
          id: data.streamId,
          recipient: recipient,
          amountPerSec: amountPerSec,
          status: 'Active',
        },
        ...streams,
      ]);

      setRecipient('');
      setAmountPerSec('');
      setMaxAmount('');
      setDuration('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create stream');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Payment Streams</h1>
        <p className="text-stellar-400 mt-1">
          Real-time payment streaming for ongoing contractor compensation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleCreate}
          className="bg-stellar-900 border border-stellar-800 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-stellar-300 text-sm font-medium mb-2">
            <Waves className="w-4 h-4" />
            Create Payment Stream
          </div>

          <div>
            <label className="block text-xs text-stellar-400 mb-1">Sender Secret Key</label>
            <input
              type="password"
              value={senderSecret}
              onChange={(e) => setSenderSecret(e.target.value)}
              className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
              placeholder="S. Your secret key"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-stellar-400 mb-1">Recipient Address</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
              placeholder="G. Recipient Stellar address"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-stellar-400 mb-1">Token Contract</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
              placeholder="Token contract address"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stellar-400 mb-1">Amount/sec</label>
              <input
                type="text"
                value={amountPerSec}
                onChange={(e) => setAmountPerSec(e.target.value)}
                className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
                placeholder="100"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-stellar-400 mb-1">Max amount</label>
              <input
                type="text"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
                placeholder="1000000"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-stellar-400 mb-1">
              <Clock className="w-3 h-3 inline mr-1" />
              Duration (seconds)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
              placeholder="2592000 (30 days)"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 bg-stellar-600 hover:bg-stellar-500 disabled:bg-stellar-700 rounded-lg text-sm text-white font-medium transition-colors"
          >
            {loading ? 'Creating Stream...' : 'Create Stream on Stellar'}
          </button>
        </form>

        <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-6">
          <div className="flex items-center gap-2 text-stellar-300 text-sm font-medium mb-4">
            <Waves className="w-4 h-4" />
            Active Streams ({streams.length})
          </div>

          {streams.length === 0 ? (
            <div className="text-center py-8 text-stellar-500 text-sm">
              No active payment streams
            </div>
          ) : (
            <div className="space-y-2">
              {streams.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 bg-stellar-950 rounded-lg"
                >
                  <div>
                    <div className="text-sm text-white">Stream #{s.id}</div>
                    <code className="text-xs text-stellar-500">
                      {s.recipient.slice(0, 12)}...
                    </code>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stellar-400">{s.amountPerSec}/sec</span>
                    <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded border border-green-800">
                      {s.status}
                    </span>
                    <button className="text-stellar-500 hover:text-red-400">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
