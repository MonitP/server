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
import { LogService } from 'src/log/log.service';

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
    private readonly logService: LogService,
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

    client.on('server-log', async (data: {
      serverCode: string;
      type: 'error' | 'warning' | 'info';
      message: string;
    }) => {
      if (!data.serverCode) {
        console.log('로그 수신 실패: 서버 코드가 없음', { data });
        return;
      }

      const serverExists = await this.serverService.findByCode(data.serverCode);
      if (!serverExists) {
        console.log('로그 수신 실패: DB에 없는 서버 코드', {
          serverCode: data.serverCode,
          data
        });
        return;
      }

      console.log('로그 수신:', {
        serverCode: data.serverCode,
        type: data.type,
        message: data.message,
        timestamp: new Date()
      });

      await this.logService.addLog({
        serverCode: data.serverCode,
        type: data.type,
        message: data.message,
        timestamp: new Date(),
      });

      this.server.emit('server-log', {
        serverCode: data.serverCode,
        serverName: serverExists.name,
        type: data.type,
        message: data.message,
        timestamp: new Date()
      });
    });
    
    client.on('update-status', async (data: {
      code: string;
      status: {
        cpu: string;
        ram: { usage: string };
        disk: { usage: string };
        gpu: { usage: string };
        network: { usage: string };
      };
    }) => {
      const { code, status } = data;

      console.log('Jehee update-status', data);

      const serverExists = await this.serverService.findByCode(code);
      if (!serverExists) {
        return;
      }

      if (!status || !status.cpu || !status.ram || !status.disk || !status.gpu || !status.network) {
        return;
      }

      const currentServerStatus = this.statusService.getServerCodeBySocketId(client.id);
      const serverStatus = currentServerStatus ? 'connected' : 'disconnected';

      await this.statusService.update(code, {
        cpu: parseFloat(status.cpu),
        ram: parseFloat(status.ram.usage),
        disk: parseFloat(status.disk.usage),
        gpu: parseFloat(status.gpu.usage),
        network: parseFloat(status.network.usage),
        status: serverStatus,
      }, client.id);
    });

    client.on('update-process', async (data: {
      serverCode: string;
      version: string;
      name?: string;
    }) => {
      const serverExists = await this.serverService.findByCode(data.serverCode);
      if (!serverExists) {
        return;
      }
    
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
