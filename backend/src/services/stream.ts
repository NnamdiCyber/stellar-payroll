import { Keypair, nativeToScVal, xdr, Address } from '@stellar/stellar-sdk';
import { stellarService } from './stellar.js';
import { loadEnv } from '../config/index.js';

const env = loadEnv();

function getContractId(): string {
  if (!env.STREAM_CONTRACT_ID) {
    throw new Error('STREAM_CONTRACT_ID not configured');
  }
  return env.STREAM_CONTRACT_ID;
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

    const txHash = await stellarService.invokeContract(
      getContractId(),
      'create_stream',
      args,
      senderKp,
    );

    return { streamId: 0, transactionHash: txHash };
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

  async getStream(streamId: number): Promise<any> {
    const result = await stellarService.getRpc().getContractData(
      getContractId(),
      xdr.ScVal.scvU64(new xdr.Uint64(streamId)),
    );
    return result;
  }
}

export const streamService = new StreamService();
