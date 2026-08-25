import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return an HTTP 200 status', () => {
      const sendStatus = jest.fn();
      const response = { sendStatus } as unknown as Response;

      appController.getHealth(response);

      expect(sendStatus).toHaveBeenCalledWith(200);
    });
  });
});
