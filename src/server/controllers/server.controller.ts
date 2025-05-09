import { Controller, Get, Post, Body, Param, NotFoundException, Logger, Delete, Put } from '@nestjs/common';
import { API_URLS } from 'src/consts/api-urls';
import { CreateServerDto } from '../dto/create-server.dto';
import { ServerService } from '../service/server.service';
import { Servers } from '../entities';

@Controller(API_URLS.server.base)
export class ServerController {
  private readonly logger = new Logger(ServerController.name);

  constructor(private readonly serversService: ServerService) {}

  @Post(API_URLS.server.create)
  async create(@Body() createServerDto: CreateServerDto): Promise<Servers> {
    const server = await this.serversService.create(createServerDto);
    return server;
  }

  @Get()
  async findAll(): Promise<Partial<Servers>[]> {
    const servers = await this.serversService.findAll();
    return servers;
  }

  @Delete(API_URLS.server.delete)
  async delete(@Param('id') id: string): Promise<void> {
    this.logger.log(`서버 삭제 요청: ID=${id}`);
    await this.serversService.delete(id);
    this.logger.log(`서버 삭제 완료: ID=${id}`);
  }

  @Put(API_URLS.server.update)
  async update(@Param('id') id: string, @Body() updateServerDto: CreateServerDto): Promise<Servers> {
    this.logger.log(`서버 업데이트 요청: ID=${id}, Data=${JSON.stringify(updateServerDto)}`);
    const server = await this.serversService.update(id, updateServerDto);
    this.logger.log(`서버 업데이트 완료: ${JSON.stringify(server)}`);
    return server;
  }

  @Delete(API_URLS.server.deleteProcess)
  async deleteProcess(
    @Param('code') code: string,
    @Param('processName') processName: string,
  ): Promise<void> {
    this.logger.log(`프로세스 삭제 요청: code=${code}, processName=${processName}`);
    await this.serversService.deleteProcess(code, processName);
    this.logger.log(`프로세스 삭제 완료: code=${code}, processName=${processName}`);
  }
}
