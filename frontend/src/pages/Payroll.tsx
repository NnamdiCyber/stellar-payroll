import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DollarSign, Calendar, Send, CheckSquare } from 'lucide-react';
import { api } from '../api/client';
import { usePayrollRuns } from '../hooks/queries';
import { usePersistentState } from './usePersistentState';
import { store } from '../api/storage';

export function Payroll() {
  const [adminSecret, setAdminSecret] = useState('');
  const [signerSecret, setSignerSecret] = useState('');
  const [companyAddress, setCompanyAddress] = usePersistentState(
    'stellarpay.companyAddress',
    store.getCompanyAddress(),
  );
  const [error, setError] = useState('');
  const [executing, setExecuting] = useState<number | null>(null);
  const [approving, setApproving] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { data: runs, isLoading } = usePayrollRuns(companyAddress);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['payroll-runs', companyAddress] });
  }

  async function createRun() {
    setError('');
    const periodStart = Math.floor(Date.now() / 1000) - 30 * 86400;
    const periodEnd = Math.floor(Date.now() / 1000);

    try {
      await api.createRun({
        adminSecretKey: adminSecret,
        companyAddress,
        periodStart,
        periodEnd,
      });
      invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create run');
    }
  }

  async function approveRun(id: number) {
    if (!signerSecret) {
      setError('Enter a signer secret key to approve the run');
      return;
    }
    setApproving(id);
    setError('');
    try {
      await api.approveRun({
        companyAddress,
        runId: id,
        signerSecretKey: signerSecret,
      });
      invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve run');
    } finally {
      setApproving(null);
    }
  }

  async function executeRun(id: number) {
    if (!signerSecret) {
      setError('Enter a signer secret key to execute the run');
      return;
    }
    setExecuting(id);
    setError('');
    try {
      await api.executeRun(id, companyAddress, signerSecret);
      invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to execute run');
    } finally {
      setExecuting(null);
    }
  }

  const statusColors: Record<string, string> = {
    Pending: 'text-yellow-400 bg-yellow-900/30 border-yellow-800',
    Approved: 'text-blue-400 bg-blue-900/30 border-blue-800',
    Completed: 'text-green-400 bg-green-900/30 border-green-800',
    Failed: 'text-red-400 bg-red-900/30 border-red-800',
    Cancelled: 'text-stellar-400 bg-stellar-800/30 border-stellar-700',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Payroll Runs</h1>
        <p className="text-stellar-400 mt-1">
          Create and manage batch payroll runs with multisig approval
        </p>
      </div>

      <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}
        <div className="flex items-center gap-4">
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            className="flex-1 px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
            placeholder="Admin secret key (S...)"
          />
        </div>
        <div className="flex items-center gap-4">
          <input
            type="password"
            value={signerSecret}
            onChange={(e) => setSignerSecret(e.target.value)}
            className="flex-1 px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
            placeholder="Signer secret key for approvals / execution (S...)"
          />
        </div>
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            className="flex-1 px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
            placeholder="Company Stellar address"
          />
          <button
            onClick={createRun}
            className="flex items-center gap-2 px-4 py-2 bg-stellar-600 hover:bg-stellar-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Calendar className="w-4 h-4" />
            New Payroll Run
          </button>
        </div>
      </div>

      <div className="bg-stellar-900 border border-stellar-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-stellar-800">
          <h2 className="text-sm font-medium text-stellar-300">Payroll History</h2>
        </div>

        {runs === undefined && isLoading ? (
          <div className="p-12 text-center text-stellar-500 text-sm">
            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Loading payroll history...
          </div>
        ) : (runs?.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-stellar-500 text-sm">
            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
            {companyAddress
              ? 'No payroll runs for this company yet. Create one to get started.'
              : 'Enter a company address and create a run to see history.'}
          </div>
        ) : (
          <div className="divide-y divide-stellar-800">
            {(runs ?? []).map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-4 hover:bg-stellar-950/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-stellar-800 rounded-lg">
                    <DollarSign className="w-4 h-4 text-stellar-300" />
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">Run #{run.id}</div>
                    <div className="text-xs text-stellar-400">
                      {new Date(Number(run.period_start) * 1000).toLocaleDateString()} →{' '}
                      {new Date(Number(run.period_end) * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-stellar-300">
                    {run.payment_count} payments
                  </span>
                  <span className="text-sm text-stellar-300">{run.total_amount}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded border ${
                      statusColors[run.status] || 'text-stellar-400'
                    }`}
                  >
                    {run.status}
                  </span>
                  {run.status === 'Pending' && (
                    <button
                      onClick={() => approveRun(Number(run.id))}
                      disabled={approving === Number(run.id)}
                      className="flex items-center gap-1 text-xs text-stellar-400 hover:text-stellar-200 disabled:opacity-50"
                    >
                      <CheckSquare className="w-3 h-3" />
                      {approving === Number(run.id) ? 'Approving...' : 'Approve'}
                    </button>
                  )}
                  {run.status === 'Approved' && (
                    <button
                      onClick={() => executeRun(Number(run.id))}
                      disabled={executing === Number(run.id)}
                      className="flex items-center gap-1 text-xs text-stellar-400 hover:text-stellar-200 disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                      {executing === Number(run.id) ? 'Executing...' : 'Execute'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
