import { Controller, Get, Post, Body, Param, NotFoundException, Logger, Delete, Put, Res } from '@nestjs/common';
import { API_URLS } from 'src/consts/api-urls';
import { CreateServerDto } from '../dto/create-server.dto';
import { ServerService } from '../service/server.service';
import { Servers } from '../entities';
import { MinioService } from '../service/minio.service';
import { ContaminationService } from '../service/contamination.service';
import { Response } from 'express';

@Controller(API_URLS.server.base)
export class ServerController {
  private readonly logger = new Logger(ServerController.name);

  constructor(
    private readonly serversService: ServerService,
    private readonly minioService: MinioService,
    private readonly contaminationService: ContaminationService,
  ) {}

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
    await this.serversService.delete(id);
  }

  @Put(API_URLS.server.update)
  async update(@Param('id') id: string, @Body() updateServerDto: CreateServerDto): Promise<Servers> {
    const server = await this.serversService.update(id, updateServerDto);
    return server;
  }

  @Delete(API_URLS.server.deleteProcess)
  async deleteProcess(
    @Param('code') code: string,
    @Param('processName') processName: string,
  ): Promise<void> {
    await this.serversService.deleteProcess(code, processName);
  }

  @Get('minio/:bucket/*')
  async getMinioImage(@Param('bucket') bucket: string, @Param('0') objectPath: string, @Res() res: Response) {
    try {
      const pathParts = objectPath.split('/');
      
      if (pathParts.length < 3) {
        return res.status(400).json({ error: '잘못된 이미지 경로입니다.' });
      }
      
      const serverCode = pathParts[0] + '-00';
      const date = pathParts[1];
      const imageName = pathParts.slice(2).join('/');
      
      const url = await this.minioService.getImageUrl(bucket, serverCode, date, imageName);
      if (!url) {
        return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
      }
      
      return res.redirect(url);
    } catch (error) {
      return res.status(500).json({ error: '이미지 조회 중 오류가 발생했습니다.' });
    }
  }

  @Get('contamination')
  async getContaminationData() {
    try {
      const data = await this.contaminationService.getAllContaminationData();
      return {
        success: true,
        data: data
      };
    } catch (error) {
      this.logger.error(`Contamination 데이터 조회 실패: ${error.message}`);
      return {
        success: false,
        error: '데이터 조회 중 오류가 발생했습니다.'
      };
    }
  }

  @Get('contamination/:serverCode')
  async getContaminationDataByServer(@Param('serverCode') serverCode: string) {
    try {
      const data = await this.contaminationService.getContaminationDataByServer(serverCode);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      this.logger.error(`서버별 Contamination 데이터 조회 실패: ${error.message}`);
      return {
        success: false,
        error: '데이터 조회 중 오류가 발생했습니다.'
      };
    }
  }
}
