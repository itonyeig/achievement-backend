import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Product } from './schema/product.schema';
import { ProductService } from './product.service';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'Get the available products' })
  @ApiOkResponse({
    description: 'The available products were returned',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Request was successful',
        data: [
          {
            id: '66c740862c2cb219f9b9ef11',
            name: 'Wireless Mouse',
            price: 12000,
            createdAt: '2026-08-25T10:00:00.000Z',
            updatedAt: '2026-08-25T10:00:00.000Z',
          },
        ],
      },
    },
  })
  getProducts(): Promise<Product[]> {
    return this.productService.getProducts();
  }
}
