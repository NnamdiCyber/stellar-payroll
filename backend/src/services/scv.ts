import { xdr, Address, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';

export function scvAddress(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

export function scvString(s: string): xdr.ScVal {
  return nativeToScVal(s, { type: 'string' });
}

export function scvI128(amount: string | number | bigint): xdr.ScVal {
  return nativeToScVal(amount.toString(), { type: 'i128' });
}

export function scvU64(val: number | bigint): xdr.ScVal {
  return nativeToScVal(val.toString(), { type: 'u64' });
}

export function scvU32(val: number): xdr.ScVal {
  return nativeToScVal(val, { type: 'u32' });
}

export function scvVec(items: xdr.ScVal[]): xdr.ScVal {
  return xdr.ScVal.scvVec(items);
}

export function scvSymbol(name: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(name);
}

/**
 * Build a contract storage data key for a #[contracttype] enum variant such
 * as `DataKey::Company(Address)` or `DataKey::Stream(u64)`. The serialized
 * form is a vector tagged with the variant's symbol name.
 */
export function scvDataKey(name: string, ...params: xdr.ScVal[]): xdr.ScVal {
  return xdr.ScVal.scvVec([scvSymbol(name), ...params]);
}

export function toNative<T = unknown>(val: xdr.ScVal): T {
  return scValToNative(val) as T;
}

/** Extract the stored ScVal from a contract-data ledger entry. */
export function scValFromLedgerEntry(entry: xdr.LedgerEntryData): xdr.ScVal {
  if (String(entry.switch()) === 'ledgerEntryTypeContractData') {
    return (entry.data() as unknown as xdr.ContractDataEntry).val();
  }
  throw new Error(`Unexpected ledger entry type: ${String(entry.switch())}`);
}