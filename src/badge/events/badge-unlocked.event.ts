import type { UserDocument } from '../../user/schema/user.schema';
import type { BadgeName } from '../constants/badge.constants';

export type BadgeUnlockedEvent = Readonly<{
  badge_name: BadgeName;
  user: UserDocument;
}>;
