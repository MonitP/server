import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ProcessStatus, ServerStatus } from '../server.interface';
import { ServerService } from './server.service';
import { Server } from 'socket.io';

type hourBuffer = {
  sumCpu: number;
  sumRam: number;
  sumGpu: number;
  sumNetwork: number;
  count: number;
};

@Injectable()
export class ServerStatusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServerStatusService.name);
  private serverMap = new Map<string, ServerStatus>();
  private processIdCounters = new Map<string, number>();
  private processUpdateTimestamps = new Map<string, Map<string, number>>();
  private processStartTimes = new Map<string, Map<string, Date>>();
  private socketServer: Server;
  private updateInterval: NodeJS.Timeout;
  private updownTimeInterval: NodeJS.Timeout;
  private socketToCodeMap = new Map<string, string>();
  private hourMap: Map<string, hourBuffer> = new Map();
  private currentHour: number = new Date().getHours();
  private lastDate: string = new Date().toISOString().slice(0, 10);

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
            cpuHistory: server.cpuHistory || new Array(24).fill(null),
            ramHistory: server.ramHistory || new Array(24).fill(null),
            gpuHistory: server.gpuHistory || new Array(24).fill(null),
            networkHistory: server.networkHistory || new Array(24).fill(null),
            upTime: server.upTime || 0,
            downTime: server.downTime || 0,
          };
          this.serverMap.set(server.code, serverStatus);
        }
      });
    });

    this.updateInterval = setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();
      const todayString = now.toISOString().slice(0, 10);

      if (todayString !== this.lastDate) {
        this.handleDateChange();
        this.lastDate = todayString;
      }
      
      if (currentHour !== this.currentHour) {
        this.handleHourChange();
        this.currentHour = currentHour;
      }

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
              if (p.status === 'running') {
                p.status = 'stopped';
                p.lastUpdate = new Date();
              }
            }
          });
        });

        this.socketServer.emit('update', allServers);
      }
    }, 3000);

    this.updownTimeInterval = setInterval(async () => {
      const servers = await this.serverService.findAll();
      const now = new Date();

      for (const server of servers) {
        if (!server.code || !server.id) continue;

        const serverStatus = this.serverMap.get(server.code);
        if (!serverStatus) continue;

        if (serverStatus.status === 'connected') {
          serverStatus.upTime++;
        } else {
          serverStatus.downTime++;
        }

        await this.serverService.update(server.id, {
          upTime: serverStatus.upTime,
          downTime: serverStatus.downTime
        });
      }
    }, 1000 * 60);
  }

  private async handleDateChange() {
    const servers = await this.serverService.findAll();
    for (const server of servers) {
      if (!server.code || !server.id) continue;
      
      await this.serverService.update(server.id, {
        cpuHistory: new Array(24).fill(null),
        ramHistory: new Array(24).fill(null),
        gpuHistory: new Array(24).fill(null),
        networkHistory: new Array(24).fill(null),
        historyDate: this.lastDate
      });

      const serverStatus = this.serverMap.get(server.code);
      if (serverStatus) {
        serverStatus.cpuHistory = new Array(24).fill(null);
        serverStatus.ramHistory = new Array(24).fill(null);
        serverStatus.gpuHistory = new Array(24).fill(null);
        serverStatus.networkHistory = new Array(24).fill(null);
      }
    }
  }

  private async handleHourChange() {
    for (const [code, buffer] of this.hourMap.entries()) {
      if (buffer.count === 0) continue;

      const avgCpu = buffer.sumCpu / buffer.count;
      const avgRam = buffer.sumRam / buffer.count;
      const avgGpu = buffer.sumGpu / buffer.count;
      const avgNetwork = buffer.sumNetwork / buffer.count;

      const server = await this.serverService.findByCode(code);
      if (!server) continue;

      const serverStatus = this.serverMap.get(code);
      if (!serverStatus) continue;

      const prevHour = (this.currentHour + 23) % 24;
      serverStatus.cpuHistory[prevHour] = parseFloat(avgCpu.toFixed(2));
      serverStatus.ramHistory[prevHour] = parseFloat(avgRam.toFixed(2));
      serverStatus.gpuHistory[prevHour] = parseFloat(avgGpu.toFixed(2));
      serverStatus.networkHistory[prevHour] = parseFloat(avgNetwork.toFixed(2));

      await this.serverService.update(server.id, {
        cpuHistory: serverStatus.cpuHistory,
        ramHistory: serverStatus.ramHistory,
        gpuHistory: serverStatus.gpuHistory,
        networkHistory: serverStatus.networkHistory,
        historyDate: this.lastDate
      });

      this.hourMap.set(code, { sumCpu: 0, sumRam: 0, sumGpu: 0, sumNetwork: 0, count: 0 });
    }
  }

  onModuleDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.updownTimeInterval) {
      clearInterval(this.updownTimeInterval);
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
      const todayString = now.toISOString().slice(0, 10);

      if (todayString !== this.lastDate) {
        await this.handleDateChange();
        this.lastDate = todayString;
      }

      if (hour !== this.currentHour) {
        await this.finalizeHour(code);
        this.currentHour = hour;
      }

      const buffer = this.hourMap.get(code) ?? { sumCpu: 0, sumRam: 0, sumGpu: 0, sumNetwork: 0, count: 0 };
      buffer.sumCpu += status.cpu;
      buffer.sumRam += status.ram;
      buffer.sumGpu += status.gpu;
      buffer.sumNetwork += status.network;
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
          cpuHistory: new Array(24).fill(null),
          ramHistory: new Array(24).fill(null),
          gpuHistory: new Array(24).fill(null),
          networkHistory: new Array(24).fill(null),
          upTime: 0,
          downTime: 0,
        };
        this.processIdCounters.set(code, 0);
      }

      const avgCpu = buffer.sumCpu / buffer.count;
      const avgRam = buffer.sumRam / buffer.count;
      const avgGpu = buffer.sumGpu / buffer.count;
      const avgNetwork = buffer.sumNetwork / buffer.count;

      serverStatus.cpuHistory[hour] = parseFloat(avgCpu.toFixed(2));
      serverStatus.ramHistory[hour] = parseFloat(avgRam.toFixed(2));
      serverStatus.gpuHistory[hour] = parseFloat(avgGpu.toFixed(2));
      serverStatus.networkHistory[hour] = parseFloat(avgNetwork.toFixed(2));

      serverStatus.cpu = status.cpu;
      serverStatus.ram = status.ram;
      serverStatus.disk = status.disk;
      serverStatus.gpu = status.gpu;
      serverStatus.network = status.network;
      serverStatus.status = status.status;
      serverStatus.lastUpdate = new Date();

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
        cpuHistory: serverStatus.cpuHistory,
        ramHistory: serverStatus.ramHistory,
        gpuHistory: serverStatus.gpuHistory,
        networkHistory: serverStatus.networkHistory,
        upTime: serverStatus.upTime,
        downTime: serverStatus.downTime,
        startTime: server.startTime || new Date(),
        lastRestart: server.lastRestart || new Date()
      });

      await this.serverService.update(server.id, {
        cpuHistory: serverStatus.cpuHistory,
        ramHistory: serverStatus.ramHistory,
        gpuHistory: serverStatus.gpuHistory,
        networkHistory: serverStatus.networkHistory,
        historyDate: todayString,
        upTime: serverStatus.upTime,
        downTime: serverStatus.downTime,
        startTime: server.startTime || new Date(),
        lastRestart: server.lastRestart || new Date()
      });

    } catch (error) {
      this.logger.error(`서버 상태 업데이트 실패: code=${code}, error=${error.message}`);
    }
  }

  async updateProcesses(serverCode: string, process: { 
    serverCode: string; 
    version: string; 
    name?: string;
    lastUpdate?: Date;
  }) {
    const server = await this.serverService.findByCode(serverCode);
    if (!server || !process.name) return;

    const serverStatus = this.serverMap.get(serverCode);
    if (!serverStatus) return;

    const now = Date.now();

    if (!this.processUpdateTimestamps.has(serverCode)) {
      this.processUpdateTimestamps.set(serverCode, new Map());
    }
    if (!this.processStartTimes.has(serverCode)) {
      this.processStartTimes.set(serverCode, new Map());
    }

    const timestamps = this.processUpdateTimestamps.get(serverCode)!;
    const startTimes = this.processStartTimes.get(serverCode)!;
    timestamps.set(process.name, now);
    
    const existing = serverStatus.processes.find(p => p.name === process.name);
    if (existing) {
      if (existing.status === 'stopped') {
        startTimes.set(process.name, new Date());
        existing.startTime = new Date();
        existing.runningTime = 0;
      }
      existing.status = 'running';
      existing.version = process.version;
      existing.lastUpdate = new Date();
      existing.runningTime = Math.floor((now - startTimes.get(process.name)!.getTime()) / 1000 / 60); // 분 단위로 변환
    } else {
      const dbProcesses = await this.serverService.findByCode(serverCode);
      const isDuplicate = dbProcesses?.processes?.some(p => p.name === process.name);
      
      if (!isDuplicate) {
        startTimes.set(process.name, new Date());
        serverStatus.processes.push({
          name: process.name,
          version: process.version,
          status: 'running',
          lastUpdate: new Date(),
          startTime: new Date(),
          runningTime: 0
        });
        await this.serverService.updateProcesses(serverCode, serverStatus.processes);
      }
    }
  }
  

  remove(code: string) {
    this.serverMap.delete(code);
    this.processIdCounters.delete(code);
  }

  setDisconnected(socketId: string): string | null {
    const serverCode = this.socketToCodeMap.get(socketId);
    if (serverCode) {
      const serverStatus = this.serverMap.get(serverCode);
      if (serverStatus) {
        serverStatus.lastRestart = new Date();
        this.serverService.update(serverStatus.id, { lastRestart: new Date() });
      }
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
      gpuHistory: serverStatus?.gpuHistory ?? new Array(24).fill(null),
      networkHistory: serverStatus?.networkHistory ?? new Array(24).fill(null),
      upTime: serverStatus?.upTime ?? 0,
      downTime: serverStatus?.downTime ?? 0,
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