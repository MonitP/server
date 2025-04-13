import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, OnModuleInit } from '@nestjs/common';

interface ProcessStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped';
}

interface ServerStatus {
  serverId: string;
  serverName: string;
  status: 'connected' | 'disconnected';
  cpu: number;
  memory: number;
  disk: number;
  processes: ProcessStatus[];
  lastUpdate: Date;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ServerMonitorGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private serverStatusMap: Map<string, ServerStatus> = new Map();
  private testInterval: NodeJS.Timeout;

  onModuleInit() {
    this.createDummyData();
    this.startTestUpdates();
  }

  private createDummyData() {
    const dummyservers: ServerStatus[] = [
      {
        serverId: 'server-1',
        serverName: 'server 1',
        status: 'connected',
        cpu: 30,
        memory: 4096,
        disk: 100,
        processes: [
          {
            id: 'process-1',
            name: 'Process 1',
            status: 'running'
          },
          {
            id: 'process-2',
            name: 'Process 2',
            status: 'running'
          }
        ],
        lastUpdate: new Date()
      },
      {
        serverId: 'server-2',
        serverName: 'server 2',
        status: 'connected',
        cpu: 25,
        memory: 2048,
        disk: 100,
        processes: [
          {
            id: 'process-1',
            name: 'Process 1',
            status: 'running'
          },
          {
            id: 'process-2',
            name: 'Process 2',
            status: 'stopped'
          }
        ],
        lastUpdate: new Date()
      },
      {
        serverId: 'server-3',
        serverName: 'server 3',
        status: 'disconnected',
        cpu: 0,
        memory: 0,
        disk: 100,
        processes: [
          {
            id: 'process-1',
            name: 'Process 1',
            status: 'stopped'
          },
          {
            id: 'process-2',
            name: 'Process 2',
            status: 'stopped'
          }
        ],
        lastUpdate: new Date()
      }
    ];

    dummyservers.forEach(server => {
      this.serverStatusMap.set(server.serverId, server);
    });

    this.broadcastServerList();
  }

  private startTestUpdates() {
    this.testInterval = setInterval(() => {
      this.updateDummyData();
      this.broadcastServerList();
    }, 5000);
  }

  private updateDummyData() {
    this.serverStatusMap.forEach((server, serverId) => {
      server.processes = server.processes.map(process => ({
        ...process,
        status: Math.random() > 0.1 ? process.status : 
               (process.status === 'running' ? 'stopped' : 'running')
      }));

      server.cpu = Number((Math.min(100, Math.max(0, server.cpu + (Math.random() * 10 - 5)))).toFixed(1));
      server.memory = Math.max(0, server.memory + (Math.random() * 100 - 50));
      server.status = server.processes.every(p => p.status === 'running') ? 
                    'connected' : 'disconnected';
      server.lastUpdate = new Date();

      this.serverStatusMap.set(serverId, server);
    });
  }

  handleConnection(server: Socket) {
    console.log(`server connected: ${server.id}`);
    
    server.on('register-server', (serverInfo: { serverId: string; serverName: string }) => {
      this.registerserver(server, serverInfo);
    });

    server.on('update-status', (status: { 
      cpu: number;
      memory: number;
      processes: ProcessStatus[];
    }) => {
      this.updateserverStatus(server.id, status);
    });
  }

  handleDisconnect(server: Socket) {
    console.log(`server disconnected: ${server.id}`);
    this.removeserver(server.id);
  }

  private registerserver(server: Socket, serverInfo: { serverId: string; serverName: string }) {
    const serverStatus: ServerStatus = {
      serverId: serverInfo.serverId,
      serverName: serverInfo.serverName,
      status: 'connected',
      cpu: 0,
      memory: 0,
      disk: 0,
      processes: [],
      lastUpdate: new Date(),
    };

    this.serverStatusMap.set(serverInfo.serverId, serverStatus);
    server['serverId'] = serverInfo.serverId;
    this.broadcastServerList();
  }

  private removeserver(serverId: string) {
    this.serverStatusMap.delete(serverId);
    this.broadcastServerList();
  }

  private updateserverStatus(serverId: string, status: { 
    cpu: number;
    memory: number;
    processes: ProcessStatus[];
  }) {
    const serverStatus = this.serverStatusMap.get(serverId);
    if (!serverStatus) return;

    serverStatus.cpu = status.cpu;
    serverStatus.memory = status.memory;
    serverStatus.processes = status.processes;
    serverStatus.lastUpdate = new Date();
    serverStatus.status = status.processes.every(p => p.status === 'running') ? 'connected' : 'disconnected';

    this.serverStatusMap.set(serverId, serverStatus);
    this.broadcastServerList();
  }

  private broadcastServerList() {
    const serverList = Array.from(this.serverStatusMap.values());
    this.server.emit('update', serverList);
  }
} 