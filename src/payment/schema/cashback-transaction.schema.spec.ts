import { BADGE_NAMES } from '../../badge/constants/badge.constants';
import { CashbackTransactionSchema } from './cashback-transaction.schema';

describe('CashbackTransactionSchema', () => {
  it('restricts persisted cashback records to configured badge names', () => {
    expect(CashbackTransactionSchema.path('badgeName').options.required).toBe(
      true,
    );
    expect(CashbackTransactionSchema.path('badgeName').options.enum).toEqual(
      BADGE_NAMES,
    );
  });
});
