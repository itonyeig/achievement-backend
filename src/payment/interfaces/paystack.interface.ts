export interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface PaystackErrorResponse {
  status?: boolean;
  message?: string;
}

export interface PaystackTransferRecipient {
  recipient_code: string;
}

export interface CreateTransferRecipientInput {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

export interface TransferRecipient {
  recipientCode: string;
}

export interface InitiateTransferInput {
  amountInKobo: number;
  recipientCode: string;
  reference: string;
  reason: string;
}

export interface PaystackTransfer {
  reference: string;
  status: string;
  transfer_code: string;
}

export interface InitiatedTransfer {
  providerReference: string;
}
