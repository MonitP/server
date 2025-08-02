import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContaminationData } from '../entities/contamination.entity';

@Injectable()
export class ContaminationService {
  private readonly logger = new Logger(ContaminationService.name);

  constructor(
    @InjectRepository(ContaminationData)
    private readonly contaminationRepository: Repository<ContaminationData>,
  ) {}

  async saveContaminationData(data: {
    serverCode: string;
    status: string;
    bucket: string;
    date: string;
    images: Array<{ path: string; url: string | null }>;
    detail?: any;
  }) {
    try {
      // 기존 데이터의 detail 필드를 null로 업데이트 (JSON 파싱 오류 해결)
      await this.contaminationRepository
        .createQueryBuilder()
        .update()
        .set({ detail: () => 'NULL' })
        .where('detail IS NOT NULL')
        .execute();

      // 기존 데이터 확인
      const existingData = await this.contaminationRepository.findOne({
        where: {
          serverCode: data.serverCode,
          bucket: data.bucket,
          date: data.date,
        },
      });

      if (existingData) {
        // 기존 데이터 업데이트
        await this.contaminationRepository.update(
          { id: existingData.id },
          {
            status: data.status,
            images: data.images,
            detail: () => 'NULL', // JSON 파싱 제거
          }
        );
      } else {
        // 새 데이터 저장
        await this.contaminationRepository.save({
          serverCode: data.serverCode,
          status: data.status,
          bucket: data.bucket,
          date: data.date,
          images: data.images,
          detail: () => 'NULL', // JSON 파싱 제거
        });
      }
    } catch (error) {
      console.error('Contamination 데이터 저장 실패:', error);
      throw error;
    }
  }

  async getAllContaminationData(): Promise<ContaminationData[]> {
    try {
      return await this.contaminationRepository.find({
        order: {
          createdAt: 'DESC',
        },
      });
    } catch (error) {
      this.logger.error(`Contamination 데이터 조회 실패: ${error.message}`);
      return [];
    }
  }

  async getContaminationDataByServer(serverCode: string): Promise<ContaminationData[]> {
    try {
      return await this.contaminationRepository.find({
        where: { serverCode },
        order: {
          createdAt: 'DESC',
        },
      });
    } catch (error) {
      this.logger.error(`서버별 Contamination 데이터 조회 실패: ${error.message}`);
      return [];
    }
  }

  async deleteOldData(daysOld: number = 7): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      await this.contaminationRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :cutoffDate', { cutoffDate })
        .execute();

      this.logger.log(`${daysOld}일 이전의 contamination 데이터 삭제 완료`);
    } catch (error) {
      this.logger.error(`오래된 contamination 데이터 삭제 실패: ${error.message}`);
    }
  }
} 