import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { LogService } from './log.service';
import { Log } from './entities/log.entity';
import { Servers } from '../server/entities/server.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Log, Servers]),
    RedisModule.forRoot({
      type: 'single',
      url: 'redis://localhost:6379',
    }),
  ],
  providers: [LogService],
  exports: [LogService],
})
export class LogModule {} 