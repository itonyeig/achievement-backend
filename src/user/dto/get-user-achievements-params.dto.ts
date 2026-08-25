import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class GetUserAchievementsParamsDto {
  @ApiProperty({
    description: 'The user ID',
    example: '66c740862c2cb219f9b9ef11',
  })
  @IsMongoId()
  user: string;
}
