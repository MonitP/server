import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Servers } from '../entities/server.entity';
import { CreateServerDto } from '../dto/create-server.dto';
import { ProcessStatus } from '../server.interface';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class ServerService {
  private readonly logger = new Logger(ServerService.name);

  constructor(
    @InjectRepository(Servers)
    private readonly serversRepository: Repository<Servers>,
    private readonly mailService: MailService,
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
    const servers = await this.serversRepository.find({
      select: ['id', 'name', 'code','ip', 'port', 'processes', 'cpuHistory', 'ramHistory'],
    });
  
    return servers.map(server => ({
      ...server,
      processes: server.processes?.filter(p => p?.name)
        .map(p => ({
          ...p,
          status: 'stopped' as const
        }))
        .sort((a, b) => (b.name || '').localeCompare(a.name || '')) || []
    }));
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
      return;
    }

    if (!server.processes) {
      server.processes = [];
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
    
    const server = await this.findOne(id);
    if (!server) {
      this.logger.error(`서버를 찾을 수 없음: ID=${id}`);
      throw new NotFoundException('서버를 찾을 수 없습니다.');
    }

    const updatedServer = await this.serversRepository.save({
      ...server,
      ...updateServerDto,
    });
    
    return updatedServer;
  }

  async deleteProcess(code: string, processName: string): Promise<void> {
    this.logger.log(`프로세스 삭제 시도: code=${code}, processName=${processName}`);
    
    const server = await this.findByCode(code);
    if (!server) {
      this.logger.error(`서버를 찾을 수 없음: code=${code}`);
      throw new NotFoundException('서버를 찾을 수 없습니다.');
    }

    if (!server.processes) {
      server.processes = [];
    }

    const processIndex = server.processes.findIndex(p => p.name === processName);
    if (processIndex === -1) {
      this.logger.error(`프로세스를 찾을 수 없음: processName=${processName}`);
      throw new NotFoundException('프로세스를 찾을 수 없습니다.');
    }

    server.processes.splice(processIndex, 1);
    await this.serversRepository.save(server);
    
    this.logger.log(`프로세스 삭제 성공: code=${code}, processName=${processName}`);
  }

  async handleServerDisconnected(code: string): Promise<void> {
    this.logger.log(`메일 전송 시도: code=${code}`);
    const server = await this.findByCode(code);
    if (!server) {
      this.logger.error(`서버를 찾을 수 없음: code=${code}`);
      return;
    }

    this.logger.log(`메일 전송: ${server.name} (${code})`);
    await this.mailService.sendServerDisconnectedMail(server.name);
  }
} 