import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ServerMonitorGateway } from './server-monitor.gateway';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, ServerMonitorGateway],
})
export class AppModule {}
