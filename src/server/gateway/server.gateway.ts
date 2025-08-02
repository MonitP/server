import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ServerService, ServerStatusService } from '../service';
import { NotificationService } from 'src/notification/service';
import { NotificationType } from 'src/notification/const/notification-type.enum';
import { LogService } from 'src/log/log.service';
import { MinioService } from '../service/minio.service';
import { ContaminationService } from '../service/contamination.service';
import { MailService } from 'src/mail/mail.service';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000,
})

export class ServerGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private lastCommandResultKey: string | null = null;
  private processingCommand: string | null = null;
  private disconnectEmitTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly statusService: ServerStatusService,
    private readonly notificationService: NotificationService,
    private readonly serverService: ServerService,
    private readonly logService: LogService,
    private readonly minioService: MinioService,
    private readonly contaminationService: ContaminationService,
    private readonly mailService: MailService,
  ) { }

  onModuleInit() {
    this.statusService.setSocketServer(this.server);
  }

  handleConnection(client: Socket) {
    console.log(`server connected: ${client.id}`);

    const socketCount = this.server.sockets.sockets.size || Object.keys(this.server.sockets.sockets).length;
    console.log(`현재 연결된 소켓 개수: ${socketCount}`);

    const ip =
      client.handshake.headers['x-forwarded-for'] ||
      client.handshake.address ||
      (client.conn && client.conn.remoteAddress) ||
      'unknown';

    console.log(`server connected: ${client.id} from ${ip}`);

    const userAgent = client.handshake.headers['user-agent'] || 'unknown';
    console.log(`server connected: ${client.id} from ${ip}, UA: ${userAgent}`);



    client.on('init', async (data: { serverCode: string }) => {
      const code = data.serverCode;

      this.statusService.clearDisconnectTimer(code);
      const prevTimer = this.disconnectEmitTimers.get(code);
      if (prevTimer) {
        clearTimeout(prevTimer);
        this.disconnectEmitTimers.delete(code);
      }

      const serverExists = await this.serverService.findByCode(code);
      if (!serverExists) {
        return;
      }

      await this.serverService.update(serverExists.id, {
        startTime: new Date(),
        lastRestart: new Date()
      });

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
      lastUpdate?: Date;
    }) => {
      if (!data.serverCode || data.serverCode === 'undefined') {
        return;
      }

      let serverCode = data.serverCode;
      if (!serverCode.endsWith('-00')) {
        serverCode = serverCode + '-00';
      }

      if (serverCode.includes('--')) {
        serverCode = serverCode.replace('--', '-');
      }

      const serverExists = await this.serverService.findByCode(serverCode);
      if (!serverExists) {
        return;
      }

      await this.statusService.updateProcesses(serverCode, {
        ...data,
        serverCode: serverCode,
        lastUpdate: data.lastUpdate || new Date()
      });
    });

    client.on('contamination', async (data: {
      serverCode: string;
      status: string;
      bucket: string;
      date: string;
      detail: string;
    }) => {
      try {
        const isConnected = await this.minioService.testConnection();
        if (!isConnected) {
          return;
        }

        const bucketExists = await this.minioService.bucketExists(data.bucket);
        if (!bucketExists) {
          return;
        }



        const images = await this.minioService.listImages(data.bucket, data.serverCode, data.date);

        const imagesWithUrls = await Promise.all(
          images.map(async (imagePath) => {
            const url = await this.minioService.getImageUrl(data.bucket, data.serverCode, data.date, imagePath);
            return {
              path: imagePath,
              url: url
            };
          })
        );

        await this.contaminationService.saveContaminationData({
          serverCode: data.serverCode,
          status: data.status,
          bucket: data.bucket,
          date: data.date,
          images: imagesWithUrls
        });

        this.server.emit('contamination-images', {
          serverCode: data.serverCode,
          status: data.status,
          bucket: data.bucket,
          date: data.date,
          images: imagesWithUrls
        });

      } catch (error) {
        console.error('contamination 처리 중 오류:', error);
      }
    });
  }

  @SubscribeMessage('contamination')
  async handleContamination(
    @MessageBody() data: {
      serverCode: string;
      status: string;
      bucket: string;
      date: string;
      detail: string;
    },
  ) {
    try {
      const minioServerCode = data.serverCode.replace('-00', '');

      const statusFolder = `${data.date}/${data.status}`;

      const images = await this.minioService.listImages(data.bucket, minioServerCode, data.date, data.status);

      const imagesWithUrls = await Promise.all(
        images.map(async (imagePath) => {
          const url = await this.minioService.getImageUrl(data.bucket, minioServerCode, data.date, imagePath);
          return {
            path: imagePath,
            url: url,
          };
        })
      );

      await this.contaminationService.saveContaminationData({
        serverCode: data.serverCode,
        status: data.status,
        bucket: data.bucket,
        date: data.date,
        images: imagesWithUrls,
        detail: null,
      });

      this.server.emit('contamination-images', {
        serverCode: data.serverCode,
        status: data.status,
        bucket: data.bucket,
        date: data.date,
        images: imagesWithUrls,
        detail: null,
      });

      try {
        await this.mailService.sendContaminationAlertMail(data.serverCode, data.status, data.date);
      } catch (mailError) {
      }


    } catch (error) {
      console.error('Contamination 처리 중 오류:', error);
    }
  }

  async handleDisconnect(client: Socket) {
    console.log(`server disconnected: ${client.id}`);
    const code = this.statusService.setDisconnected(client.id);
    if (!code) {
      return;
    }

    const prevTimer = this.disconnectEmitTimers.get(code);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }
    const timer = setTimeout(async () => {
      await this.emitNotification(code, NotificationType.DISCONNECTED);

      try {
        const server = await this.serverService.findByCode(code);
        if (server) {
          await this.mailService.sendServerDisconnectedMail(server.name);
        } else {
        }
      } catch (mailError) {
        console.error('소켓 끊김 메일 전송 실패:', mailError);
      }

      this.disconnectEmitTimers.delete(code);
    }, 30000);
    this.disconnectEmitTimers.set(code, timer);
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
