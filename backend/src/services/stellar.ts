import {
  Asset,
  Horizon,
  Keypair,
  Operation,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  xdr,
} from '@stellar/stellar-sdk';

import { loadEnv } from '../config/index.js';

const env = loadEnv();

export class StellarService {
  private horizon: Horizon.Server;
  private rpc: SorobanRpc.Server;
  private networkPassphrase: string;

  constructor() {
    this.horizon = new Horizon.Server(env.STELLAR_HORIZON_URL);
    this.rpc = new SorobanRpc.Server(env.STELLAR_RPC_URL);
    this.networkPassphrase =
      env.STELLAR_NETWORK === 'mainnet'
        ? Networks.PUBLIC
        : env.STELLAR_NETWORK === 'testnet'
          ? Networks.TESTNET
          : Networks.STANDALONE;
  }

  getHorizon(): Horizon.Server {
    return this.horizon;
  }

  getRpc(): SorobanRpc.Server {
    return this.rpc;
  }

  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  getNetwork(): string {
    return env.STELLAR_NETWORK;
  }

  async fundAccount(publicKey: string): Promise<void> {
    if (env.STELLAR_NETWORK !== 'testnet') {
      throw new Error('Friendbot only available on testnet');
    }
    await this.horizon.friendbot(publicKey).call();
  }

  async invokeContract(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
    sourceKeypair: Keypair,
    options: { waitForConfirmation?: boolean } = {},
  ): Promise<string> {
    const account = await this.rpc.getAccount(sourceKeypair.publicKey());

    const contractTx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: method,
          args,
          source: sourceKeypair.publicKey(),
        }),
      )
      .setTimeout(30);

    const simResp = await this.rpc.simulateTransaction(contractTx.build());
    if (SorobanRpc.Api.isSimulationError(simResp)) {
      throw new Error(`Simulation error: ${simResp.error}`);
    }

    const preparedTx = SorobanRpc.assembleTransaction(
      contractTx.build(),
      simResp,
    );
    const prepared = preparedTx.build();
    prepared.sign(sourceKeypair);
    const sendResp = await this.rpc.sendTransaction(prepared);

    if (sendResp.status !== 'PENDING' && sendResp.status !== 'DUPLICATE') {
      throw new Error(`Transaction failed: ${sendResp.status}`);
    }

    if (options.waitForConfirmation) {
      await this.confirmTransaction(sendResp.hash!);
    }
    return sendResp.hash!;
  }

  /**
   * Poll `getTransaction` until the transaction settles, throwing when it
   * fails or the timeout elapses. Returns the final response so callers can
   * read the `returnValue` (e.g. a wasm id or contract id).
   */
  async confirmTransaction(
    hash: string,
    timeoutMs = 90_000,
    pollIntervalMs = 2_000,
  ): Promise<SorobanRpc.Api.GetTransactionResponse> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const response = await this.rpc.getTransaction(hash);
      if (response.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return response;
      }
      if (response.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction ${hash} failed to settle`);
      }
      if (response.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
        throw new Error(`Transaction ${hash} not found on network`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    throw new Error(`Transaction ${hash} did not settle within ${timeoutMs}ms`);
  }

  /**
   * Simulate a read-only (or dry-run) contract call and return the SCVal
   * behind it, without signing or submitting anything. Used to resolve
   * returned identifiers such as run/stream ids.
   */
  async simulateContractValue(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
    source: string,
  ): Promise<xdr.ScVal> {
    const account = await this.rpc.getAccount(source);

    const contractTx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: method,
          args,
          source,
        }),
      )
      .setTimeout(30);

    const simResp = await this.rpc.simulateTransaction(contractTx.build());
    if (!SorobanRpc.Api.isSimulationSuccess(simResp)) {
      throw new Error(
        `Simulation error: ${SorobanRpc.Api.isSimulationError(simResp) ? simResp.error : 'unknown'}`,
      );
    }
    const retval = simResp.result?.retval;
    if (!retval) {
      throw new Error(`Simulation for ${method} returned no result`);
    }
    return retval;
  }

  async getAccountBalance(publicKey: string): Promise<string> {
    const account = await this.horizon.loadAccount(publicKey);
    const xlmBalance = account.balances.find(
      (b: Horizon.HorizonApi.BalanceLine) => b.asset_type === 'native',
    );
    return xlmBalance?.balance || '0';
  }

  createAccount(): { publicKey: string; secretKey: string } {
    const kp = Keypair.random();
    return {
      publicKey: kp.publicKey(),
      secretKey: kp.secret(),
    };
  }

  async createTrustline(
    assetCode: string,
    issuerPublicKey: string,
    sourceKeypair: Keypair,
  ): Promise<void> {
    const account = await this.horizon.loadAccount(sourceKeypair.publicKey());
    const asset = new Asset(assetCode, issuerPublicKey);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.changeTrust({
          asset,
          source: sourceKeypair.publicKey(),
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(sourceKeypair);
    await this.horizon.submitTransaction(tx);
  }
}

export const stellarService = new StellarService();
