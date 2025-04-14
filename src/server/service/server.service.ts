import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Servers } from '../entities/server.entity';
import { CreateServerDto } from '../dto/create-server.dto';

@Injectable()
export class ServerService {
  constructor(
    @InjectRepository(Servers)
    private serversRepository: Repository<Servers>,
  ) {}

  async create(createServerDto: CreateServerDto): Promise<Servers> {
    const server = this.serversRepository.create({
      ...createServerDto,
      processes: [],
      cpuHistory: [0],
      memoryHistory: [0],
    });
    return this.serversRepository.save(server);
  }

  async findAll(): Promise<Servers[]> {
    return this.serversRepository.find();
  }

  async findOne(id: string): Promise<Servers | null> {
    return this.serversRepository.findOne({ where: { id } });
  }
} 