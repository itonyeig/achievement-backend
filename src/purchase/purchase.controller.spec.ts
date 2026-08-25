import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PurchaseController } from './purchase.controller';
import { PurchaseService } from './purchase.service';

describe('PurchaseController', () => {
  let controller: PurchaseController;
  const purchaseService = {
    createPurchase: jest.fn(),
  };
  const params = {
    productId: '66c740862c2cb219f9b9ef11',
    userId: '66c740862c2cb219f9b9ef12',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseController],
      providers: [
        {
          provide: PurchaseService,
          useValue: purchaseService,
        },
      ],
    }).compile();

    controller = module.get<PurchaseController>(PurchaseController);
    jest.clearAllMocks();
  });

  it('records a purchase through the purchase service', async () => {
    const purchase = {
      _id: '66c740862c2cb219f9b9ef13',
      ...params,
      totalAmount: 12000,
      createdAt: new Date('2026-08-25T10:00:00.000Z'),
      updatedAt: new Date('2026-08-25T10:00:01.000Z'),
    };
    purchaseService.createPurchase.mockResolvedValue(purchase);

    await expect(controller.createPurchase(params)).resolves.toEqual(purchase);
    expect(purchaseService.createPurchase).toHaveBeenCalledWith(params);
  });

  it('propagates missing-user failures', async () => {
    const error = new NotFoundException('User not found');
    purchaseService.createPurchase.mockRejectedValue(error);

    await expect(controller.createPurchase(params)).rejects.toBe(error);
  });

  it('propagates missing-product failures', async () => {
    const error = new NotFoundException('Product not found');
    purchaseService.createPurchase.mockRejectedValue(error);

    await expect(controller.createPurchase(params)).rejects.toBe(error);
  });
});
