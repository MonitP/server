import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;

  constructor(private readonly configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT') || 'localhost',
      port: parseInt(this.configService.get('MINIO_PORT') || '9000'),
      useSSL: this.configService.get('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY') || 'minioadmin',
      secretKey: this.configService.get('MINIO_SECRET_KEY') || 'minioadmin',
    });
  }

  private removeServerCodeSuffix(serverCode: string): string {
    return serverCode.replace(/-00$/, '');
  }

  async getImageUrl(bucket: string, serverCode: string, date: string, imagePath: string): Promise<string | null> {
    try {
      const cleanServerCode = this.removeServerCodeSuffix(serverCode);

      let objectName;
      if (imagePath.startsWith(`${cleanServerCode}/${date}/`)) {
        objectName = imagePath;
      } else {
        objectName = `${cleanServerCode}/${date}/${imagePath}`;
      }



      const url = await this.minioClient.presignedGetObject(bucket, objectName, 7 * 24 * 60 * 60);

      return url;
    } catch (error) {
      this.logger.error(`MinIO URL 생성 실패: ${error.message}`);
      return null;
    }
  }

  async listImages(bucket: string, serverCode: string, date: string, status?: string): Promise<string[]> {
    try {
      const cleanServerCode = this.removeServerCodeSuffix(serverCode);
      let prefix = `${cleanServerCode}/${date}/`;

      if (status) {
        prefix = `${cleanServerCode}/${date}/${status}/`;
      }

      const allObjects = await this.minioClient.listObjects(bucket, '', true);
      const allObjectNames: string[] = [];
      for await (const obj of allObjects) {
        allObjectNames.push(obj.name);
      }


      const objects = await this.minioClient.listObjects(bucket, prefix, true);
      const imageList: string[] = [];

      for await (const obj of objects) {
        if (/\.(jpg|jpeg|png|gif)$/i.test(obj.name)) {
          imageList.push(obj.name);
        }
      }


      return imageList;
    } catch (error) {
      this.logger.error(`MinIO 이미지 목록 조회 실패: ${error.message}`);
      return [];
    }
  }

  async bucketExists(bucket: string): Promise<boolean> {
    try {
      return await this.minioClient.bucketExists(bucket);
    } catch (error) {
      this.logger.error(`버킷 존재 확인 실패: ${error.message}`);
      return false;
    }
  }


  async testConnection(): Promise<boolean> {
    try {
      await this.minioClient.listBuckets();
      this.logger.log('MinIO 연결 성공');
      return true;
    } catch (error) {
      this.logger.error(`MinIO 연결 실패: ${error.message}`);
      return false;
    }
  }

  async listBuckets(): Promise<any[]> {
    try {
      const buckets = await this.minioClient.listBuckets();
      return buckets.map(bucket => ({
        name: bucket.name,
        creationDate: bucket.creationDate
      }));
    } catch (error) {
      this.logger.error(`버킷 목록 조회 실패: ${error.message}`);
      return [];
    }
  }

  async listAllObjects(bucket: string, prefix?: string): Promise<any[]> {
    try {
      const objects = await this.minioClient.listObjects(bucket, prefix || '', true);
      const objectList: any[] = [];
      
      for await (const obj of objects) {
        objectList.push({
          name: obj.name,
          size: obj.size,
          lastModified: obj.lastModified,
          etag: obj.etag
        });
      }
      
      return objectList;
    } catch (error) {
      this.logger.error(`객체 목록 조회 실패: ${error.message}`);
      return [];
    }
  }
} 