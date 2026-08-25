import type { AchievementName } from '../../achievement/constants/achievement.constants';
import type { BadgeName } from '../../badge/constants/badge.constants';

export interface UserResponse {
  _id: string;
  name: string;
  email: string;
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

export interface UserAchievementsResponse {
  unlocked_achievements: AchievementName[];
  next_available_achievements: AchievementName[];
  current_badge: BadgeName | null;
  next_badge: BadgeName | null;
  remaining_to_unlock_next_badge: number;
}
