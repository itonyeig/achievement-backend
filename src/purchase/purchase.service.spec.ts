import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { Product } from '../product/schema/product.schema';
import { User } from '../user/schema/user.schema';
import { Purchase } from './schema/purchase.schema';
import { PurchaseService } from './purchase.service';

describe('PurchaseService', () => {
  let service: PurchaseService;
  const userModel = {
    exists: jest.fn(),
  };
  const productLookup = {
    exec: jest.fn(),
  };
  const productModel = {
    findById: jest.fn(),
  };
  const purchaseModel = {
    create: jest.fn(),
  };
  const params = {
    productId: '66c740862c2cb219f9b9ef11',
    userId: '66c740862c2cb219f9b9ef12',
  };
  const productId = {
    toString: () => params.productId,
  };
  const createdAt = new Date('2026-08-25T10:00:00.000Z');
  const updatedAt = new Date('2026-08-25T10:00:01.000Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseService,
        {
          provide: getModelToken(Purchase.name),
          useValue: purchaseModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
        {
          provide: getModelToken(Product.name),
          useValue: productModel,
        },
      ],
    }).compile();

    service = module.get<PurchaseService>(PurchaseService);
    jest.clearAllMocks();
    productModel.findById.mockReturnValue(productLookup);
  });

  it('validates the user and product before persisting the stored product price', async () => {
    userModel.exists.mockResolvedValue({ _id: params.userId });
    productLookup.exec.mockResolvedValue({
      _id: productId,
      name: 'Wireless Mouse',
      price: 12000,
    });
    purchaseModel.create.mockResolvedValue({
      _id: { toString: () => '66c740862c2cb219f9b9ef13' },
      userId: { toString: () => params.userId },
      productId,
      totalAmount: 12000,
      createdAt,
      updatedAt,
    });

    await expect(service.createPurchase(params)).resolves.toEqual({
      id: '66c740862c2cb219f9b9ef13',
      userId: params.userId,
      productId: params.productId,
      totalAmount: 12000,
      createdAt,
      updatedAt,
    });
    expect(userModel.exists).toHaveBeenCalledWith({ _id: params.userId });
    expect(productModel.findById).toHaveBeenCalledWith(params.productId);
    expect(productLookup.exec).toHaveBeenCalledTimes(1);
    expect(purchaseModel.create).toHaveBeenCalledWith({
      userId: params.userId,
      productId,
      totalAmount: 12000,
    });
  });

  it('always calculates the total from the latest stored product price', async () => {
    userModel.exists.mockResolvedValue({ _id: params.userId });
    productLookup.exec.mockResolvedValue({
      _id: productId,
      price: 65000,
    });
    purchaseModel.create.mockResolvedValue({
      _id: { toString: () => '66c740862c2cb219f9b9ef13' },
      userId: { toString: () => params.userId },
      productId,
      totalAmount: 65000,
      createdAt,
      updatedAt,
    });

    const result = await service.createPurchase(params);

    expect(purchaseModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalAmount: 65000 }),
    );
    expect(result.totalAmount).toBe(65000);
  });

  it('rejects a missing user without querying or persisting a product', async () => {
    userModel.exists.mockResolvedValue(null);

    await expect(service.createPurchase(params)).rejects.toEqual(
      new NotFoundException('User not found'),
    );
    expect(productModel.findById).not.toHaveBeenCalled();
    expect(purchaseModel.create).not.toHaveBeenCalled();
  });

  it('rejects a missing product without persisting a purchase', async () => {
    userModel.exists.mockResolvedValue({ _id: params.userId });
    productLookup.exec.mockResolvedValue(null);

    await expect(service.createPurchase(params)).rejects.toEqual(
      new NotFoundException('Product not found'),
    );
    expect(purchaseModel.create).not.toHaveBeenCalled();
  });

  it('propagates user-query failures without continuing', async () => {
    const error = new Error('Failed to query user');
    userModel.exists.mockRejectedValue(error);

    await expect(service.createPurchase(params)).rejects.toBe(error);
    expect(productModel.findById).not.toHaveBeenCalled();
    expect(purchaseModel.create).not.toHaveBeenCalled();
  });

  it('propagates product-query failures without persisting', async () => {
    const error = new Error('Failed to query product');
    userModel.exists.mockResolvedValue({ _id: params.userId });
    productLookup.exec.mockRejectedValue(error);

    await expect(service.createPurchase(params)).rejects.toBe(error);
    expect(purchaseModel.create).not.toHaveBeenCalled();
  });

  it('propagates purchase-persistence failures', async () => {
    const error = new Error('Failed to persist purchase');
    userModel.exists.mockResolvedValue({ _id: params.userId });
    productLookup.exec.mockResolvedValue({
      _id: productId,
      price: 12000,
    });
    purchaseModel.create.mockRejectedValue(error);

    await expect(service.createPurchase(params)).rejects.toBe(error);
  });
});
