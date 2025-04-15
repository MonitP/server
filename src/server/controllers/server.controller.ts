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
    this.logger.log(`새로운 서버 생성 요청: ${JSON.stringify(createServerDto)}`);
    const server = await this.serversService.create(createServerDto);
    this.logger.log(`서버 생성 완료: ${JSON.stringify(server)}`);
    return server;
  }

  @Get(API_URLS.server.base)
  async findAll(): Promise<Partial<Servers>[]> {
    this.logger.log('서버 리스트 요청');
    const servers = await this.serversService.findAll();
    this.logger.log(`서버 리스트 반환: ${JSON.stringify(servers)}`);
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
}
