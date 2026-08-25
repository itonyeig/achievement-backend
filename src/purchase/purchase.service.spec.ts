import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EventName } from '../common/enums/event-name.enum';
import { ProductService } from '../product/product.service';
import { UserService } from '../user/user.service';
import { PurchaseCompletedEvent } from './events/purchase-completed.event';
import { Purchase } from './schema/purchase.schema';
import { PurchaseService } from './purchase.service';

describe('PurchaseService', () => {
  let service: PurchaseService;
  let emittedEvent: PurchaseCompletedEvent | undefined;
  const userService = {
    existsOrThrow: jest.fn(),
  };
  const productService = {
    findById: jest.fn(),
  };
  const purchaseModel = {
    create: jest.fn(),
  };
  const eventEmitter = {
    emit: jest.fn<
      (eventName: string, event: PurchaseCompletedEvent) => boolean
    >((_eventName: string, event: PurchaseCompletedEvent) => {
      emittedEvent = event;
      return true;
    }),
  };
  const params = {
    productId: '66c740862c2cb219f9b9ef11',
    userId: '66c740862c2cb219f9b9ef12',
  };
  const purchaseId = new Types.ObjectId('66c740862c2cb219f9b9ef13');
  const productId = new Types.ObjectId(params.productId);
  const userId = new Types.ObjectId(params.userId);
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
          provide: UserService,
          useValue: userService,
        },
        {
          provide: ProductService,
          useValue: productService,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get<PurchaseService>(PurchaseService);
    jest.clearAllMocks();
    emittedEvent = undefined;
  });

  it('validates the user and product before persisting the stored product price', async () => {
    userService.existsOrThrow.mockResolvedValue({ _id: params.userId });
    productService.findById.mockResolvedValue({
      _id: productId,
      name: 'Wireless Mouse',
      price: 12000,
    });
    purchaseModel.create.mockResolvedValue({
      _id: purchaseId,
      userId,
      productId,
      totalAmount: 12000,
      createdAt,
      updatedAt,
    });

    await expect(service.createPurchase(params)).resolves.toEqual({
      _id: purchaseId,
      userId,
      productId,
      totalAmount: 12000,
      createdAt,
      updatedAt,
    });
    expect(userService.existsOrThrow).toHaveBeenCalledWith(params.userId);
    expect(productService.findById).toHaveBeenCalledWith(params.productId);
    expect(purchaseModel.create).toHaveBeenCalledWith({
      userId: params.userId,
      productId,
      totalAmount: 12000,
    });
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventName.PurchaseCompleted,
      new PurchaseCompletedEvent(userId),
    );

    expect(emittedEvent).toBeInstanceOf(PurchaseCompletedEvent);
    expect(Object.keys(emittedEvent ?? {})).toEqual(['userId']);
    expect(purchaseModel.create.mock.invocationCallOrder[0]).toBeLessThan(
      eventEmitter.emit.mock.invocationCallOrder[0],
    );
  });

  it('always calculates the total from the latest stored product price', async () => {
    userService.existsOrThrow.mockResolvedValue({ _id: params.userId });
    productService.findById.mockResolvedValue({
      _id: productId,
      price: 65000,
    });
    purchaseModel.create.mockResolvedValue({
      _id: purchaseId,
      userId,
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
    userService.existsOrThrow.mockRejectedValue(
      new NotFoundException('User not found'),
    );

    await expect(service.createPurchase(params)).rejects.toEqual(
      new NotFoundException('User not found'),
    );
    expect(productService.findById).not.toHaveBeenCalled();
    expect(purchaseModel.create).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects a missing product without persisting a purchase', async () => {
    userService.existsOrThrow.mockResolvedValue({ _id: params.userId });
    productService.findById.mockRejectedValue(
      new NotFoundException('Product not found'),
    );

    await expect(service.createPurchase(params)).rejects.toEqual(
      new NotFoundException('Product not found'),
    );
    expect(purchaseModel.create).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates user-query failures without continuing', async () => {
    const error = new Error('Failed to query user');
    userService.existsOrThrow.mockRejectedValue(error);

    await expect(service.createPurchase(params)).rejects.toBe(error);
    expect(productService.findById).not.toHaveBeenCalled();
    expect(purchaseModel.create).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates product-query failures without persisting', async () => {
    const error = new Error('Failed to query product');
    userService.existsOrThrow.mockResolvedValue({ _id: params.userId });
    productService.findById.mockRejectedValue(error);

    await expect(service.createPurchase(params)).rejects.toBe(error);
    expect(purchaseModel.create).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates purchase-persistence failures', async () => {
    const error = new Error('Failed to persist purchase');
    userService.existsOrThrow.mockResolvedValue({ _id: params.userId });
    productService.findById.mockResolvedValue({
      _id: productId,
      price: 12000,
    });
    purchaseModel.create.mockRejectedValue(error);

    await expect(service.createPurchase(params)).rejects.toBe(error);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
