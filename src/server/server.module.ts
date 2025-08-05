import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerService } from './service/server.service';
import { Servers } from './entities/server.entity';
import { ServerController } from './controllers/server.controller';
import { ServerGateway } from './gateway';
import { ServerStatusService } from './service';
import { NotificationModule } from '../notification/notification.module';
import { MailModule } from '../mail/mail.module';
import { LogModule } from '../log/log.module';
import { MinioService } from './service/minio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Servers]), 
    NotificationModule,
    MailModule,
    LogModule,
  ],
  controllers: [ServerController],
  providers: [ServerService, ServerGateway, ServerStatusService, MinioService],
  exports: [ServerService, ServerStatusService, MinioService],
})
export class ServerModule {}
