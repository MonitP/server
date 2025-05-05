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
  private readonly BATCH_SIZE = 1000; // 한 번에 처리할 로그 개수
  private readonly BLOCK_TIME = 5000; // 대기 시간 (ms)
  private readonly SAVE_INTERVAL = 10000; // 10초마다 저장
  private consumers: Map<string, Promise<void>> = new Map();
  private logBuffer: Map<string, Log[]> = new Map(); // 서버별 로그 버퍼

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
    // 주기적으로 로그 저장
    setInterval(() => this.saveBufferedLogs(), this.SAVE_INTERVAL);
  }

  private async getConsumerCount(): Promise<number> {
    const servers = await this.serverRepository.find();
    return servers.length; // 서버 1개당 Consumer 1개
  }

  private async startConsumers() {
    const count = await this.getConsumerCount();
    
    // 현재 Consumer 개수 조정
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
          
          // serverCode가 없는 경우 건너뛰기
          if (!log.serverCode) {
            continue;
          }

          // 로그를 버퍼에 추가
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
        await this.logRepository.save(logs);
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

  async getLogs(serverCode?: string, limit: number = 100): Promise<Log[]> {
    const queryBuilder = this.logRepository.createQueryBuilder('log')
      .orderBy('log.timestamp', 'DESC')
      .limit(limit);

    if (serverCode) {
      queryBuilder.where('log.serverCode = :serverCode', { serverCode });
    }

    return queryBuilder.getMany();
  }
} 