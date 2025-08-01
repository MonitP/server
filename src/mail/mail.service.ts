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
    console.log("serverName : ", serverName)
    if (serverName === "무주 농장") return;

    this.logger.log(`메일 수신자 조회 시작: ${serverName}${processName ? ' (' + processName + ')' : ''}`);

    const allRecipients = await this.findAll();
    const allEmails = allRecipients.map(r => r.email);

    const aiTeamPrefixes = ['yjh', 'sjw', 'lih', 'pjb'];
    const isAITeam = (email: string) => aiTeamPrefixes.some(prefix => email.startsWith(prefix));

    let recipientEmails: string[];

    if (processName === 'AI-SERVER') {
      recipientEmails = allEmails.filter(isAITeam);
    } else {
      recipientEmails = allEmails.filter(email => !isAITeam(email));
    }

    if (recipientEmails.length === 0) {
      this.logger.warn('메일 수신자가 없습니다.');
      return;
    }

    this.logger.log(`메일 전송 시작: ${serverName}${processName ? ' (' + processName + ')' : ''} -> ${recipientEmails.join(', ')}`);

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipientEmails,
      subject: `서버 연결 끊김 알림 : ${serverName}${processName ? ' (' + processName + ')' : ''}`,
      text: `${serverName} 서버${processName ? ' (' + processName + ')' : ''}와의 연결이 끊어졌습니다.`,
      html: `
        <h2>서버 연결 끊김 알림</h2>
        <p>${serverName} 서버${processName ? ' (' + processName + ')' : ''}와의 연결이 끊어졌습니다.</p>
        <p>시간: ${formattedDate}</p>
      `,
    });

    this.logger.log(`메일 전송 완료: ${serverName}${processName ? ' (' + processName + ')' : ''}`);
  }


} 