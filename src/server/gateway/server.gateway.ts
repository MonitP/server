// 📁 src/servers/gateways/servers.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, OnModuleInit } from '@nestjs/common';;
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
    this.statusService.seedDummyData();
    this.statusService.startTestUpdates(() => {
      this.server.emit('update', this.statusService.getAll());
    });
  }

  handleConnection(client: Socket) {
    console.log(`server connected: ${client.id}`);

    client.on('register-server', (info: { serverId: string; serverName: string }) => {
      this.statusService.register(info.serverId, info.serverName);
      client['serverId'] = info.serverId;
      this.server.emit('update', this.statusService.getAll());
    });

    client.on('update-status', (status: {
      cpu: number;
      memory: number;
      processes: ProcessStatus[];
    }) => {
      const serverId = client['serverId'];
      if (serverId) {
        this.statusService.update(serverId, status);
        this.server.emit('update', this.statusService.getAll());
      }
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`server disconnected: ${client.id}`);
    this.statusService.remove(client['serverId']);
    this.server.emit('update', this.statusService.getAll());
  }
}
