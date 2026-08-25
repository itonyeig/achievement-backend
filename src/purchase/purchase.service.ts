import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventName } from '../common/enums/event-name.enum';
import { ProductService } from '../product/product.service';
import { UserService } from '../user/user.service';
import type { CreatePurchaseParamsDto } from './dto/create-purchase-params.dto';
import { PurchaseCompletedEvent } from './events/purchase-completed.event';
import type { PurchaseResponse } from './interfaces/purchase.interface';
import { Purchase } from './schema/purchase.schema';

@Injectable()
export class PurchaseService {
  constructor(
    @InjectModel(Purchase.name)
    private readonly purchaseModel: Model<Purchase>,
    private readonly userService: UserService,
    private readonly productService: ProductService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createPurchase(
    params: CreatePurchaseParamsDto,
  ): Promise<PurchaseResponse> {
    await this.userService.existsOrThrow(params.userId);
    const product = await this.productService.findById(params.productId);

    const purchase = await this.purchaseModel.create({
      userId: params.userId,
      productId: product._id,
      totalAmount: product.price,
    });

    this.eventEmitter.emit(
      EventName.PurchaseCompleted,
      new PurchaseCompletedEvent(purchase.userId),
    );

    return purchase;
  }

  async countByUserId(userId: string | Types.ObjectId): Promise<number> {
    return this.purchaseModel.countDocuments({ userId });
  }
}
