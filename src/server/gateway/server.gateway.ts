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

  private lastCommandResultKey: string | null = null;
  private processingCommand: string | null = null;

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

    client.on('init', async (data: { serverCode: string }) => {
      const code = data.serverCode;

      const serverExists = await this.serverService.findByCode(code);
      if (!serverExists) {
        return;
      }

      await this.emitNotification(code, NotificationType.CONNECTED);
      this.server.emit('notifications');
    });

    client.on('command', async (data: { 
      serverCode: string; 
      command: string;
      timestamp: string;
    }) => {
      const { serverCode, command, timestamp } = data;
      console.log(`명령어 수신: serverCode=${serverCode}, command=${command}, timestamp=${timestamp}`);
      this.server.emit('execute_command', {
        serverCode,
        command,
        timestamp
      });
    });

    client.on('command_result', (data: {
      serverCode: string;
      command: string;
      result: string;
    }) => {
      const eventKey = `${data.serverCode}_${data.command}`;
      
      if (!this.processingCommand || this.processingCommand !== eventKey) {
        this.processingCommand = eventKey;
        console.log("command_show ", data);
        this.server.emit('command_show', data);
        
        setTimeout(() => {
          this.processingCommand = null;
        }, 1000);
      }
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

      const serverExists = await this.serverService.findByCode(code);
      if (!serverExists) {
        return;
      }

      if (!status || !status.cpu || !status.ram || !status.disk || !status.gpu) {
        return;
      }
      await this.statusService.update(code, {
        cpu: parseFloat(status.cpu),
        ram: parseFloat(status.ram.usage),
        disk: parseFloat(status.disk.usage),
        gpu: parseFloat(status.gpu.usage),
        status: 'connected',
      }, client.id);
    });

    client.on('update-process', async (data: {
      serverCode: string;
      version: string;
      name?: string; // name 빠질 수도 있음
    }) => {
      const serverExists = await this.serverService.findByCode(data.serverCode);
      if (!serverExists) {
        // console.warn('[경고] 존재하지 않는 서버:', data.serverCode);
        return;
      }
    
      // 정상 name 있는 프로세스만 반영
      await this.statusService.updateProcesses(data.serverCode, data);
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
