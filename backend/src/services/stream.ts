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
  id: number;
  sender: string;
  recipient: string;
  token: string;
  amountPerSecond: string;
  maxAmount: string;
  totalFunded: string;
  startTime: string;
  endTime: string;
  lastWithdrawTime: string;
  withdrawn: string;
  cancelled: boolean;
  memo: string;
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

  async getStream(streamId: number): Promise<StreamRecord> {
    const result = await stellarService.getRpc().getContractData(
      getContractId(),
      scvDataKey('Stream', scvU64(streamId)),
    );
    return mapStream(scValToNative(scValFromLedgerEntry(result.val)));
  }

  async getRecipientStreams(recipient: string): Promise<number[]> {
    const result = await stellarService.getRpc().getContractData(
      getContractId(),
      scvDataKey('RecipientStreams', scvAddress(recipient)),
    );
    const value = scValToNative(scValFromLedgerEntry(result.val));
    return (Array.isArray(value) ? value : []).map((id) => Number(id));
  }

  async getSenderStreams(sender: string): Promise<number[]> {
    const result = await stellarService.getRpc().getContractData(
      getContractId(),
      scvDataKey('SenderStreams', scvAddress(sender)),
    );
    const value = scValToNative(scValFromLedgerEntry(result.val));
    return (Array.isArray(value) ? value : []).map((id) => Number(id));
  }

  /**
   * Compute the amount a recipient may currently withdraw from a stream.
   * Mirrors the contract's `compute_available` (earned = rate × elapsed,
   * capped by max_amount, minus what was already withdrawn) using wall-clock
   * time, which is within seconds of the ledger close timestamp.
   */
  getAvailableAmount(stream: StreamRecord): string {
    const now = Math.floor(Date.now() / 1000);
    const start = Number(stream.startTime);
    const end = Number(stream.endTime);
    const elapsed = now >= end ? end - start : Math.max(0, now - start);

    const rate = BigInt(stream.amountPerSecond);
    const earned = rate * BigInt(elapsed);
    const cap = earned < BigInt(stream.maxAmount) ? earned : BigInt(stream.maxAmount);
    const available = cap - BigInt(stream.withdrawn);
    return available > 0n ? available.toString() : '0';
  }
}

function i128ToString(value: unknown): string {
  return typeof value === 'bigint' ? value.toString() : String(value);
}

function mapStream(raw: unknown): StreamRecord {
  const [
    id,
    sender,
    recipient,
    token,
    amountPerSecond,
    maxAmount,
    totalFunded,
    startTime,
    endTime,
    lastWithdrawTime,
    withdrawn,
    cancelled,
    memo,
  ] = raw as unknown[];
  return {
    id: Number(id),
    sender: String(sender),
    recipient: String(recipient),
    token: String(token),
    amountPerSecond: i128ToString(amountPerSecond),
    maxAmount: i128ToString(maxAmount),
    totalFunded: i128ToString(totalFunded),
    startTime: i128ToString(startTime),
    endTime: i128ToString(endTime),
    lastWithdrawTime: i128ToString(lastWithdrawTime),
    withdrawn: i128ToString(withdrawn),
    cancelled: Boolean(cancelled),
    memo: String(memo),
  };
}

export const streamService = new StreamService();