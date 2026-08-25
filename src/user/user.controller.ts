import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { GetUserAchievementsParamsDto } from './dto/get-user-achievements-params.dto';
import type {
  UserAchievementsResponse,
  UserResponse,
} from './interfaces/user.interface';
import { UserService } from './user.service';

@ApiTags('Users')
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('user')
  @ApiOperation({
    summary: 'Create a user with a Paystack test payout recipient',
  })
  @ApiCreatedResponse({
    description: 'The user and Paystack transfer recipient were created',
    schema: {
      example: {
        success: true,
        statusCode: 201,
        message: 'Request was successful',
        data: {
          _id: '66c740862c2cb219f9b9ef11',
          name: 'Jane Doe',
          email: 'jane@example.com',
          accountNumber: '0000000000',
          accountName: 'Jane Doe',
          bankCode: '057',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'The supplied user details are invalid',
  })
  @ApiConflictResponse({ description: 'A user with the email already exists' })
  createUser(@Body() dto: CreateUserDto): Promise<UserResponse> {
    return this.userService.createUser(dto);
  }

  @Get('users/:user/achievements')
  @ApiOperation({ summary: "Get a user's achievement and badge progress" })
  @ApiOkResponse({
    description: 'The user achievement and badge progress',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Request was successful',
        data: {
          unlocked_achievements: [
            'First Purchase',
            '5 Purchases',
            '10 Purchases',
            '15 Purchases',
            '20 Purchases',
          ],
          next_available_achievements: ['25 Purchases'],
          current_badge: null,
          next_badge: 'Advanced',
          remaining_to_unlock_next_badge: 3,
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'The user ID is invalid' })
  @ApiNotFoundResponse({ description: 'User not found' })
  getAchievements(
    @Param() params: GetUserAchievementsParamsDto,
  ): Promise<UserAchievementsResponse> {
    return this.userService.getAchievements(params.user);
  }
}
