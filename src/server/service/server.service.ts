import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Servers } from '../entities/server.entity';
import { CreateServerDto } from '../dto/create-server.dto';
import { ProcessStatus } from '../server.interface';

@Injectable()
export class ServerService {
  private readonly logger = new Logger(ServerService.name);

  constructor(
    @InjectRepository(Servers)
    private readonly serversRepository: Repository<Servers>,
  ) {}

  async create(createServerDto: CreateServerDto): Promise<Servers> {
    const server = this.serversRepository.create({
      ...createServerDto,
      processes: [],
      cpuHistory: [0],
      ramHistory: [0],
    });
    return this.serversRepository.save(server);
  }

  async findAll(): Promise<Partial<Servers>[]> {
    return this.serversRepository.find({
      select: ['id', 'name', 'code','ip', 'port', 'processes'],
    });
  }

  async findOne(id: string): Promise<Servers | null> {
    return this.serversRepository.findOne({ where: { id } });
  }

  async findByCode(code: string): Promise<Servers | null> {
    return this.serversRepository.findOne({ where: { code } });
  }

  async updateProcesses(code: string, processes: ProcessStatus[]): Promise<void> {
    const server = await this.findByCode(code);
    if (!server) {
      this.logger.error(`서버를 찾을 수 없음: code=${code}`);
      throw new NotFoundException('서버를 찾을 수 없습니다.');
    }

    const existingProcessMap = new Map(server.processes.map(p => [p.name, p]));
    
    processes.forEach(newProcess => {
      const existingProcess = existingProcessMap.get(newProcess.name);
      if (existingProcess) {
        existingProcess.status = newProcess.status;
      } else {
        server.processes.push(newProcess);
      }
    });

    await this.serversRepository.save(server);
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`서버 삭제 시도: ID=${id}`);
    
    const server = await this.serversRepository.findOne({ where: { id } });
    if (!server) {
      this.logger.error(`서버를 찾을 수 없음: ID=${id}`);
      throw new NotFoundException('서버를 찾을 수 없습니다.');
    }

    await this.serversRepository.remove(server);
    this.logger.log(`서버 삭제 성공: ID=${id}`);
  }

  async update(id: string, updateServerDto: Partial<Servers>): Promise<Servers> {
    this.logger.log(`서버 업데이트 시도: ID=${id}`);
    
    const server = await this.findOne(id);
    if (!server) {
      this.logger.error(`서버를 찾을 수 없음: ID=${id}`);
      throw new NotFoundException('서버를 찾을 수 없습니다.');
    }

    const updatedServer = await this.serversRepository.save({
      ...server,
      ...updateServerDto,
    });
    
    this.logger.log(`서버 업데이트 성공: ID=${id}`);
    return updatedServer;
  }
} 