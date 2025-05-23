import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from './entities/log.entity';
import { Servers } from '../server/entities/server.entity';

@Injectable()
export class LogService implements OnModuleInit {
  private readonly STREAM_KEY = 'logs:stream';
  private readonly CONSUMER_GROUP = 'log-processors';
  private readonly BATCH_SIZE = 1000; 
  private readonly BLOCK_TIME = 5000; 
  private readonly SAVE_INTERVAL = 10000; 
  private consumers: Map<string, Promise<void>> = new Map();
  private logBuffer: Map<string, Log[]> = new Map(); 

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(Log) private logRepository: Repository<Log>,
    @InjectRepository(Servers) private serverRepository: Repository<Servers>,
  ) {}

  async onModuleInit() {
    await this.initializeConsumerGroup();
    this.startConsumers().catch(error => {
      console.error('Consumer 시작 중 오류 발생:', error);
    });

    setInterval(() => this.saveBufferedLogs(), this.SAVE_INTERVAL);
  }

  private async getConsumerCount(): Promise<number> {
    const servers = await this.serverRepository.find();
    return servers.length;
  }

  private async startConsumers() {
    const count = await this.getConsumerCount();
    
    if (this.consumers.size > count) {
      const toRemove = Array.from(this.consumers.keys()).slice(count);
      toRemove.forEach(name => this.consumers.delete(name));
    } else if (this.consumers.size < count) {
      for (let i = this.consumers.size + 1; i <= count; i++) {
        const name = `processor-${i}`;
        this.consumers.set(name, this.startConsumer(name));
      }
    }
  }

  private async initializeConsumerGroup() {
    try {
      await this.redis.xgroup('CREATE', this.STREAM_KEY, this.CONSUMER_GROUP, '0', 'MKSTREAM');
    } catch (error) {
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  private async startConsumer(consumerName: string) {
    while (true) {
      try {
        const results = await this.redis.xreadgroup(
          'GROUP', this.CONSUMER_GROUP, consumerName,
          'COUNT', this.BATCH_SIZE.toString(),
          'BLOCK', this.BLOCK_TIME.toString(),
          'STREAMS', this.STREAM_KEY, '>'
        );

        if (!results || !results[0]) {
          continue;
        }

        const [, messages] = results[0] as [string, [string, string[]][]];
        for (const [id, fields] of messages) {
          const log = this.parseLogFields(fields);
          
          if (!log.serverCode) {
            continue;
          }

          const serverCode = log.serverCode;
          if (!this.logBuffer.has(serverCode)) {
            this.logBuffer.set(serverCode, []);
          }
          const buffer = this.logBuffer.get(serverCode);
          if (buffer) {
            buffer.push(log as Log);
          }
          
          await this.redis.xack(this.STREAM_KEY, this.CONSUMER_GROUP, id);
        }
      } catch (error) {
        console.error(`Consumer ${consumerName} 처리 중 오류 발생:`, error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async saveBufferedLogs() {
    for (const [serverCode, logs] of this.logBuffer.entries()) {
      if (!serverCode || logs.length === 0) continue;

      try {
        await this.logRepository
          .createQueryBuilder()
          .insert()
          .into(Log)
          .values(logs)
          .execute();
        
        this.logBuffer.set(serverCode, []);
      } catch (error) {
        console.error(`로그 저장 실패: serverCode=${serverCode}, error=${error.message}`);
      }
    }
  }

  async addLog(log: Partial<Log>) {
    if (!log.serverCode || !log.type || !log.message) {
      throw new Error('필수 필드가 누락되었습니다.');
    }

    const timestamp = log.timestamp || new Date();
    
    await this.redis.xadd(
      this.STREAM_KEY,
      'MAXLEN', '~', '1000000',
      '*',
      'serverCode', log.serverCode,
      'type', log.type,
      'message', log.message,
      'timestamp', timestamp.toISOString()
    );
  }

  private parseLogFields(fields: string[]): Partial<Log> {
    const log: Partial<Log> = {};
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      if (key === 'timestamp') {
        log[key] = new Date(value);
      } else {
        log[key] = value;
      }
    }
    return log;
  }

    async getLogs(
    serverCode?: string,
    page: number = 1,
    limit: number = 50,
    startDate?: Date,
    endDate?: Date,
    type?: string
  ): Promise<{ logs: Log[]; total: number }> {
    const queryBuilder = this.logRepository.createQueryBuilder('log')
      .orderBy('log.timestamp', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (serverCode) {
      queryBuilder.andWhere('log.serverCode = :serverCode', { serverCode });
    }

    if (type) {
      queryBuilder.andWhere('log.type = :type', { type });
    }

    if (startDate) {
      queryBuilder.andWhere('log.timestamp >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('log.timestamp <= :endDate', { endDate });
    }

    const [logs, total] = await queryBuilder.getManyAndCount();

    return {
      logs,
      total
    };
  }
} 