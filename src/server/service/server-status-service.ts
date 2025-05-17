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
  private processUpdateTimestamps = new Map<string, Map<string, number>>();
  private socketServer: Server;
  private updateInterval: NodeJS.Timeout;
  private socketToCodeMap = new Map<string, string>();
  private hourMap: Map<string, hourBuffer> = new Map();
  private currentHour: number = new Date().getHours();

  constructor(private readonly serverService: ServerService) {}

  onModuleInit() {
    this.serverService.findAll().then(servers => {
      servers.forEach(server => {
        if (!server.code) return;
        if (!this.serverMap.has(server.code)) {
          const serverStatus: ServerStatus = {
            id: server.id || '',
            name: server.name || '',
            code: server.code,
            cpu: 0,
            ram: 0,
            disk: 0,
            gpu: 0,
            network: 0,
            processes: server.processes?.map(p => ({
              name: p.name || '',
              version: p.version || '',
              status: 'stopped'
            })) || [],
            status: 'disconnected',
            lastUpdate: new Date(),
            cpuHistory: server.cpuHistory || [],
            ramHistory: server.ramHistory || [],
          };
          this.serverMap.set(server.code, serverStatus);
        }
      });
    });

    this.updateInterval = setInterval(() => {
      if (this.socketServer) {
        const allServers = Array.from(this.serverMap.values());
        const now = Date.now();

        allServers.forEach(serverStatus => {
          if (now - serverStatus.lastUpdate.getTime() > 1000 * 30) {
            serverStatus.status = 'disconnected';
          }

          const timestamps = this.processUpdateTimestamps.get(serverStatus.code);
          if (!timestamps) return;
  
          serverStatus.processes.forEach(p => {
            let checkTime = 0
            
            if(p.name === "AI-SERVER") {
              checkTime = 1000 * 120
            }
            else {
              checkTime = 1000 * 30
            }

            const last = timestamps.get(p.name);
            if (!last || now - last > checkTime) {
              p.status = 'stopped';
            }
          });
        });

        this.socketServer.emit('update', allServers);
      }
    }, 3000);
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
      network: number;
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

      if (hour !== this.currentHour) {
        await this.finalizeHour(code);
        this.currentHour = hour;
      }

      const buffer = this.hourMap.get(code) ?? { sumCpu: 0, sumRam: 0, count: 0 };
      buffer.sumCpu += status.cpu;
      buffer.sumRam += status.ram;
      buffer.count += 1;
      this.hourMap.set(code, buffer);

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
          network: 0,
          processes: server.processes?.map(p => ({
            name: p.name,
            version: p.version,
            status: 'stopped'
          })) || [],
          status: status.status,
          lastUpdate: new Date(),
          cpuHistory: [],
          ramHistory: [],
        };
        this.processIdCounters.set(code, 0);
      }

      serverStatus.cpu = status.cpu;
      serverStatus.ram = status.ram;
      serverStatus.disk = status.disk;
      serverStatus.gpu = status.gpu;
      serverStatus.network = status.network;
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
        network: status.network,
        processes: serverStatus?.processes ?? [],
        status: status.status,
        lastUpdate: new Date(),
        cpuHistory,
        ramHistory,
      });

      // this.logger.log(
        // `서버 상태 업데이트: ${code} - CPU ${status.cpu.toFixed(2)}%, RAM ${status.ram.toFixed(2)}%, Network ${status.network.toFixed(2)}%`
      // );
    } catch (error) {
      // this.logger.error(`서버 상태 업데이트 실패: code=${code}, error=${error.message}`);
    }
  }

  async updateProcesses(serverCode: string, process: { serverCode: string; version: string; name?: string }) {
    const server = await this.serverService.findByCode(serverCode);
    if (!server || !process.name) return;

    const serverStatus = this.serverMap.get(serverCode);
    if (!serverStatus) return;

    const now = Date.now();
    // this.logger.log(`[updateProcesses] ${serverCode} - ${process.name} called at ${new Date().toISOString()}`);

    if (!this.processUpdateTimestamps.has(serverCode)) {
      this.processUpdateTimestamps.set(serverCode, new Map());
    }
    const timestamps = this.processUpdateTimestamps.get(serverCode)!;
    timestamps.set(process.name, now);
    
    const existing = serverStatus.processes.find(p => p.name === process.name);
    if (existing) {
      existing.status = 'running';
      existing.version = process.version;
    } else {
      serverStatus.processes.push({
        name: process.name,
        version: process.version,
        status: 'running'
      });
    }

    await this.serverService.updateProcesses(serverCode, serverStatus.processes);
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
      this.serverService.handleServerDisconnected(serverCode);
      this.socketToCodeMap.delete(socketId);
      return serverCode;
    }
    return null;
  }

  getServerCodeBySocketId(socketId: string): string | undefined {
    return this.socketToCodeMap.get(socketId);
  }

  private async finalizeHour(code: string) {
    const buffer = this.hourMap.get(code);
    if (!buffer || buffer.count === 0) return;
  
    const avgCpu = buffer.sumCpu / buffer.count;
    const avgRam = buffer.sumRam / buffer.count;
  
    this.hourMap.delete(code);
  
    const server = await this.serverService.findByCode(code);
    if (!server) return;
  
    const hourIndex = this.currentHour;
  
    const todayString = new Date().toISOString().slice(0, 10);
  
    if (!server.historyDate) {
      server.historyDate = todayString;
      server.cpuHistory = new Array(24).fill(null);
      server.ramHistory = new Array(24).fill(null);
    }
  
    if (server.historyDate !== todayString) {
      server.cpuHistory = new Array(24).fill(null);
      server.ramHistory = new Array(24).fill(null);
      server.historyDate = todayString;
    }
  
    server.cpuHistory[hourIndex] = parseFloat(avgCpu.toFixed(2));
    server.ramHistory[hourIndex] = parseFloat(avgRam.toFixed(2));
  
    await this.serverService.update(server.id, {
      cpuHistory: server.cpuHistory,
      ramHistory: server.ramHistory,
      historyDate: server.historyDate,
    });
  
    const serverStatus = this.serverMap.get(code);
    this.serverMap.set(code, {
      ...server,
      cpu: serverStatus?.cpu ?? 0,
      ram: serverStatus?.ram ?? 0,
      disk: serverStatus?.disk ?? 0,
      gpu: serverStatus?.gpu ?? 0,
      network: serverStatus?.network ?? 0,
      processes: serverStatus?.processes ?? [],
      status: serverStatus?.status ?? 'disconnected',
      lastUpdate: new Date(),
      cpuHistory: server.cpuHistory,
      ramHistory: server.ramHistory,
    });
  
    const avgNetwork = serverStatus?.network ?? 0;
    this.logger.log(
      `시간대 저장 완료: ${code} - ${hourIndex}시 → CPU ${avgCpu.toFixed(2)}%, RAM ${avgRam.toFixed(2)}%, Network ${avgNetwork.toFixed(2)}%`
    );
  }
  
  async deleteProcess(code: string, processName: string): Promise<void> {
    const serverStatus = this.serverMap.get(code);
    if (!serverStatus) return;

    const processIndex = serverStatus.processes.findIndex(p => p.name === processName);
    if (processIndex !== -1) {
      serverStatus.processes.splice(processIndex, 1);
    }

    await this.serverService.deleteProcess(code, processName);
  }
}