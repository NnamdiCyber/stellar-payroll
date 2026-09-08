import { useState } from 'react';
import { Users, Plus, Mail, Wallet, Trash2 } from 'lucide-react';
import { api } from '../api/client';

export function Contractors() {
  const [adminSecret, setAdminSecret] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [contractorAddress, setContractorAddress] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [contractors, setContractors] = useState<
    Array<{ address: string; name: string; email: string }>
  >([]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.addContractor({
        adminSecretKey: adminSecret,
        companyAddress,
        contractorAddress,
        name,
        email,
      });

      setContractors([
        ...contractors,
        { address: contractorAddress, name, email },
      ]);
      setContractorAddress('');
      setName('');
      setEmail('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add contractor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Contractors</h1>
        <p className="text-stellar-400 mt-1">
          Manage contractors and their Stellar wallet addresses
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleAdd}
          className="bg-stellar-900 border border-stellar-800 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-stellar-300 text-sm font-medium mb-2">
            <Plus className="w-4 h-4" />
            Add Contractor
          </div>

          <div>
            <label className="block text-xs text-stellar-400 mb-1">Admin Secret Key</label>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
              placeholder="S. Company admin secret key"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-stellar-400 mb-1">Company Address</label>
            <input
              type="text"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
              placeholder="G. Company public address"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-stellar-400 mb-1">
              <Wallet className="w-3 h-3 inline mr-1" />
              Contractor Stellar Address
            </label>
            <input
              type="text"
              value={contractorAddress}
              onChange={(e) => setContractorAddress(e.target.value)}
              className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
              placeholder="G. Contractor Stellar address"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-stellar-400 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
              placeholder="Jane Doe"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-stellar-400 mb-1">
              <Mail className="w-3 h-3 inline mr-1" />
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
              placeholder="jane@example.com"
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
            {loading ? 'Adding...' : 'Add Contractor'}
          </button>
        </form>

        <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-6">
          <div className="flex items-center gap-2 text-stellar-300 text-sm font-medium mb-4">
            <Users className="w-4 h-4" />
            Contractor List ({contractors.length})
          </div>

          {contractors.length === 0 ? (
            <div className="text-center py-8 text-stellar-500 text-sm">
              No contractors added yet
            </div>
          ) : (
            <div className="space-y-2">
              {contractors.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-stellar-950 rounded-lg"
                >
                  <div>
                    <div className="text-sm text-white">{c.name}</div>
                    <div className="text-xs text-stellar-400">{c.email}</div>
                    <code className="text-xs text-stellar-500">{c.address.slice(0, 12)}...</code>
                  </div>
                  <button className="text-stellar-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
