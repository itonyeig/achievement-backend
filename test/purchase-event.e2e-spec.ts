import {
  INestApplication,
  InternalServerErrorException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { API_PREFIX } from '../src/common/constants/app.constants';
import { EventName } from '../src/common/enums/event-name.enum';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseFormatterInterceptor } from '../src/common/interceptors/response-formatter.interceptor';
import { ProductService } from '../src/product/product.service';
import { PurchaseCompletedEvent } from '../src/purchase/events/purchase-completed.event';
import { PurchaseController } from '../src/purchase/purchase.controller';
import { PurchaseService } from '../src/purchase/purchase.service';
import { Purchase } from '../src/purchase/schema/purchase.schema';
import { UserService } from '../src/user/user.service';

describe('PurchaseCompleted event (e2e)', () => {
  let app: INestApplication<App>;
  let eventEmitter: EventEmitter2;
  let receivedEvent: PurchaseCompletedEvent | undefined;
  const listener = jest.fn<(event: PurchaseCompletedEvent) => void>(
    (event: PurchaseCompletedEvent) => {
      receivedEvent = event;
    },
  );
  const userService = {
    exists: jest.fn(),
  };
  const productService = {
    findById: jest.fn(),
  };
  const purchaseModel = {
    create: jest.fn(),
  };
  const productId = '66c740862c2cb219f9b9ef11';
  const userId = '66c740862c2cb219f9b9ef12';
  const purchaseId = '66c740862c2cb219f9b9ef13';
  const productObjectId = new Types.ObjectId(productId);
  const userObjectId = new Types.ObjectId(userId);
  const purchaseObjectId = new Types.ObjectId(purchaseId);
  const createdAt = new Date('2026-08-25T10:00:00.000Z');
  const updatedAt = new Date('2026-08-25T10:00:01.000Z');

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      controllers: [PurchaseController],
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

    eventEmitter = app.get(EventEmitter2);
    eventEmitter.on(EventName.PurchaseCompleted, listener);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    receivedEvent = undefined;
    userService.exists.mockResolvedValue({ _id: userObjectId });
    productService.findById.mockResolvedValue({
      _id: productObjectId,
      name: 'Wireless Mouse',
      price: 12000,
    });
    purchaseModel.create.mockResolvedValue({
      _id: purchaseObjectId,
      userId: userObjectId,
      productId: productObjectId,
      totalAmount: 12000,
      createdAt,
      updatedAt,
    });
  });

  afterAll(async () => {
    eventEmitter.off(EventName.PurchaseCompleted, listener);
    await app.close();
    jest.restoreAllMocks();
  });

  it('delivers the minimal event after recording a purchase', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/purchases/${productId}/${userId}`)
      .expect(201)
      .expect({
        success: true,
        statusCode: 201,
        message: 'Request was successful',
        data: {
          _id: purchaseId,
          userId,
          productId,
          totalAmount: 12000,
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(receivedEvent).toBeInstanceOf(PurchaseCompletedEvent);
    expect(receivedEvent?.userId).toBe(userObjectId);
    expect(Object.keys(receivedEvent ?? {})).toEqual(['userId']);
    expect(purchaseModel.create.mock.invocationCallOrder[0]).toBeLessThan(
      listener.mock.invocationCallOrder[0],
    );
  });

  it('does not emit when the user does not exist', async () => {
    userService.exists.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post(`/api/v1/purchases/${productId}/${userId}`)
      .expect(404);

    expect(productService.findById).not.toHaveBeenCalled();
    expect(purchaseModel.create).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not emit when the product does not exist', async () => {
    productService.findById.mockRejectedValue(
      new NotFoundException('Product not found'),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/purchases/${productId}/${userId}`)
      .expect(404);

    expect(purchaseModel.create).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not emit when purchase persistence fails', async () => {
    purchaseModel.create.mockRejectedValue(
      new InternalServerErrorException('Could not record purchase'),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/purchases/${productId}/${userId}`)
      .expect(500);

    expect(listener).not.toHaveBeenCalled();
  });
});
