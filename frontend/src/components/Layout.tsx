import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Building2,
  Users,
  DollarSign,
  Waves,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/setup', icon: Building2, label: 'Company Setup' },
  { to: '/contractors', icon: Users, label: 'Contractors' },
  { to: '/payroll', icon: DollarSign, label: 'Payroll Runs' },
  { to: '/streams', icon: Waves, label: 'Payment Streams' },
  { to: '/portal', icon: ExternalLink, label: 'Contractor Portal' },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-stellar-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-30 w-64 bg-stellar-900 border-r border-stellar-800 transform transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center gap-3 px-6 h-16 border-b border-stellar-800">
          <div className="w-8 h-8 bg-stellar-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">SP</span>
          </div>
          <span className="text-white font-semibold text-lg">StellarPay</span>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-stellar-800 text-white'
                    : 'text-stellar-300 hover:text-white hover:bg-stellar-800/50',
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="h-16 border-b border-stellar-800 bg-stellar-900/50 backdrop-blur flex items-center px-4 lg:px-6 gap-4">
          <button
            className="lg:hidden text-stellar-300"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-xs text-stellar-400">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Testnet
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
