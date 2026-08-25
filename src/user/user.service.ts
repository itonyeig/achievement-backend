import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ACHIEVEMENT_NAMES } from '../achievement/constants/achievement.constants';
import { UserAchievement } from '../achievement/schema/user-achievement.schema';
import { BADGES, BADGE_NAMES } from '../badge/constants/badge.constants';
import { UserBadge } from '../badge/schema/user-badge.schema';
import { PaymentService } from '../payment/payment.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type {
  UserAchievementsResponse,
  UserResponse,
} from './interfaces/user.interface';
import { User, UserExists, type UserDocument } from './schema/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(UserAchievement.name)
    private readonly userAchievementModel: Model<UserAchievement>,
    @InjectModel(UserBadge.name)
    private readonly userBadgeModel: Model<UserBadge>,
    private readonly paymentService: PaymentService,
  ) {}

  async createUser(dto: CreateUserDto): Promise<UserResponse> {
    const createRecipientInput = {
      accountName: dto.name,
      accountNumber: '0000000000',
      bankCode: '057',
    };
    const recipient =
      await this.paymentService.createTransferRecipient(createRecipientInput);
    const user = await this.userModel.create({
      name: dto.name,
      email: dto.email,
      accountNumber: createRecipientInput.accountNumber,
      accountName: createRecipientInput.accountName,
      bankCode: createRecipientInput.bankCode,
      recipientCode: recipient.recipientCode,
    });

    return this.toUserResponse(user);
  }

  async existsOrThrow(userId: Types.ObjectId | string): Promise<UserExists> {
    const userExists = await this.userModel.exists({ _id: userId });
    if (!userExists) {
      throw new NotFoundException('User not found');
    }
    return userExists;
  }

  async findById(userId: Types.ObjectId | string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(userId)
      .select('+recipientCode')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getAchievements(userId: string): Promise<UserAchievementsResponse> {
    await this.existsOrThrow(userId);

    const [userAchievements, userBadges] = await Promise.all([
      this.userAchievementModel
        .find({ userId })
        .select('achievementName -_id')
        .lean()
        .exec(),
      this.userBadgeModel
        .find({ userId })
        .select('badgeName -_id')
        .lean()
        .exec(),
    ]);

    const unlockedAchievements = ACHIEVEMENT_NAMES.filter((name) =>
      userAchievements.some(({ achievementName }) => achievementName === name),
    );
    const nextAchievement = ACHIEVEMENT_NAMES[unlockedAchievements.length];

    const currentBadgeIndex = BADGE_NAMES.findLastIndex((name) =>
      userBadges.some(({ badgeName }) => badgeName === name),
    );
    const currentBadge = BADGE_NAMES[currentBadgeIndex];
    const nextBadge = BADGES[currentBadgeIndex + 1];

    return {
      unlocked_achievements: unlockedAchievements,
      next_available_achievements: nextAchievement ? [nextAchievement] : [],
      current_badge: currentBadge ?? null,
      next_badge: nextBadge?.name ?? null,
      remaining_to_unlock_next_badge: nextBadge
        ? Math.max(
            nextBadge.requiredAchievementCount - unlockedAchievements.length,
            0,
          )
        : 0,
    };
  }

  private toUserResponse(user: UserDocument): UserResponse {
    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      accountNumber: user.accountNumber,
      accountName: user.accountName,
      bankCode: user.bankCode,
    };
  }
}
