import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { NotificationService } from '../service/notification.service';
import { API_URLS } from 'src/consts/api-urls';
import { CreateNotificationDto } from '../dto';

@Controller(API_URLS.notification.base)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  async create(@Body() dto: CreateNotificationDto) {
    return this.notificationService.create(dto);
  }

  @Get()
  async getAll() {
    return this.notificationService.findAll();
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string) {
    return this.notificationService.markAsRead(Number(id));
  }

  @Post('read-all')
  async markAllRead() {
    return this.notificationService.markAllAsRead();
  }
}