import {
  INestApplication,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { API_PREFIX } from '../src/common/constants/app.constants';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseFormatterInterceptor } from '../src/common/interceptors/response-formatter.interceptor';
import { ProductController } from '../src/product/product.controller';
import { ProductService } from '../src/product/product.service';
import { PurchaseController } from '../src/purchase/purchase.controller';
import { PurchaseService } from '../src/purchase/purchase.service';

describe('Product and Purchase endpoints (e2e)', () => {
  let app: INestApplication<App>;
  const productService = {
    getProducts: jest.fn(),
  };
  const purchaseService = {
    createPurchase: jest.fn(),
  };
  const productId = '66c740862c2cb219f9b9ef11';
  const userId = '66c740862c2cb219f9b9ef12';

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProductController, PurchaseController],
      providers: [
        {
          provide: ProductService,
          useValue: productService,
        },
        {
          provide: PurchaseService,
          useValue: purchaseService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseFormatterInterceptor());
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  describe('GET /api/v1/products', () => {
    it('returns the available products in the standard response envelope', async () => {
      const products = [
        {
          _id: productId,
          name: 'Wireless Mouse',
          price: 12000,
          createdAt: '2026-08-25T10:00:00.000Z',
          updatedAt: '2026-08-25T10:00:00.000Z',
        },
      ];
      productService.getProducts.mockResolvedValue(products);

      await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(200)
        .expect({
          success: true,
          statusCode: 200,
          message: 'Request was successful',
          data: products,
        });

      expect(productService.getProducts).toHaveBeenCalledTimes(1);
    });

    it('returns an empty list when no products exist', async () => {
      productService.getProducts.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(200)
        .expect({
          success: true,
          statusCode: 200,
          message: 'Request was successful',
          data: [],
        });
    });

    it('formats product-service failures', async () => {
      productService.getProducts.mockRejectedValue(
        new ServiceUnavailableException('Products unavailable'),
      );

      await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(503)
        .expect({
          success: false,
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Products unavailable',
        });
    });
  });

  describe('POST /api/v1/purchases/:productId/:userId', () => {
    it('records a completed purchase and preserves the route parameter order', async () => {
      const purchase = {
        id: '66c740862c2cb219f9b9ef13',
        productId,
        userId,
        totalAmount: 12000,
        createdAt: '2026-08-25T10:00:00.000Z',
        updatedAt: '2026-08-25T10:00:01.000Z',
      };
      purchaseService.createPurchase.mockResolvedValue(purchase);

      await request(app.getHttpServer())
        .post(`/api/v1/purchases/${productId}/${userId}`)
        .expect(201)
        .expect({
          success: true,
          statusCode: 201,
          message: 'Request was successful',
          data: purchase,
        });

      expect(purchaseService.createPurchase).toHaveBeenCalledWith({
        productId,
        userId,
      });
    });

    it.each([
      ['an invalid product ID', 'not-a-product-id', userId],
      ['an invalid user ID', productId, 'not-a-user-id'],
      ['invalid product and user IDs', 'invalid-product', 'invalid-user'],
    ])('rejects %s before calling the service', async (_, product, user) => {
      await request(app.getHttpServer())
        .post(`/api/v1/purchases/${product}/${user}`)
        .expect(400)
        .expect((response: request.Response) => {
          expect(response.body).toEqual(
            expect.objectContaining({
              success: false,
              statusCode: 400,
              error: 'Bad Request',
            }),
          );
        });

      expect(purchaseService.createPurchase).not.toHaveBeenCalled();
    });

    it.each([
      ['User not found', new NotFoundException('User not found')],
      ['Product not found', new NotFoundException('Product not found')],
    ])('formats the "%s" failure', async (message, error) => {
      purchaseService.createPurchase.mockRejectedValue(error);

      await request(app.getHttpServer())
        .post(`/api/v1/purchases/${productId}/${userId}`)
        .expect(404)
        .expect({
          success: false,
          statusCode: 404,
          error: 'Not Found',
          message,
        });
    });

    it('formats purchase-persistence failures', async () => {
      purchaseService.createPurchase.mockRejectedValue(
        new InternalServerErrorException('Could not record purchase'),
      );

      await request(app.getHttpServer())
        .post(`/api/v1/purchases/${productId}/${userId}`)
        .expect(500)
        .expect({
          success: false,
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Could not record purchase',
        });
    });

    it('does not expose a purchase route without both IDs', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/purchases/${productId}`)
        .expect(404);

      expect(purchaseService.createPurchase).not.toHaveBeenCalled();
    });
  });
});
