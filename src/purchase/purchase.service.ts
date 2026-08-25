import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../product/schema/product.schema';
import { User } from '../user/schema/user.schema';
import type { CreatePurchaseParamsDto } from './dto/create-purchase-params.dto';
import type { PurchaseResponse } from './interfaces/purchase.interface';
import { Purchase, type PurchaseDocument } from './schema/purchase.schema';

@Injectable()
export class PurchaseService {
  constructor(
    @InjectModel(Purchase.name)
    private readonly purchaseModel: Model<Purchase>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}

  async createPurchase(
    params: CreatePurchaseParamsDto,
  ): Promise<PurchaseResponse> {
    const userExists = await this.userModel.exists({ _id: params.userId });

    if (!userExists) {
      throw new NotFoundException('User not found');
    }

    const product = await this.productModel.findById(params.productId).exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const purchase = await this.purchaseModel.create({
      userId: params.userId,
      productId: product._id,
      totalAmount: product.price,
    });

    return this.toPurchaseResponse(purchase);
  }

  private toPurchaseResponse(purchase: PurchaseDocument): PurchaseResponse {
    return {
      id: purchase._id.toString(),
      userId: purchase.userId.toString(),
      productId: purchase.productId.toString(),
      totalAmount: purchase.totalAmount,
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt,
    };
  }
}
