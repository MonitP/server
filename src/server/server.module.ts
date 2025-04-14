import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerService } from './service/server.service';
import { Servers } from './entities/server.entity';
import { ServerController } from './controllers/server.controller';
import { ServerGateway } from './gateway';
import { ServerStatusService } from './service';

@Module({
  imports: [TypeOrmModule.forFeature([Servers])],
  controllers: [ServerController],
  providers: [ServerService, ServerGateway, ServerStatusService],
  exports: [ServerService, ServerStatusService],
})
export class ServerModule {} 