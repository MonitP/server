// 📁 src/servers/gateways/servers.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ServerStatusService } from '../service';
import { ProcessStatus } from '../server.interface';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ServerGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  constructor(private readonly statusService: ServerStatusService) {}

  onModuleInit() {
    this.statusService.setSocketServer(this.server);
  }

  handleConnection(client: Socket) {
    console.log(`server connected: ${client.id}`);

    client.on('update-status', async (data: {
      code: string;
      cpu: number;
      memory: number;
      disk: number;
      processes: string[];
      status: 'connected' | 'disconnected';
    }) => {
      await this.statusService.update(data.code, {
        cpu: data.cpu,
        memory: data.memory,
        disk: data.disk,
        processes: data.processes,
        status: data.status
      }, client.id);
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`server disconnected: ${client.id}`);
    
    // 서버 연결이 끊어졌을 때 서버와 프로세스 상태를 모두 disconnected/stopped로 변경
    this.statusService.setDisconnected(client.id);
  }
}
