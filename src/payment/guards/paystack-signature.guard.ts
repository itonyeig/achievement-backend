import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class PaystackSignatureGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-paystack-signature'];
    const secret = this.configService.getOrThrow<string>('PAYSTACK_SECRET_KEY');
    const hash = createHmac('sha512', secret)
      .update(JSON.stringify(request.body))
      .digest('hex');

    if (typeof signature !== 'string' || signature !== hash) {
      throw new UnauthorizedException('Invalid Paystack signature');
    }

    return true;
  }
}
