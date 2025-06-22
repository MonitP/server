import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailRecipient } from './mail.entity';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(
    @InjectRepository(MailRecipient)
    private readonly mailRecipientRepository: Repository<MailRecipient>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

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

  async sendServerDisconnectedMail(serverName: string, processName?: string): Promise<void> {
    this.logger.log(`메일 수신자 조회 시작: ${serverName}${processName ? ' (' + processName + ')' : ''}`);
    let recipients = await this.findAll();
    let recipientEmails = recipients.map(recipient => recipient.email);

    // AI-SERVER일 때는 특정 이메일만 필터링
    if (processName === 'AI-SERVER') {
      recipientEmails = recipientEmails.filter(email =>
        email.startsWith('yjh') ||
        email.startsWith('sjw') ||
        email.startsWith('lih') ||
        email.startsWith('pjb')
      );
    }

    if (recipientEmails.length === 0) {
      this.logger.warn('메일 수신자가 없습니다.');
      return;
    }

    this.logger.log(`메일 전송 시작: ${serverName}${processName ? ' (' + processName + ')' : ''} -> ${recipientEmails.join(', ')}`);
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipientEmails,
      subject: `서버 연결 끊김 알림: ${serverName}${processName ? ' (' + processName + ')' : ''}`,
      text: `${serverName} 서버${processName ? ' (' + processName + ')' : ''}와의 연결이 끊어졌습니다.`,
      html: `
        <h2>서버 연결 끊김 알림</h2>
        <p>${serverName} 서버${processName ? ' (' + processName + ')' : ''}와의 연결이 끊어졌습니다.</p>
        <p>시간: ${new Date().toLocaleString()}</p>
      `,
    });
    this.logger.log(`메일 전송 완료: ${serverName}${processName ? ' (' + processName + ')' : ''}`);
  }
} 