import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './service';
import { NotificationController } from './controllers';
import { Notification } from './entities/notification.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}