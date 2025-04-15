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
      status: {
        cpu: number;
        memory: number;
        disk: number;
        processes: string[];
      }
    }) => {
      await this.statusService.update(data.code, data.status);
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`server disconnected: ${client.id}`);
  }
}
