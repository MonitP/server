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

    this.logger.log(`메일 수신자 조회 시작: ${serverName}${processName ? ' (' + processName + ')' : ''}`);

    const allRecipients = await this.findAll();
    const allEmails = allRecipients.map(r => r.email);

    if (allEmails.length === 0) {
      this.logger.warn('메일 수신자가 없습니다.');
      return;
    }

    this.logger.log(`메일 전송 시작: ${serverName}${processName ? ' (' + processName + ')' : ''} -> ${allEmails.join(', ')}`);

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const subject = processName 
      ? `프로세스 끊김 알림 : ${serverName} (${processName})`
      : `서버 연결 끊김 알림 : ${serverName}`;

    const text = processName
      ? `${serverName} 서버의 ${processName} 프로세스와의 연결이 끊어졌습니다.\n\n시간: ${formattedDate}`
      : `${serverName} 서버와의 연결이 끊어졌습니다.\n\n시간: ${formattedDate}`;

    const html = processName
      ? `
        <h2>프로세스 끊김 알림</h2>
        <p><strong>서버:</strong> ${serverName}</p>
        <p><strong>프로세스:</strong> ${processName}</p>
        <p><strong>발생 시간:</strong> ${formattedDate}</p>
        <p>프로세스 상태를 확인하시기 바랍니다.</p>
      `
      : `
        <h2>서버 연결 끊김 알림</h2>
        <p>${serverName} 서버와의 연결이 끊어졌습니다.</p>
        <p>시간: ${formattedDate}</p>
      `;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: allEmails,
      subject,
      text,
      html,
    });

    this.logger.log(`메일 전송 완료: ${serverName}${processName ? ' (' + processName + ')' : ''}`);
  }

  async sendContaminationAlertMail(serverCode: string, status: string, date: string): Promise<void> {
    this.logger.log(`오염도 알림 메일 수신자 조회 시작: ${serverCode} - ${status}`);

    const allRecipients = await this.findAll();
    const allEmails = allRecipients.map(r => r.email);

    if (allEmails.length === 0) {
      this.logger.warn('메일 수신자가 없습니다.');
      return;
    }

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const statusText = status === 'warning' ? '경고' : status === 'critical' ? '위험' : status;
    const statusColor = status === 'warning' ? '#FFA500' : status === 'critical' ? '#FF0000' : '#000000';

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: allEmails,
      subject: `오염도 알림 : ${serverCode} - ${statusText}`,
      text: `${serverCode} 서버에서 ${statusText} 수준의 오염도가 감지되었습니다.\n날짜 : ${date}\n시간 : ${formattedDate}`,
      html: `
        <h2 style="color: ${statusColor};">오염도 알림</h2>
        <p><strong>서버:</strong> ${serverCode}</p>
        <p><strong>상태:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
        <p><strong>날짜:</strong> ${date}</p>
        <p><strong>발생 시간:</strong> ${formattedDate}</p>
        <p>오염도 이미지를 확인하시기 바랍니다.</p>
      `,
    });

    this.logger.log(`오염도 알림 메일 전송 완료: ${serverCode} - ${status}`);
  }


} 