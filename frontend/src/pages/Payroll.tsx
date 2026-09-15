import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DollarSign, Calendar, Send, CheckSquare, PiggyBank, Plus } from 'lucide-react';
import { api } from '../api/client';
import { usePayrollRuns, useCompany, useContractorsDetailed } from '../hooks/queries';
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

  const [escrowAmount, setEscrowAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [escrowBalance, setEscrowBalance] = useState<string | null>(null);

  const [paymentRunId, setPaymentRunId] = useState('');
  const [paymentContractor, setPaymentContractor] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMemo, setPaymentMemo] = useState('');
  const [addingPayment, setAddingPayment] = useState(false);

  const queryClient = useQueryClient();
  const { data: runs, isLoading } = usePayrollRuns(companyAddress);
  const { data: company } = useCompany(companyAddress);
  const { data: contractors } = useContractorsDetailed(companyAddress);

  const activeContractors = (contractors ?? []).filter((c) => c.active);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['payroll-runs', companyAddress] });
  }

  async function refreshBalance() {
    if (!companyAddress || !company?.token) {
      setEscrowBalance(null);
      return;
    }
    try {
      const data = await api.getCompanyBalance(companyAddress, company.token);
      setEscrowBalance(data.balance);
    } catch (err: unknown) {
      setEscrowBalance(null);
    }
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

  async function depositEscrow(e: React.FormEvent) {
    e.preventDefault();
    if (!adminSecret) {
      setError('Enter the admin secret key to fund escrow');
      return;
    }
    setDepositing(true);
    setError('');
    try {
      await api.depositToEscrow({
        adminSecretKey: adminSecret,
        companyAddress,
        tokenAddress: company!.token,
        amount: escrowAmount,
      });
      setEscrowAmount('');
      await refreshBalance();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to deposit to escrow');
    } finally {
      setDepositing(false);
    }
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!adminSecret) {
      setError('Enter the admin secret key to add a payment');
      return;
    }
    setAddingPayment(true);
    setError('');
    try {
      await api.addPayment({
        adminSecretKey: adminSecret,
        companyAddress,
        runId: Number(paymentRunId),
        contractorAddress: paymentContractor,
        amount: paymentAmount,
        currency: company!.token,
        memo: paymentMemo || undefined,
      });
      setPaymentAmount('');
      setPaymentMemo('');
      invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add payment');
    } finally {
      setAddingPayment(false);
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
    Executing: 'text-purple-400 bg-purple-900/30 border-purple-800',
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={depositEscrow}
          className="bg-stellar-900 border border-stellar-800 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-stellar-300 text-sm font-medium">
              <PiggyBank className="w-4 h-4" />
              Fund Escrow
            </div>
            {escrowBalance !== null && (
              <button
                type="button"
                onClick={refreshBalance}
                className="text-xs text-stellar-400 hover:text-stellar-200"
              >
                Balance: {escrowBalance}
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs text-stellar-400 mb-1">
              Payment Token Contract
            </label>
            <input
              type="text"
              value={company?.token ?? ''}
              readOnly
              className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white/70 focus:outline-none"
              placeholder="Loads from the registered company"
            />
          </div>

          <div>
            <label className="block text-xs text-stellar-400 mb-1">Amount</label>
            <input
              type="text"
              value={escrowAmount}
              onChange={(e) => setEscrowAmount(e.target.value)}
              className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
              placeholder="e.g. 1000000 (1 USDC = 10^7 units)"
              required
              disabled={!company?.token}
            />
          </div>

          <button
            type="submit"
            disabled={depositing || !company?.token}
            className="w-full px-4 py-2.5 bg-stellar-600 hover:bg-stellar-500 disabled:bg-stellar-700 rounded-lg text-sm text-white font-medium transition-colors"
          >
            {depositing ? 'Depositing...' : 'Deposit to Escrow'}
          </button>
          <p className="text-xs text-stellar-500">
            Runs draw from the company's on-chain escrow at execution time.
          </p>
        </form>

        <form
          onSubmit={addPayment}
          className="bg-stellar-900 border border-stellar-800 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-stellar-300 text-sm font-medium">
            <Plus className="w-4 h-4" />
            Add Payment to Run
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stellar-400 mb-1">Run</label>
              <select
                value={paymentRunId}
                onChange={(e) => setPaymentRunId(e.target.value)}
                className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
                required
              >
                <option value="" disabled>
                  Select run
                </option>
                {(runs ?? [])
                  .filter((run) => run.status === 'Pending')
                  .map((run) => (
                    <option key={run.id} value={run.id}>
                      Run #{run.id} · {run.status}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stellar-400 mb-1">Contractor</label>
              <select
                value={paymentContractor}
                onChange={(e) => setPaymentContractor(e.target.value)}
                className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
                required
              >
                <option value="" disabled>
                  Select contractor
                </option>
                {activeContractors.map((c) => (
                  <option key={c.wallet} value={c.wallet}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stellar-400 mb-1">Amount</label>
              <input
                type="text"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
                placeholder="e.g. 1000000"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-stellar-400 mb-1">Memo</label>
              <input
                type="text"
                value={paymentMemo}
                onChange={(e) => setPaymentMemo(e.target.value)}
                maxLength={256}
                className="w-full px-3 py-2 bg-stellar-950 border border-stellar-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-stellar-500"
                placeholder="January salary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={addingPayment || activeContractors.length === 0}
            className="w-full px-4 py-2.5 bg-stellar-600 hover:bg-stellar-500 disabled:bg-stellar-700 rounded-lg text-sm text-white font-medium transition-colors"
          >
            {addingPayment ? 'Adding...' : 'Add Payment'}
          </button>
        </form>
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