import type { UserDocument } from '../../user/schema/user.schema';

export class AchievementUnlockedEvent {
  constructor(
    public readonly achievement_name: string,
    public readonly user: UserDocument,
  ) {}
}
