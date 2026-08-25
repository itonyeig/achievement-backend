import type { UserDocument } from '../../user/schema/user.schema';
import type { AchievementName } from '../constants/achievement.constants';

export type AchievementUnlockedEvent = Readonly<{
  achievement_name: AchievementName;
  user: UserDocument;
}>;
