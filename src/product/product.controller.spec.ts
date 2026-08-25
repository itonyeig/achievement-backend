import { ServiceUnavailableException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

describe('ProductController', () => {
  let controller: ProductController;
  const productService = {
    getProducts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        {
          provide: ProductService,
          useValue: productService,
        },
      ],
    }).compile();

    controller = module.get<ProductController>(ProductController);
    jest.clearAllMocks();
  });

  it('returns the products supplied by the product service', async () => {
    const products = [
      {
        _id: '66c740862c2cb219f9b9ef11',
        name: 'Wireless Mouse',
        price: 12000,
      },
    ];
    productService.getProducts.mockResolvedValue(products);

    await expect(controller.getProducts()).resolves.toEqual(products);
    expect(productService.getProducts).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list supplied by the product service', async () => {
    productService.getProducts.mockResolvedValue([]);

    await expect(controller.getProducts()).resolves.toEqual([]);
  });

  it('propagates product-service failures', async () => {
    const error = new ServiceUnavailableException('Products unavailable');
    productService.getProducts.mockRejectedValue(error);

    await expect(controller.getProducts()).rejects.toBe(error);
  });
});
