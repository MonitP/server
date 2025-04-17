import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { CreateNotificationDto } from '../dto';
import { NotificationType } from '../const/notification-type.enum';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification | null> {
    const start = new Date(dto.timestamp);
    start.setMilliseconds(0);
  
    const end = new Date(start);
    end.setSeconds(start.getSeconds() + 1);
  
    const exists = await this.notificationRepo.findOne({
      where: {
        serverCode: dto.serverCode,
        type: dto.type,
        timestamp: MoreThan(start),
      },
      order: { timestamp: 'ASC' },
    });
  
    if (exists && exists.timestamp < end) {
      return null;
    }
  
    const entity = this.notificationRepo.create(dto);
    return this.notificationRepo.save(entity);
  }
  
  
  async findAll(): Promise<Notification[]> {
    return this.notificationRepo.find({ order: { timestamp: 'DESC' } });
  }

  async markAsRead(id: number): Promise<void> {
    await this.notificationRepo.update(id, { read: true });
  }

  async markAllAsRead(): Promise<void> {
    await this.notificationRepo.update({}, { read: true });
  }

  async deleteOld(): Promise<void> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    await this.notificationRepo.delete({ timestamp: LessThan(weekAgo) });
  }

  async isDuplicate(type: number, serverCode: string, withinMinutes = 5): Promise<boolean> {
    const now = new Date();
    const threshold = new Date(now.getTime() - withinMinutes * 60 * 1000);
  
    const existing = await this.notificationRepo.findOne({
      where: {
        type,
        serverCode,
        timestamp: MoreThan(threshold),
      },
      order: { timestamp: 'DESC' },
    });
  
    return !!existing;
  }
  
}