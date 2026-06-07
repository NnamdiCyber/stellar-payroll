import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Building2,
  Users,
  DollarSign,
  ArrowRight,
  Plus,
  Send,
  Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = '/api/v1';

async function createTestAccount() {
  const res = await fetch(`${API}/anchor/create-account`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create account');
  return res.json();
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-stellar-800 rounded-lg">
          <Icon className="w-4 h-4 text-stellar-300" />
        </div>
        <span className="text-sm text-stellar-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-stellar-500 mt-1">{sub}</div>}
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();

  const { data: account, isPending } = useMutation({
    mutationFn: createTestAccount,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Payroll Dashboard</h1>
        <p className="text-stellar-400 mt-1">
          Manage cross-border B2B payroll and contractor payments on Stellar
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Company"
          value="Not Set Up"
          sub="Register your company to get started"
        />
        <StatCard
          icon={Users}
          label="Contractors"
          value="0"
          sub="Add contractors to run payroll"
        />
        <StatCard
          icon={DollarSign}
          label="Payroll Runs"
          value="0"
          sub="No runs created yet"
        />
        <StatCard
          icon={Activity}
          label="Network"
          value="Stellar Testnet"
          sub="Soroban smart contracts"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/setup')}
              className="w-full flex items-center justify-between px-4 py-3 bg-stellar-800 hover:bg-stellar-700 rounded-lg text-sm text-stellar-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Set up company
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/contractors')}
              className="w-full flex items-center justify-between px-4 py-3 bg-stellar-800 hover:bg-stellar-700 rounded-lg text-sm text-stellar-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add contractors
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/payroll')}
              className="w-full flex items-center justify-between px-4 py-3 bg-stellar-800 hover:bg-stellar-700 rounded-lg text-sm text-stellar-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Create payroll run
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Testnet Account</h2>
          {account?.data ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-stellar-400 block mb-1">Public Key</label>
                <code className="text-xs bg-stellar-950 px-3 py-2 rounded block truncate text-stellar-200">
                  {account.data.publicKey}
                </code>
              </div>
              <div>
                <label className="text-xs text-stellar-400 block mb-1">Secret Key</label>
                <code className="text-xs bg-stellar-950 px-3 py-2 rounded block truncate text-stellar-200">
                  {account.data.secretKey.slice(0, 8)}...
                </code>
              </div>
              <div className="text-xs text-stellar-500">
                Auto-funded via Friendbot. Use this for testing.
              </div>
            </div>
          ) : (
            <button
              onClick={() => account?.mutateAsync()}
              disabled={account?.isPending}
              className="w-full px-4 py-3 bg-stellar-600 hover:bg-stellar-500 disabled:bg-stellar-700 rounded-lg text-sm text-white transition-colors"
            >
              {account?.isPending ? 'Creating...' : 'Create Test Account'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
