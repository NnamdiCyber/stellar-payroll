import { useState } from 'react';
import { Building2, Plus, Trash2 } from 'lucide-react';

export function CompanySetup() {
  const [adminSecret, setAdminSecret] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [signers, setSigners] = useState<string[]>(['']);
  const [minSigners, setMinSigners] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  function addSigner() {
    setSigners([...signers, '']);
  }

  function removeSigner(i: number) {
    setSigners(signers.filter((_, idx) => idx !== i));
  }

  function updateSigner(i: number, val: string) {
    const next = [...signers];
    next[i] = val;
    setSigners(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/v1/payroll/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminSecretKey: adminSecret,
          signers: signers.filter(Boolean),
          minSigners,
          tokenAddress,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setResult(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Company Setup</h1>
        <p className="text-stellar-400 mt-1">
          Register your company on Stellar to start processing payroll
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-stellar-900 border border-stellar-800 rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-stellar-300 mb-1">
            Admin Secret Key
          </label>
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white placeholder:text-stellar-500 focus:outline-none focus:ring-2 focus:ring-stellar-500"
            placeholder="S. Enter your Stellar secret key"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stellar-300 mb-1">
            Payment Token Contract Address
          </label>
          <input
            type="text"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white placeholder:text-stellar-500 focus:outline-none focus:ring-2 focus:ring-stellar-500"
            placeholder="Token contract address (e.g. USDC)"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-stellar-300">
              Signers (multisig)
            </label>
            <button
              type="button"
              onClick={addSigner}
              className="flex items-center gap-1 text-xs text-stellar-400 hover:text-stellar-200"
            >
              <Plus className="w-3 h-3" /> Add signer
            </button>
          </div>
          <div className="space-y-2">
            {signers.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={s}
                  onChange={(e) => updateSigner(i, e.target.value)}
                  className="flex-1 px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white placeholder:text-stellar-500 focus:outline-none focus:ring-2 focus:ring-stellar-500"
                  placeholder={`Signer ${i + 1} address`}
                />
                {signers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSigner(i)}
                    className="p-2 text-stellar-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stellar-300 mb-1">
            Minimum Signers Required
          </label>
          <input
            type="number"
            value={minSigners}
            onChange={(e) => setMinSigners(parseInt(e.target.value) || 1)}
            min={1}
            max={signers.length}
            className="w-32 px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
          />
          <p className="text-xs text-stellar-500 mt-1">
            Number of approvals needed to execute a payroll run
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg text-sm text-green-400">
            Company registered! Transaction: {result.transactionHash}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2.5 bg-stellar-600 hover:bg-stellar-500 disabled:bg-stellar-700 rounded-lg text-sm text-white font-medium transition-colors"
        >
          {loading ? 'Registering...' : 'Register Company on Stellar'}
        </button>
      </form>
    </div>
  );
}
