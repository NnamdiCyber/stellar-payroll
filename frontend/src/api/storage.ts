const COMPANY_KEY = 'stellarpay.companyAddress';
const WALLET_KEY = 'stellarpay.walletAddress';

export const store = {
  getCompanyAddress(): string {
    return localStorage.getItem(COMPANY_KEY) ?? '';
  },
  setCompanyAddress(address: string): void {
    if (address) {
      localStorage.setItem(COMPANY_KEY, address);
    } else {
      localStorage.removeItem(COMPANY_KEY);
    }
  },
  getWalletAddress(): string {
    return localStorage.getItem(WALLET_KEY) ?? '';
  },
  setWalletAddress(address: string): void {
    if (address) {
      localStorage.setItem(WALLET_KEY, address);
    } else {
      localStorage.removeItem(WALLET_KEY);
    }
  },
};
