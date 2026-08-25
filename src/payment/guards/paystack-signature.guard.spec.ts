import {
  type ExecutionContext,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import { PaystackSignatureGuard } from './paystack-signature.guard';

describe('PaystackSignatureGuard', () => {
  const secret = 'sk_test_secret';
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(secret),
  };
  const guard = new PaystackSignatureGuard(
    configService as unknown as ConfigService,
  );
  const body = {
    event: 'transfer.success',
    data: { reference: 'cashback-reference' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    configService.getOrThrow.mockReturnValue(secret);
  });

  it('allows a webhook signed with the configured Paystack secret', () => {
    const signature = sign(body, secret);

    expect(guard.canActivate(createContext(body, signature))).toBe(true);
    expect(configService.getOrThrow).toHaveBeenCalledWith(
      'PAYSTACK_SECRET_KEY',
    );
  });

  it.each([
    ['a missing signature', undefined],
    ['an invalid signature', 'invalid-signature'],
  ])('rejects %s', (_scenario, signature) => {
    expect(() => guard.canActivate(createContext(body, signature))).toThrow(
      new UnauthorizedException('Invalid Paystack signature'),
    );
  });

  it('rejects a signature generated for a different body', () => {
    const signature = sign({ ...body, event: 'transfer.failed' }, secret);

    expect(() => guard.canActivate(createContext(body, signature))).toThrow(
      new UnauthorizedException('Invalid Paystack signature'),
    );
  });

  it('propagates missing Paystack configuration', () => {
    configService.getOrThrow.mockImplementation(() => {
      throw new InternalServerErrorException('Missing Paystack key');
    });

    expect(() => guard.canActivate(createContext(body, 'signature'))).toThrow(
      new InternalServerErrorException('Missing Paystack key'),
    );
  });
});

function sign(body: object, secret: string): string {
  return createHmac('sha512', secret)
    .update(JSON.stringify(body))
    .digest('hex');
}

function createContext(body: object, signature?: string): ExecutionContext {
  const request = {
    body,
    headers: { 'x-paystack-signature': signature },
  } as unknown as Request;

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
