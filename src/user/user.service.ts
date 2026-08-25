import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaymentService } from '../payment/payment.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UserResponse } from './interfaces/user.interface';
import { User, UserExists, type UserDocument } from './schema/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
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

  async exists(userId: Types.ObjectId | string): Promise<UserExists> {
    return await this.userModel.exists({ _id: userId });
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
