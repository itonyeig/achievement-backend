import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller()
export class AppController {
  @Get('health')
  getHealth(@Res() res: Response) {
    res.sendStatus(200);
  }
}
