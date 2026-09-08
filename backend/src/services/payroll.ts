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
    return scValToNative(scValFromLedgerEntry(result.val)) as Company;
  }
}

interface Company {
  admin: string;
  signers: string[];
  min_signers: number;
  token: string;
  active: boolean;
}

export const payrollService = new PayrollService();