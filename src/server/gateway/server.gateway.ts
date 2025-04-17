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

      const server = await this.serverService.findByCode(code);
      if (server) {
        await this.notificationService.create({
          serverCode: server.code,
          serverName: server.name,
          type: NotificationType.CONNECTED,
          timestamp: new Date(),
        });
        console.log("Jehee test")
        // this.server.emit('notifications');
      }
    });

    client.on('update-process', async (data: {
      code: string;
      processes: string[];
    }) => {
      await this.statusService.updateProcesses(data.code, data.processes);
    });
  }

  async handleDisconnect(client: Socket) {
    console.log(`server disconnected: ${client.id}`);
    const code = this.statusService.setDisconnected(client.id);
    if (!code) return;

    const server = await this.serverService.findByCode(code);
    if (server) {
      await this.notificationService.create({
        serverCode: server.code,
        serverName: server.name,
        type: NotificationType.DISCONNECTED,
        timestamp: new Date(),
      });
      this.server.emit('notifications');
    }
  }
}
