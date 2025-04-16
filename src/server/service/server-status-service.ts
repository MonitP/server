import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ProcessStatus, ServerStatus } from '../server.interface';
import { ServerService } from './server.service';
import { Server } from 'socket.io';

type hourBuffer = {
  sumCpu: number;
  sumMemory: number;
  count: number;
};

@Injectable()
export class ServerStatusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServerStatusService.name);
  private serverMap = new Map<string, ServerStatus>();
  private processIdCounters = new Map<string, number>();
  private socketServer: Server;
  private updateInterval: NodeJS.Timeout;
  private socketToCodeMap = new Map<string, string>();
  private hourMap: Map<string, hourBuffer> = new Map();
  private currentHour: number = new Date().getHours();

  constructor(private readonly serverService: ServerService) {}

  onModuleInit() {
    this.updateInterval = setInterval(() => {
      if (this.socketServer) {
        const data = this.getAll();
        this.socketServer.emit('update', data);
      }
    }, 5000);
  }

  onModuleDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  setSocketServer(server: Server) {
    this.socketServer = server;
  }

  getAll(): ServerStatus[] {
    return Array.from(this.serverMap.values());
  }

  async update(code: string, status: {
    cpu: number;
    memory: number;
    disk: number;
    status: 'connected' | 'disconnected';
  }, socketId: string) {
    try {
      const server = await this.serverService.findByCode(code);
      if (!server) return;

      this.socketToCodeMap.set(socketId, code);
      const now = new Date();
      const hour = now.getHours();

      console.log(hour, this.currentHour);
  
      if (hour !== this.currentHour) {
        await this.finalizeHour(code);
        this.currentHour = hour;
      }
  
      const buffer = this.hourMap.get(code) ?? { sumCpu: 0, sumMemory: 0, count: 0 };
      buffer.sumCpu += status.cpu;
      buffer.sumMemory += status.memory;
      buffer.count += 1;
      this.hourMap.set(code, buffer);

      console.log(code, status);

      let serverStatus = this.serverMap.get(code);
      if (!serverStatus) {
        serverStatus = {
          id: server.id,
          name: server.name,
          code: server.code,
          cpu: 0,
          memory: 0,
          disk: 0,
          processes: [],
          status: 'connected',
          lastUpdate: new Date(),
          cpuHistory: [],
          memoryHistory: [],
        };
        this.processIdCounters.set(code, 0);
        this.logger.log(`새로운 서버 등록: ${server.name} (${code})`);
      }

      serverStatus.cpu = status.cpu;
      serverStatus.memory = status.memory;
      serverStatus.disk = status.disk;
      serverStatus.status = status.status;
      serverStatus.lastUpdate = new Date();

      this.serverMap.set(code, serverStatus);
    } catch (error) {
      this.logger.error(`서버 상태 업데이트 실패: code=${code}, error=${error.message}`);
    }
  }

  async updateProcesses(code: string, processNames: string[]) {
    const serverStatus = this.serverMap.get(code);
    if (!serverStatus) return;

    serverStatus.processes.forEach(p => {
      p.status = 'stopped';
    });

    const updatedProcesses: ProcessStatus[] = processNames.map(name => {
      const existing = serverStatus.processes.find(p => p.name === name);
      if (existing) {
        existing.status = 'running';
        return existing;
      }
      return { name, status: 'running' };
    });

    const updatedNames = new Set(processNames);
    serverStatus.processes = serverStatus.processes
      .filter(p => !updatedNames.has(p.name))
      .concat(updatedProcesses);

    await this.serverService.updateProcesses(code, serverStatus.processes);
  }

  remove(code: string) {
    this.serverMap.delete(code);
    this.processIdCounters.delete(code);
  }

  setDisconnected(socketId: string) {
    const serverCode = this.socketToCodeMap.get(socketId);
    if (serverCode) {
      const serverStatus = this.serverMap.get(serverCode);
      this.finalizeHour(serverCode);
      if (serverStatus) {
        serverStatus.status = 'disconnected';
        serverStatus.processes.forEach(process => {
          process.status = 'stopped';
        });
        this.logger.log(`서버 연결 끊김: ${serverStatus.name} (${serverCode})`);
      }
      this.socketToCodeMap.delete(socketId);
    }
  }

  private async finalizeHour(code: string) {
    const buffer = this.hourMap.get(code);
    if (!buffer || buffer.count === 0) return;

    const avgCpu = buffer.sumCpu / buffer.count;
    const avgMem = buffer.sumMemory / buffer.count;

    this.hourMap.delete(code);

    const server = await this.serverService.findByCode(code);
    if (!server) return;

    server.cpuHistory = [...(server.cpuHistory ?? []), parseFloat(avgCpu.toFixed(2))];
    server.memoryHistory = [...(server.memoryHistory ?? []), parseFloat(avgMem.toFixed(2))];

    if (server.cpuHistory.length > 24) server.cpuHistory.shift();
    if (server.memoryHistory.length > 24) server.memoryHistory.shift();

    await this.serverService.update(server.id, {
      ...server,
      cpuHistory: server.cpuHistory,
      memoryHistory: server.memoryHistory,
    });

    this.logger.log(`시간대 저장 완료: ${code} - CPU ${avgCpu.toFixed(2)}% / Mem ${avgMem.toFixed(2)}%`);
  }
}
