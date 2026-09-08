import { Keypair, scValToNative } from '@stellar/stellar-sdk';
import {
  scvAddress,
  scvDataKey,
  scvString,
  scvI128,
  scvU64,
  scValFromLedgerEntry,
} from './scv.js';
import { stellarService } from './stellar.js';
import { loadEnv } from '../config/index.js';

const env = loadEnv();

function getContractId(): string {
  if (!env.STREAM_CONTRACT_ID) {
    throw new Error('STREAM_CONTRACT_ID not configured');
  }
  return env.STREAM_CONTRACT_ID;
}

export interface StreamRecord {
  sender: string;
  recipient: string;
  token: string;
  amount_per_second: bigint;
  max_amount: bigint;
  duration: bigint;
  created_at: bigint;
  cancelled: boolean;
  already_withdrawn: bigint;
  memo: string;
  total_funded: bigint;
}

export class StreamService {
  async createStream(
    senderSecretKey: string,
    recipientAddress: string,
    tokenAddress: string,
    amountPerSecond: string,
    maxAmount: string,
    durationSeconds: number,
    memo: string,
  ): Promise<{ streamId: number; transactionHash: string }> {
    const senderKp = Keypair.fromSecret(senderSecretKey);

    const args = [
      scvAddress(senderKp.publicKey()),
      scvAddress(recipientAddress),
      scvAddress(tokenAddress),
      scvI128(amountPerSecond),
      scvI128(maxAmount),
      scvU64(durationSeconds),
      scvString(memo),
    ];

    const retVal = await stellarService.simulateContractValue(
      getContractId(),
      'create_stream',
      args,
      senderKp.publicKey(),
    );
    const streamId = scValToNative(retVal) as number;

    const txHash = await stellarService.invokeContract(
      getContractId(),
      'create_stream',
      args,
      senderKp,
    );

    return { streamId, transactionHash: txHash };
  }

  async withdraw(
    streamId: number,
    recipientSecretKey: string,
    amount: string,
  ): Promise<string> {
    const recipientKp = Keypair.fromSecret(recipientSecretKey);

    const args = [
      scvU64(streamId),
      scvI128(amount),
    ];

    return stellarService.invokeContract(
      getContractId(),
      'withdraw',
      args,
      recipientKp,
    );
  }

  async cancelStream(
    streamId: number,
    senderSecretKey: string,
  ): Promise<string> {
    const senderKp = Keypair.fromSecret(senderSecretKey);

    const args = [scvU64(streamId)];

    return stellarService.invokeContract(
      getContractId(),
      'cancel_stream',
      args,
      senderKp,
    );
  }

  async getStream(streamId: number): Promise<unknown> {
    const result = await stellarService.getRpc().getContractData(
      getContractId(),
      scvDataKey('Stream', scvU64(streamId)),
    );
    return scValToNative(scValFromLedgerEntry(result.val));
  }
}

export const streamService = new StreamService();