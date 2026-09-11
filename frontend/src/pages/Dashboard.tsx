import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Users,
  DollarSign,
  ArrowRight,
  Plus,
  Send,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';
import { store } from '../api/storage';
import { useCompany, useCompanyContractors, usePayrollRuns } from '../hooks/queries';
import { usePersistentState } from './usePersistentState';

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
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
  const queryClient = useQueryClient();
  const [companyAddress, setCompanyAddress] = usePersistentState(
    'stellarpay.companyAddress',
    store.getCompanyAddress(),
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { data: company, isFetching: companyLoading } = useCompany(companyAddress);
  const { data: contractorAddresses, isFetching: contractorsLoading } =
    useCompanyContractors(companyAddress);
  const { data: runs, isFetching: runsLoading } = usePayrollRuns(companyAddress);

  const contractorCount =
    companyAddress && Array.isArray(contractorAddresses) ? contractorAddresses.length : 0;

  async function handleCreateAccount() {
    setCreating(true);
    setError('');
    try {
      const data = await api.createTestAccount();
      store.setWalletAddress(data.publicKey);
      navigate('/portal');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payroll Dashboard</h1>
          <p className="text-stellar-400 mt-1">
            Manage cross-border B2B payroll and contractor payments on Stellar
          </p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries()}
          className="flex items-center gap-1 text-xs text-stellar-400 hover:text-stellar-200"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-4">
        <label className="block text-xs text-stellar-400 mb-1">
          Company Stellar Address (auto-persisted)
        </label>
        <input
          type="text"
          value={companyAddress}
          onChange={(e) => setCompanyAddress(e.target.value)}
          className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
          placeholder="G. Company public address"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Company"
          value={
            company
              ? company.active
                ? 'Active'
                : 'Inactive'
              : companyAddress
                ? companyLoading
                  ? 'Loading'
                  : 'Not Found'
                : 'Not Set Up'
          }
          sub={
            company
              ? `Multisig ${company.min_signers} / ${company.signers.length}`
              : 'Register your company to get started'
          }
        />
        <StatCard
          icon={Users}
          label="Contractors"
          value={contractorsLoading ? '…' : String(contractorCount)}
          sub={
            contractorCount > 0
              ? 'On the company roster'
              : 'Add contractors to run payroll'
          }
        />
        <StatCard
          icon={DollarSign}
          label="Payroll Runs"
          value={runsLoading ? '…' : String(runs?.length ?? 0)}
          sub={
            (runs?.length ?? 0) > 0 ? 'Across all runs on-chain' : 'No runs created yet'
          }
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
          {error && (
            <div className="p-3 mb-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
          {store.getWalletAddress() ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-stellar-400 block mb-1">
                  Connected Wallet
                </label>
                <code className="text-xs bg-stellar-950 px-3 py-2 rounded block truncate text-stellar-200">
                  {store.getWalletAddress()}
                </code>
              </div>
              <button
                onClick={() => navigate('/portal')}
                className="w-full px-4 py-3 bg-stellar-800 hover:bg-stellar-700 rounded-lg text-sm text-white transition-colors"
              >
                Open Contractor Portal
              </button>
            </div>
          ) : (
            <button
              onClick={handleCreateAccount}
              disabled={creating}
              className="w-full px-4 py-3 bg-stellar-600 hover:bg-stellar-500 disabled:bg-stellar-700 rounded-lg text-sm text-white transition-colors"
            >
              {creating ? 'Creating...' : 'Create Test Account'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
