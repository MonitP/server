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
import { ContaminationService } from './service/contamination.service';
import { ContaminationData } from './entities/contamination.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Servers, ContaminationData]),
    NotificationModule,
    MailModule,
    LogModule,
  ],
  controllers: [ServerController],
  providers: [ServerService, ServerGateway, ServerStatusService, MinioService, ContaminationService],
  exports: [ServerService, ServerStatusService, MinioService, ContaminationService],
})
export class ServerModule {}
