import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ServerStatusService } from '../service';

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
      processes: string[];
    }) => {
      await this.statusService.updateProcesses(data.code, data.processes);
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`server disconnected: ${client.id}`);
    this.statusService.setDisconnected(client.id);
  }
}
