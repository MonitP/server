import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { MailRecipient } from './mail.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MailRecipient])],
  controllers: [MailController],
  providers: [MailService],
})
export class MailModule {} 