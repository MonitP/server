import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ProcessStatus, ServerStatus } from '../server.interface';
import { ServerService } from './server.service';
import { Server } from 'socket.io';

type hourBuffer = {
  sumCpu: number;
  sumRam: number;
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
        const connectedServers = Array.from(this.serverMap.values()).filter(
          (s) => s.status === 'connected'
        );
        this.socketServer.emit('update', connectedServers);
        console.log('Data : ', connectedServers);
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

  async update(
    code: string,
    status: {
      cpu: number;
      ram: number;
      disk: number;
      gpu: number;
      status: 'connected' | 'disconnected';
    },
    socketId: string
  ) {
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

      const buffer = this.hourMap.get(code) ?? { sumCpu: 0, sumRam: 0, count: 0 };
      buffer.sumCpu += status.cpu;
      buffer.sumRam += status.ram;
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
          ram: 0,
          disk: 0,
          gpu: 0,
          processes: [],
          status: 'connected',
          lastUpdate: new Date(),
          cpuHistory: [],
          ramHistory: [],
        };
        this.processIdCounters.set(code, 0);
        this.logger.log(`새로운 서버 등록: ${server.name} (${code})`);
      }

      serverStatus.cpu = status.cpu;
      serverStatus.ram = status.ram;
      serverStatus.disk = status.disk;
      serverStatus.gpu = status.gpu;
      serverStatus.status = status.status;
      serverStatus.lastUpdate = new Date();

      const avgCpu = buffer.sumCpu / buffer.count;
      const avgRam = buffer.sumRam / buffer.count;

      const cpuHistory = Array.isArray(server.cpuHistory) && server.cpuHistory.length === 24
        ? [...server.cpuHistory]
        : new Array(24).fill(null);

      const ramHistory = Array.isArray(server.ramHistory) && server.ramHistory.length === 24
        ? [...server.ramHistory]
        : new Array(24).fill(null);

      cpuHistory[this.currentHour] = parseFloat(avgCpu.toFixed(2));
      ramHistory[this.currentHour] = parseFloat(avgRam.toFixed(2));

      this.serverMap.set(code, {
        ...server,
        cpu: status.cpu,
        ram: status.ram,
        disk: status.disk,
        gpu: status.gpu,
        processes: serverStatus?.processes ?? [],
        status: status.status,
        lastUpdate: new Date(),
        cpuHistory,
        ramHistory,
      });
    } catch (error) {
      this.logger.error(`서버 상태 업데이트 실패: code=${code}, error=${error.message}`);
    }
  }

  async updateProcesses(code: string, processNames: string[]) {
    const serverStatus = this.serverMap.get(code);
    if (!serverStatus) return;

    serverStatus.processes.forEach((p) => {
      p.status = 'stopped';
    });

    const updatedProcesses: ProcessStatus[] = processNames.map((name) => {
      const existing = serverStatus.processes.find((p) => p.name === name);
      if (existing) {
        existing.status = 'running';
        return existing;
      }
      return { name, status: 'running' };
    });

    const updatedNames = new Set(processNames);
    serverStatus.processes = serverStatus.processes
      .filter((p) => !updatedNames.has(p.name))
      .concat(updatedProcesses);

    await this.serverService.updateProcesses(code, serverStatus.processes);
  }

  remove(code: string) {
    this.serverMap.delete(code);
    this.processIdCounters.delete(code);
  }

  setDisconnected(socketId: string): string | null {
    const serverCode = this.socketToCodeMap.get(socketId);
    if (serverCode) {
      const serverStatus = this.serverMap.get(serverCode);
      this.finalizeHour(serverCode);
      if (serverStatus) {
        serverStatus.status = 'disconnected';
        serverStatus.processes.forEach((process) => {
          process.status = 'stopped';
        });
        this.logger.log(`서버 연결 끊김: ${serverStatus.name} (${serverCode})`);
      }
      this.socketToCodeMap.delete(socketId);
      return serverCode; 
    }
    return null;
  }
  

  private async finalizeHour(code: string) {
    const buffer = this.hourMap.get(code);
    if (!buffer || buffer.count === 0) return;

    const avgCpu = buffer.sumCpu / buffer.count;
    const avgMem = buffer.sumRam / buffer.count;

    this.hourMap.delete(code);

    const server = await this.serverService.findByCode(code);
    if (!server) return;

    const hourIndex = this.currentHour;

    if (!Array.isArray(server.cpuHistory) || server.cpuHistory.length !== 24) {
      server.cpuHistory = new Array(24).fill(null);
    }
    if (!Array.isArray(server.ramHistory) || server.ramHistory.length !== 24) {
      server.ramHistory = new Array(24).fill(null);
    }

    server.cpuHistory[hourIndex] = parseFloat(avgCpu.toFixed(2));
    server.ramHistory[hourIndex] = parseFloat(avgMem.toFixed(2));

    await this.serverService.update(server.id, {
      cpuHistory: server.cpuHistory,
      ramHistory: server.ramHistory,
    });

    const serverStatus = this.serverMap.get(code);
    this.serverMap.set(code, {
      ...server,
      cpu: serverStatus?.cpu ?? 0,
      ram: serverStatus?.ram ?? 0,
      disk: serverStatus?.disk ?? 0,
      gpu: serverStatus?.gpu ?? 0,
      processes: serverStatus?.processes ?? [],
      status: serverStatus?.status ?? 'disconnected',
      lastUpdate: new Date(),
      cpuHistory: server.cpuHistory,
      ramHistory: server.ramHistory,
    });

    this.logger.log(
      `시간대 저장 완료: ${code} - ${hourIndex}시 → CPU ${avgCpu.toFixed(2)}%, Mem ${avgMem.toFixed(2)}%`
    );
  }
}