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
    const threshold = new Date(dto.timestamp.getTime() - 10 * 1000);
  
    const exists = await this.notificationRepo.findOne({
      where: {
        serverCode: dto.serverCode,
        type: dto.type,
        timestamp: MoreThan(threshold),
      },
      order: { timestamp: 'DESC' },
    });
  
    if (exists) {
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

  async delete(id: number): Promise<void> {
    await this.notificationRepo.delete(id);
  }

  async deleteAll(): Promise<void> {
    await this.notificationRepo.delete({});
  }
}