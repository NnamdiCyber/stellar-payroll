import { useState } from 'react';
import { DollarSign, Calendar, CheckCircle, Send } from 'lucide-react';

export function Payroll() {
  const [companyAddress, setCompanyAddress] = useState('');
  const [runs, setRuns] = useState<
    Array<{
      id: number;
      periodStart: string;
      periodEnd: string;
      status: string;
      totalAmount: string;
      paymentCount: number;
    }>
  >([]);

  async function createRun() {
    const periodStart = Math.floor(Date.now() / 1000) - 30 * 86400;
    const periodEnd = Math.floor(Date.now() / 1000);

    try {
      const res = await fetch('/api/v1/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyAddress,
          periodStart,
          periodEnd,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRuns([
          {
            id: runs.length + 1,
            periodStart: new Date(periodStart * 1000).toLocaleDateString(),
            periodEnd: new Date(periodEnd * 1000).toLocaleDateString(),
            status: 'Pending',
            totalAmount: '—',
            paymentCount: 0,
          },
          ...runs,
        ]);
      }
    } catch (err) {
      console.error(err);
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

      <div className="bg-stellar-900 border border-stellar-800 rounded-xl p-6">
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

        {runs.length === 0 ? (
          <div className="p-12 text-center text-stellar-500 text-sm">
            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No payroll runs yet. Create one to get started.
          </div>
        ) : (
          <div className="divide-y divide-stellar-800">
            {runs.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-4 hover:bg-stellar-950/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-stellar-800 rounded-lg">
                    <DollarSign className="w-4 h-4 text-stellar-300" />
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">
                      Run #{run.id}
                    </div>
                    <div className="text-xs text-stellar-400">
                      {run.periodStart} → {run.periodEnd}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-stellar-300">{run.paymentCount} payments</span>
                  <span
                    className={`text-xs px-2 py-1 rounded border ${
                      statusColors[run.status] || 'text-stellar-400'
                    }`}
                  >
                    {run.status}
                  </span>
                  {run.status === 'Approved' && (
                    <button className="flex items-center gap-1 text-xs text-stellar-400 hover:text-stellar-200">
                      <Send className="w-3 h-3" />
                      Execute
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
