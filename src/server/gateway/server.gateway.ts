import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ServerService, ServerStatusService } from '../service';
import { NotificationService } from 'src/notification/service';
import { NotificationType } from 'src/notification/const/notification-type.enum';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ServerGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly statusService: ServerStatusService,
    private readonly notificationService: NotificationService,
    private readonly serverService: ServerService,
  ) {}

  onModuleInit() {
    this.statusService.setSocketServer(this.server);
  }

  handleConnection(client: Socket) {
    console.log(`server connected: ${client.id}`);

    client.on('init', async (data: { code: string }) => {
      console.log("init", data.code);
      const code = data.code;
      await this.emitNotification(code, NotificationType.CONNECTED);
      this.server.emit('notifications');
    });

    client.on('command', async (data: { 
      serverId: string; 
      command: string;
      timestamp: string;
    }) => {
      const { serverId, command, timestamp } = data;
      console.log(`명령어 수신: serverId=${serverId}, command=${command}, timestamp=${timestamp}`);
      this.server.emit('execute_command', {
        serverId,
        command,
        timestamp
      });
    });

    client.on('command_result', (data: {
      serverId: string;
      command: string;
      result: string;
    }) => {
      this.server.emit('command_show', data);
    });
    

    client.on('update-status', async (data: {
      code: string;
      status: {
        cpu: string;
        ram: { usage: string };
        disk: { usage: string };
        gpu: { usage: string };
      };
    }) => {
      const { code, status } = data;
      await this.statusService.update(code, {
        cpu: parseFloat(status.cpu),
        ram: parseFloat(status.ram.usage),
        disk: parseFloat(status.disk.usage),
        gpu: parseFloat(status.gpu.usage),
        status: 'connected',
      }, client.id);
    });

    client.on('update-process', async (data: {
      code: string;
      version: string;
      name: string;
    }) => {
      console.log("update-process ", data);
      await this.statusService.updateProcesses(data.code, data);
    });
  }

  async handleDisconnect(client: Socket) {
    console.log(`server disconnected: ${client.id}`);
    const code = this.statusService.setDisconnected(client.id);
    if (!code) return;

    await this.emitNotification(code, NotificationType.DISCONNECTED);
  }

  private async emitNotification(code: string, type: NotificationType) {
    const server = await this.serverService.findByCode(code);
    if (!server) return;
  
    await this.notificationService.create({
      serverCode: server.code,
      serverName: server.name,
      type,
      timestamp: new Date(),
    });
  
    this.server.emit('notifications');
  }
}
