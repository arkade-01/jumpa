// state/bankState.ts
interface BankUpdateState {
  step: 'awaiting_bank_name' | 'awaiting_account_name' | 'awaiting_account_number' | 'awaiting_final_confirmation' | 'awaiting_withdrawal_pin' | 'awaiting_withdrawal_pin_confirmation';
  data: {
    bankName?: string;
    bankCode?: string;
    accountName?: string;
    accountNumber?: string;
    withdrawalPin?: number;
  };
}

const bankUpdateState = new Map<number, BankUpdateState>();

export function setBankUpdateState(userId: number, step: BankUpdateState['step'], data: BankUpdateState['data'] = {}) {
  const existingState = bankUpdateState.get(userId);
  const existingData = existingState ? existingState.data : {};
  bankUpdateState.set(userId, { step, data: { ...existingData, ...data } });
}

export function getBankUpdateState(userId:number): BankUpdateState | undefined {
  return bankUpdateState.get(userId);
}

export function clearBankUpdateState(userId: number) {
  bankUpdateState.delete(userId);
}