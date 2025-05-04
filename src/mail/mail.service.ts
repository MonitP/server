import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailRecipient } from './mail.entity';

@Injectable()
export class MailService {
  constructor(
    @InjectRepository(MailRecipient)
    private readonly mailRecipientRepository: Repository<MailRecipient>,
  ) {}

  async create(email: string): Promise<MailRecipient> {
    const recipient = this.mailRecipientRepository.create({ email });
    return this.mailRecipientRepository.save(recipient);
  }

  async findAll(): Promise<MailRecipient[]> {
    return this.mailRecipientRepository.find();
  }

  async delete(id: number): Promise<void> {
    await this.mailRecipientRepository.delete(id);
  }
} 