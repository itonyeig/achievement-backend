export interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface PaystackErrorResponse {
  status?: boolean;
  message?: string;
}

export interface PaystackBank {
  name: string;
  code: string;
}

export interface PaystackResolvedAccount {
  account_number: string;
  account_name: string;
  bank_id?: number;
}

export interface PaystackTransferRecipient {
  recipient_code: string;
}

export interface ResolvedBankAccount {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

export type CreateTransferRecipientInput = ResolvedBankAccount;

export interface TransferRecipient {
  recipientCode: string;
}
