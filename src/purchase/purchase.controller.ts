import { Controller, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreatePurchaseParamsDto } from './dto/create-purchase-params.dto';
import type { PurchaseResponse } from './interfaces/purchase.interface';
import { PurchaseService } from './purchase.service';

@ApiTags('Purchases')
@Controller('purchases')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post(':productId/:userId')
  @ApiOperation({ summary: 'Record a completed product purchase' })
  @ApiParam({
    name: 'productId',
    description: 'The purchased product ID',
    example: '66c740862c2cb219f9b9ef11',
  })
  @ApiParam({
    name: 'userId',
    description: 'The purchasing user ID',
    example: '66c740862c2cb219f9b9ef12',
  })
  @ApiCreatedResponse({
    description: 'The completed purchase was recorded',
    schema: {
      example: {
        success: true,
        statusCode: 201,
        message: 'Request was successful',
        data: {
          id: '66c740862c2cb219f9b9ef13',
          userId: '66c740862c2cb219f9b9ef12',
          productId: '66c740862c2cb219f9b9ef11',
          totalAmount: 12000,
          createdAt: '2026-08-25T10:00:00.000Z',
          updatedAt: '2026-08-25T10:00:00.000Z',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'The product ID or user ID is invalid',
  })
  @ApiNotFoundResponse({ description: 'The user or product was not found' })
  createPurchase(
    @Param() params: CreatePurchaseParamsDto,
  ): Promise<PurchaseResponse> {
    return this.purchaseService.createPurchase(params);
  }
}
