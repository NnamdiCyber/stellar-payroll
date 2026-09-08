import { Keypair, nativeToScVal, scValToNative, xdr, Address } from '@stellar/stellar-sdk';
import { stellarService } from './stellar.js';
import { loadEnv } from '../config/index.js';

const env = loadEnv();

function getContractId(): string {
  if (!env.PAYROLL_CONTRACT_ID) {
    throw new Error('PAYROLL_CONTRACT_ID not configured');
  }
  return env.PAYROLL_CONTRACT_ID;
}

function scvAddress(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

function scvString(s: string): xdr.ScVal {
  return nativeToScVal(s, { type: 'string' });
}

function scvI128(amount: string): xdr.ScVal {
  return nativeToScVal(amount, { type: 'i128' });
}

function scvU64(val: number): xdr.ScVal {
  return nativeToScVal(val, { type: 'u64' });
}

function scvU32(val: number): xdr.ScVal {
  return nativeToScVal(val, { type: 'u32' });
}

function scvVec(items: xdr.ScVal[]): xdr.ScVal {
  return xdr.ScVal.scvVec(items);
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

    const txHash = await stellarService.invokeContract(
      getContractId(),
      'create_payroll_run',
      args,
      adminKp,
    );

    return { runId: 0, transactionHash: txHash };
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

  async getCompany(companyAddress: string): Promise<any> {
    const result = await stellarService.getRpc().getContractData(
      getContractId(),
      xdr.ScVal.scvAddress(new Address(companyAddress).toScAddress()),
    );
    const entry: any = result.val.value();
    return scValToNative(entry.val);
  }
}

export const payrollService = new PayrollService();
