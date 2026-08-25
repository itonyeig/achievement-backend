import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { Product } from './schema/product.schema';

describe('ProductService', () => {
  let service: ProductService;
  const lean = jest.fn();
  const findById = {
    lean: jest.fn(),
  };
  const productModel = {
    countDocuments: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getModelToken(Product.name),
          useValue: productModel,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    jest.clearAllMocks();
    productModel.find.mockReturnValue({ lean });
    productModel.findById.mockReturnValue(findById);
  });

  describe('onModuleInit', () => {
    it('seeds all 10 sample products when the collection is empty', async () => {
      productModel.countDocuments.mockResolvedValue(0);
      productModel.insertMany.mockResolvedValue([]);

      await service.onModuleInit();

      expect(productModel.countDocuments).toHaveBeenCalledTimes(1);
      expect(productModel.insertMany).toHaveBeenCalledTimes(1);
      expect(productModel.insertMany).toHaveBeenCalledWith([
        { name: 'Wireless Mouse', price: 12000 },
        { name: 'Mechanical Keyboard', price: 35000 },
        { name: 'USB-C Hub', price: 18000 },
        { name: 'Laptop Stand', price: 15000 },
        { name: 'Noise-Cancelling Headphones', price: 65000 },
        { name: 'Webcam', price: 28000 },
        { name: 'Portable SSD', price: 55000 },
        { name: 'Bluetooth Speaker', price: 22000 },
        { name: 'Power Bank', price: 25000 },
        { name: 'Smartwatch', price: 45000 },
      ]);
    });

    it.each([1, 5, 10])(
      'does not seed products when the collection contains %i product(s)',
      async (productCount) => {
        productModel.countDocuments.mockResolvedValue(productCount);

        await service.onModuleInit();

        expect(productModel.insertMany).not.toHaveBeenCalled();
      },
    );

    it('propagates product-count failures without attempting to seed', async () => {
      const error = new Error('Failed to count products');
      productModel.countDocuments.mockRejectedValue(error);

      await expect(service.onModuleInit()).rejects.toBe(error);
      expect(productModel.insertMany).not.toHaveBeenCalled();
    });

    it('propagates seed failures', async () => {
      const error = new Error('Failed to seed products');
      productModel.countDocuments.mockResolvedValue(0);
      productModel.insertMany.mockRejectedValue(error);

      await expect(service.onModuleInit()).rejects.toBe(error);
    });
  });

  describe('getProducts', () => {
    it('returns the available products from MongoDB', async () => {
      const products = [
        {
          _id: '66c740862c2cb219f9b9ef11',
          name: 'Wireless Mouse',
          price: 12000,
        },
        {
          _id: '66c740862c2cb219f9b9ef12',
          name: 'Mechanical Keyboard',
          price: 35000,
        },
      ];
      lean.mockResolvedValue(products);

      await expect(service.getProducts()).resolves.toEqual(products);
      expect(productModel.find).toHaveBeenCalledTimes(1);
      expect(productModel.find).toHaveBeenCalledWith({}, '-__v');
      expect(lean).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when no products exist', async () => {
      lean.mockResolvedValue([]);

      await expect(service.getProducts()).resolves.toEqual([]);
    });

    it('propagates product-query failures', async () => {
      const error = new Error('Failed to query products');
      lean.mockRejectedValue(error);

      await expect(service.getProducts()).rejects.toBe(error);
    });
  });

  describe('findById', () => {
    it('returns the requested product', async () => {
      const productId = '66c740862c2cb219f9b9ef11';
      const product = {
        _id: productId,
        name: 'Wireless Mouse',
        price: 12000,
      };
      findById.lean.mockResolvedValue(product);

      await expect(service.findById(productId)).resolves.toBe(product);
      expect(productModel.findById).toHaveBeenCalledWith(productId, '-__v');
      expect(findById.lean).toHaveBeenCalledTimes(1);
    });

    it('throws when the product does not exist', async () => {
      findById.lean.mockResolvedValue(null);

      await expect(
        service.findById('66c740862c2cb219f9b9ef11'),
      ).rejects.toEqual(new NotFoundException('Product not found'));
    });

    it('propagates product-query failures', async () => {
      const error = new Error('Failed to query product');
      findById.lean.mockRejectedValue(error);

      await expect(service.findById('66c740862c2cb219f9b9ef11')).rejects.toBe(
        error,
      );
    });
  });
});
