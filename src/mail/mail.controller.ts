import { Controller, Get, Post, Body, Delete, Param } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailRecipient } from './mail.entity';

@Controller('api/mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post()
  async create(@Body('email') email: string): Promise<MailRecipient> {
    return this.mailService.create(email);
  }

  @Get()
  async findAll(): Promise<MailRecipient[]> {
    return this.mailService.findAll();
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.mailService.delete(Number(id));
  }
} 