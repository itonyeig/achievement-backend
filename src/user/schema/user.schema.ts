import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;
export type UserExists = {
  _id: Types.ObjectId;
} | null;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true, match: /^\d{10}$/ })
  accountNumber: string;

  @Prop({ required: true, trim: true })
  accountName: string;

  @Prop({ required: true, trim: true, match: /^\d{3,6}$/ })
  bankCode: string;

  @Prop({ required: true, trim: true, select: false })
  recipientCode: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
