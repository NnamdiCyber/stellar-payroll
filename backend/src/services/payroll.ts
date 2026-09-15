import { Keypair, scValToNative } from '@stellar/stellar-sdk';
import {
  scvAddress,
  scvDataKey,
  scvString,
  scvI128,
  scvU64,
  scvU32,
  scvVec,
  scValFromLedgerEntry,
} from './scv.js';
import { stellarService } from './stellar.js';
import { loadEnv } from '../config/index.js';

const env = loadEnv();

function getContractId(): string {
  if (!env.PAYROLL_CONTRACT_ID) {
    throw new Error('PAYROLL_CONTRACT_ID not configured');
  }
  return env.PAYROLL_CONTRACT_ID;
}

export class PayrollService {
  async registerCompany(
    adminSecretKey: string,
    signers: string[],
    minSigners: number,
    tokenAddress: string,
  ): Promise<{ transactionHash: string; companyAddress: string }> {
    const adminKp = Keypair.fromSecret(adminSecretKey);
    const companyAddress = adminKp.publicKey();
    const signerVals = signers.map((s) => scvAddress(s));

    const args = [
      scvAddress(companyAddress),
      scvVec(signerVals),
      scvU32(minSigners),
      scvAddress(tokenAddress),
    ];

    const txHash = await stellarService.invokeContract(
      getContractId(),
      'register_company',
      args,
      adminKp,
    );

    return { transactionHash: txHash, companyAddress };
  }

  async addContractor(
    companyAddress: string,
    contractorAddress: string,
    name: string,
    email: string,
    adminSecretKey: string,
  ): Promise<string> {
    const adminKp = Keypair.fromSecret(adminSecretKey);

    const args = [
      scvAddress(companyAddress),
      scvAddress(contractorAddress),
      scvString(name),
      scvString(email),
    ];

    return stellarService.invokeContract(
      getContractId(),
      'add_contractor',
      args,
      adminKp,
    );
  }

  async removeContractor(
    companyAddress: string,
    contractorAddress: string,
    adminSecretKey: string,
  ): Promise<string> {
    const adminKp = Keypair.fromSecret(adminSecretKey);

    const args = [
      scvAddress(companyAddress),
      scvAddress(contractorAddress),
    ];

    return stellarService.invokeContract(
      getContractId(),
      'remove_contractor',
      args,
      adminKp,
    );
  }

  async createPayrollRun(
    companyAddress: string,
    periodStart: number,
    periodEnd: number,
    adminSecretKey: string,
  ): Promise<{ runId: number; transactionHash: string }> {
    const adminKp = Keypair.fromSecret(adminSecretKey);

    const args = [
      scvAddress(companyAddress),
      scvU64(periodStart),
      scvU64(periodEnd),
    ];

    const retVal = await stellarService.simulateContractValue(
      getContractId(),
      'create_payroll_run',
      args,
      adminKp.publicKey(),
    );
    const runId = scValToNative(retVal) as number;

    const txHash = await stellarService.invokeContract(
      getContractId(),
      'create_payroll_run',
      args,
      adminKp,
    );

    return { runId, transactionHash: txHash };
  }

  async addPayment(
    companyAddress: string,
    runId: number,
    contractorAddress: string,
    amount: string,
    currency: string,
    memo: string,
    adminSecretKey: string,
  ): Promise<string> {
    const adminKp = Keypair.fromSecret(adminSecretKey);

    const args = [
      scvAddress(companyAddress),
      scvU64(runId),
      scvAddress(contractorAddress),
      scvI128(amount),
      scvAddress(currency),
      scvString(memo),
    ];

    return stellarService.invokeContract(
      getContractId(),
      'add_payment',
      args,
      adminKp,
    );
  }

  async approvePayrollRun(
    companyAddress: string,
    runId: number,
    signerSecretKey: string,
  ): Promise<string> {
    const signerKp = Keypair.fromSecret(signerSecretKey);

    const args = [
      scvAddress(companyAddress),
      scvU64(runId),
      scvAddress(signerKp.publicKey()),
    ];

    return stellarService.invokeContract(
      getContractId(),
      'approve_payroll_run',
      args,
      signerKp,
    );
  }

  async executePayrollRun(
    companyAddress: string,
    runId: number,
    signerSecretKey: string,
  ): Promise<string> {
    const signerKp = Keypair.fromSecret(signerSecretKey);

    const args = [
      scvAddress(companyAddress),
      scvU64(runId),
      scvAddress(signerKp.publicKey()),
    ];

    return stellarService.invokeContract(
      getContractId(),
      'execute_payroll_run',
      args,
      signerKp,
    );
  }

  async getCompany(companyAddress: string): Promise<Company> {
    const result = await stellarService.getRpc().getContractData(
      getContractId(),
      scvDataKey('Company', scvAddress(companyAddress)),
    );
    return mapCompany(scValToNative(scValFromLedgerEntry(result.val)));
  }

  async getContractor(
    companyAddress: string,
    contractorAddress: string,
  ): Promise<Contractor> {
    const result = await stellarService.getRpc().getContractData(
      getContractId(),
      scvDataKey(
        'Contractor',
        scvAddress(companyAddress),
        scvAddress(contractorAddress),
      ),
    );
    return mapContractor(scValToNative(scValFromLedgerEntry(result.val)));
  }

  async getCompanyContractors(companyAddress: string): Promise<string[]> {
    try {
      const result = await stellarService.getRpc().getContractData(
        getContractId(),
        scvDataKey('CompanyContractors', scvAddress(companyAddress)),
      );
      const value = scValToNative(scValFromLedgerEntry(result.val));
      return Array.isArray(value) ? value.map(String) : [];
    } catch (err: unknown) {
      return [];
    }
  }

  async getPayrollRun(runId: number): Promise<PayrollRun> {
    const result = await stellarService.getRpc().getContractData(
      getContractId(),
      scvDataKey('PayrollRun', scvU64(runId)),
    );
    return mapPayrollRun(scValToNative(scValFromLedgerEntry(result.val)));
  }

  async getNextRunId(): Promise<number> {
    try {
      const result = await stellarService.getRpc().getContractData(
        getContractId(),
        scvDataKey('NextRunId'),
      );
      return Number(scValToNative(scValFromLedgerEntry(result.val)));
    } catch (err: unknown) {
      return 0;
    }
  }

  async getPayment(
    runId: number,
    contractorAddress: string,
  ): Promise<PaymentEntry> {
    const result = await stellarService.getRpc().getContractData(
      getContractId(),
      scvDataKey('Payment', scvU64(runId), scvAddress(contractorAddress)),
    );
    return mapPayment(scValToNative(scValFromLedgerEntry(result.val)));
  }

  async getCompanyBalance(
    companyAddress: string,
    tokenAddress: string,
  ): Promise<string> {
    try {
      const result = await stellarService.getRpc().getContractData(
        getContractId(),
        scvDataKey('Escrow', scvAddress(companyAddress), scvAddress(tokenAddress)),
      );
      return i128ToString(scValToNative(scValFromLedgerEntry(result.val)));
    } catch (err: unknown) {
      return '0';
    }
  }
}

interface Company {
  admin: string;
  signers: string[];
  min_signers: number;
  token: string;
  active: boolean;
}

interface Contractor {
  wallet: string;
  name: string;
  email: string;
  active: boolean;
  total_paid: string;
}

interface PayrollRun {
  id: string;
  company: string;
  period_start: string;
  period_end: string;
  status: string;
  total_amount: string;
  payment_count: number;
  approvals: string[];
  created_at: string;
  executed_at: string;
}

interface PaymentEntry {
  contractor: string;
  amount: string;
  currency: string;
  memo: string;
  paid: boolean;
  tx_hash: string;
}

function i128ToString(value: unknown): string {
  return typeof value === 'bigint' ? value.toString() : String(value);
}

function mapCompany(raw: unknown): Company {
  const [admin, signers, minSigners, token, active] = raw as unknown[];
  return {
    admin: String(admin),
    signers: (signers as unknown[]).map(String),
    min_signers: Number(minSigners),
    token: String(token),
    active: Boolean(active),
  };
}

function mapContractor(raw: unknown): Contractor {
  const [wallet, name, email, active, totalPaid] = raw as unknown[];
  return {
    wallet: String(wallet),
    name: String(name),
    email: String(email),
    active: Boolean(active),
    total_paid: i128ToString(totalPaid),
  };
}

function mapPayrollRun(raw: unknown): PayrollRun {
  const [
    id,
    company,
    periodStart,
    periodEnd,
    status,
    totalAmount,
    paymentCount,
    approvals,
    createdAt,
    executedAt,
  ] = raw as unknown[];
  return {
    id: i128ToString(id),
    company: String(company),
    period_start: i128ToString(periodStart),
    period_end: i128ToString(periodEnd),
    status: String(status),
    total_amount: i128ToString(totalAmount),
    payment_count: Number(paymentCount),
    approvals: (approvals as unknown[]).map(String),
    created_at: i128ToString(createdAt),
    executed_at: i128ToString(executedAt),
  };
}

function mapPayment(raw: unknown): PaymentEntry {
  const [contractor, amount, currency, memo, paid, txHash] = raw as unknown[];
  const bytes = txHash as Uint8Array;
  return {
    contractor: String(contractor),
    amount: i128ToString(amount),
    currency: String(currency),
    memo: String(memo),
    paid: Boolean(paid),
    tx_hash: bytes instanceof Uint8Array ? Buffer.from(bytes).toString('hex') : String(txHash),
  };
}

export const payrollService = new PayrollService();
export type { Company, Contractor, PayrollRun, PaymentEntry };