import { Controller, Get, Query, Logger } from '@nestjs/common';
import { API_URLS } from 'src/consts/api-urls';
import { LogService } from './log.service';

@Controller(API_URLS.log.base)
export class LogController {
  private readonly logger = new Logger(LogController.name);

  constructor(private readonly logService: LogService) {}

  @Get()
  async getLogs(
    @Query('serverCode') serverCode?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
    @Query('type') type?: string,
  ) {
    this.logger.log(`로그 조회 요청: serverCode=${serverCode}, page=${page}, limit=${limit}`);
    const result = await this.logService.getLogs(
      serverCode,
      page,
      limit,
      startDate,
      endDate,
      type
    );
    this.logger.log(`로그 조회 완료: total=${result.total}`);
    return result;
  }
} 