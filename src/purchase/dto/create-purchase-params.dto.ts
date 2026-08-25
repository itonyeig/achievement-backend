import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class CreatePurchaseParamsDto {
  @ApiProperty({ example: '66c740862c2cb219f9b9ef11' })
  @IsMongoId()
  productId: string;

  @ApiProperty({ example: '66c740862c2cb219f9b9ef12' })
  @IsMongoId()
  userId: string;
}
