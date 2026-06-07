import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { CompanySetup } from './pages/CompanySetup';
import { Contractors } from './pages/Contractors';
import { Payroll } from './pages/Payroll';
import { PaymentStreams } from './pages/PaymentStreams';
import { ContractorPortal } from './pages/ContractorPortal';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/setup" element={<CompanySetup />} />
        <Route path="/contractors" element={<Contractors />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/streams" element={<PaymentStreams />} />
        <Route path="/portal" element={<ContractorPortal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
