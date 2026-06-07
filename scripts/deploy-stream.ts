import { Keypair, SorobanRpc, TransactionBuilder, Networks, BASE_FEE } from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

async function main() {
  const adminKp = Keypair.random();
  console.log('Admin public key:', adminKp.publicKey());
  console.log('Admin secret key:', adminKp.secret());

  console.log('Funding account...');
  const resp = await fetch(
    `https://friendbot.stellar.org?addr=${adminKp.publicKey()}`,
  );
  await resp.json();
  console.log('Funded');

  const wasmPath = path.join(
    __dirname,
    '..',
    'contracts',
    'payment-stream',
    'target',
    'wasm32-unknown-unknown',
    'release',
    'payment_stream.wasm',
  );

  if (!fs.existsSync(wasmPath)) {
    console.error(
      'WASM not found. Build it first: cd contracts/payment-stream && cargo build --target wasm32-unknown-unknown --release',
    );
    process.exit(1);
  }

  const wasm = fs.readFileSync(wasmPath);
  const rpc = new SorobanRpc.Server(RPC_URL);
  const account = await rpc.getAccount(adminKp.publicKey());

  console.log('Uploading WASM...');
  const uploadTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      SorobanRpc.Operations.uploadContractWasm({
        wasm,
        source: adminKp.publicKey(),
      }),
    )
    .setTimeout(30)
    .build();

  uploadTx.sign(adminKp);
  const uploadResp = await rpc.sendTransaction(uploadTx);
  if (uploadResp.status !== 'PENDING') {
    console.error('Upload failed:', uploadResp);
    process.exit(1);
  }
  console.log('WASM uploaded, tx:', uploadResp.hash);

  let wasmId: string | null = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const txResp = await rpc.getTransaction(uploadResp.hash!);
    if (txResp.status === 'SUCCESS') {
      wasmId = txResp.returnValue as unknown as string;
      break;
    }
  }
  if (!wasmId) { console.error('Failed to get wasm id'); process.exit(1); }
  console.log('WASM ID:', wasmId);

  const account2 = await rpc.getAccount(adminKp.publicKey());
  const createTx = new TransactionBuilder(account2, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      SorobanRpc.Operations.createContract({
        wasmId,
        source: adminKp.publicKey(),
      }),
    )
    .setTimeout(30)
    .build();

  createTx.sign(adminKp);
  const createResp = await rpc.sendTransaction(createTx);
  if (createResp.status !== 'PENDING') { console.error('Create failed:', createResp); process.exit(1); }
  console.log('Contract creation tx:', createResp.hash);

  let contractId: string | null = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const txResp = await rpc.getTransaction(createResp.hash!);
    if (txResp.status === 'SUCCESS') {
      contractId = txResp.returnValue as unknown as string;
      break;
    }
  }
  if (!contractId) { console.error('Failed to get contract id'); process.exit(1); }

  console.log('\n=== DEPLOYMENT COMPLETE ===');
  console.log('STREAM_CONTRACT_ID:', contractId);
  console.log('Add to .env:');
  console.log(`STREAM_CONTRACT_ID=${contractId}`);
}

main().catch(console.error);
