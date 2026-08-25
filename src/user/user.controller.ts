import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import type { UserResponse } from './interfaces/user.interface';
import { UserService } from './user.service';

@ApiTags('Users')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
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
}
