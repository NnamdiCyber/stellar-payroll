import {
  Keypair,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  Operation,
  BASE_FEE,
  Address,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

const RPC_URL =
  process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

// USDC Soroban token on Stellar testnet.
const USDC_TESTNET_CONTRACT = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2QFCYDX';

const PAYROLL_CONTRACT_ID = process.env.PAYROLL_CONTRACT_ID ?? '';
const STREAM_CONTRACT_ID = process.env.STREAM_CONTRACT_ID ?? '';
const TOKEN_CONTRACT_ID =
  process.env.PAYMENT_TOKEN_CONTRACT ?? USDC_TESTNET_CONTRACT;

const rpc = new SorobanRpc.Server(RPC_URL);

function scvAddress(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

function scvU64(value: number): xdr.ScVal {
  return nativeToScVal(value.toString(), { type: 'u64' });
}

function scvU32(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: 'u32' });
}

function scvString(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: 'string' });
}

function scvI128(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: 'i128' });
}

function scvVec(items: xdr.ScVal[]): xdr.ScVal {
  return xdr.ScVal.scvVec(items);
}

async function fund(publicKey: string) {
  const resp = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  const result = (await resp.json()) as { hash?: string };
  if (!resp.ok) {
    throw new Error(`Friendbot funding failed: ${result.hash ?? 'unknown'}`);
  }
}

async function waitForSuccess(hash: string) {
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const response = await rpc.getTransaction(hash);
    if (response.status === 'SUCCESS') {
      return response;
    }
    if (response.status === 'FAILED') {
      throw new Error(`Transaction ${hash} failed to settle`);
    }
  }
  throw new Error(`Timed out waiting for transaction ${hash}`);
}

async function invokeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  source: Keypair,
): Promise<string> {
  const account = await rpc.getAccount(source.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: method,
        args,
        source: source.publicKey(),
      }),
    )
    .setTimeout(60)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation error on ${method}: ${simulation.error}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, simulation).build();
  prepared.sign(source);
  const sent = await rpc.sendTransaction(prepared);
  if (sent.status !== 'PENDING' && sent.status !== 'DUPLICATE') {
    throw new Error(`Send failed for ${method}: ${sent.status}`);
  }
  console.log(`  ${method} → ${sent.hash}`);
  await waitForSuccess(sent.hash!);
  return sent.hash!;
}

async function main() {
  if (!PAYROLL_CONTRACT_ID || !STREAM_CONTRACT_ID) {
    console.error(
      'PAYROLL_CONTRACT_ID and STREAM_CONTRACT_ID are required. ' +
        'Deploy first (npm run deploy:payroll && npm run deploy:stream) and export the IDs.',
    );
    process.exit(1);
  }

  console.log('Seeding testnet with demo payroll data...');
  console.log(`Payroll contract: ${PAYROLL_CONTRACT_ID}`);
  console.log(`Stream contract:  ${STREAM_CONTRACT_ID}`);
  console.log(`Token contract:   ${TOKEN_CONTRACT_ID}`);

  const admin = Keypair.random();
  const signer = Keypair.random();
  const contractor = Keypair.random();

  console.log('\n1. Creating and funding accounts...');
  await fund(admin.publicKey());
  await fund(signer.publicKey());
  await fund(contractor.publicKey());
  console.log('  Admin:', admin.publicKey());
  console.log('  Signer:', signer.publicKey());
  console.log('  Contractor:', contractor.publicKey());

  console.log('\n2. Registering company (multisig 2/2)...');
  await invokeContract(
    PAYROLL_CONTRACT_ID,
    'register_company',
    [
      scvAddress(admin.publicKey()),
      scvVec([scvAddress(admin.publicKey()), scvAddress(signer.publicKey())]),
      scvU32(2),
      scvAddress(TOKEN_CONTRACT_ID),
    ],
    admin,
  );

  console.log('\n3. Adding contractor...');
  await invokeContract(
    PAYROLL_CONTRACT_ID,
    'add_contractor',
    [
      scvAddress(admin.publicKey()),
      scvAddress(contractor.publicKey()),
      scvString('Aisha Bello'),
      scvString('aisha@example.com'),
    ],
    admin,
  );

  console.log('\n4. Creating payroll run and payment...');
  const now = Math.floor(Date.now() / 1000);
  await invokeContract(
    PAYROLL_CONTRACT_ID,
    'create_payroll_run',
    [scvAddress(admin.publicKey()), scvU64(now - 30 * 86400), scvU64(now)],
    admin,
  );
  await invokeContract(
    PAYROLL_CONTRACT_ID,
    'add_payment',
    [
      scvAddress(admin.publicKey()),
      scvU64(0),
      scvAddress(contractor.publicKey()),
      scvI128('5000000000'),
      scvAddress(TOKEN_CONTRACT_ID),
      scvString('Seed run payment'),
    ],
    admin,
  );

  console.log('\n5. Approving payroll run (2-of-2)...');
  await invokeContract(
    PAYROLL_CONTRACT_ID,
    'approve_payroll_run',
    [scvAddress(admin.publicKey()), scvU64(0), scvAddress(admin.publicKey())],
    admin,
  );
  await invokeContract(
    PAYROLL_CONTRACT_ID,
    'approve_payroll_run',
    [scvAddress(admin.publicKey()), scvU64(0), scvAddress(signer.publicKey())],
    signer,
  );

  console.log('\n6. Executing payroll run (requires funded escrow)...');
  try {
    await invokeContract(
      PAYROLL_CONTRACT_ID,
      'execute_payroll_run',
      [scvAddress(admin.publicKey()), scvU64(0), scvAddress(signer.publicKey())],
      signer,
    );
  } catch (err) {
    console.warn(
      '  Skipped: escrow needs USDC. Deposit via deposit_to_escrow after funding the contract with testnet USDC.',
    );
  }

  console.log('\n7. Creating payment stream (requires sender token balance)...');
  try {
    await invokeContract(
      STREAM_CONTRACT_ID,
      'create_stream',
      [
        scvAddress(admin.publicKey()),
        scvAddress(contractor.publicKey()),
        scvAddress(TOKEN_CONTRACT_ID),
        scvI128('100'),
        scvI128('10000000'),
        scvU64(30 * 86400),
        scvString('Seed stream'),
      ],
      admin,
    );
  } catch (err) {
    console.warn(
      '  Skipped: stream funding needs the sender to hold testnet USDC for the escrow.',
    );
  }

  console.log('\n=== SEED COMPLETE ===');
  console.log(`Admin secret:      ${admin.secret()}`);
  console.log(`Signer secret:     ${signer.secret()}`);
  console.log(`Contractor public: ${contractor.publicKey()}`);
  console.log('\nUse these in the dashboard to see the seeded data.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});