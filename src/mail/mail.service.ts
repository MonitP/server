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

  async sendServerDisconnectedMail(serverName: string): Promise<void> {
    this.logger.log(`메일 수신자 조회 시작: ${serverName}`);
    const recipients = await this.findAll();
    const recipientEmails = recipients.map(recipient => recipient.email);

    if (recipientEmails.length === 0) {
      this.logger.warn('메일 수신자가 없습니다.');
      return;
    }

    this.logger.log(`메일 전송 시작: ${serverName} -> ${recipientEmails.join(', ')}`);
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipientEmails,
      subject: `서버 연결 끊김 알림: ${serverName}`,
      text: `${serverName} 서버와의 연결이 끊어졌습니다.`,
      html: `
        <h2>서버 연결 끊김 알림</h2>
        <p>${serverName} 서버와의 연결이 끊어졌습니다.</p>
        <p>시간: ${new Date().toLocaleString()}</p>
      `,
    });
    this.logger.log(`메일 전송 완료: ${serverName}`);
  }
} 