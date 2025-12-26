import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Client } from 'minio'
import { PinoLogger } from 'nestjs-pino'
import { BaseError } from '../errors'

/**
 * 存储错误类
 */
export class StorageError extends BaseError {
  constructor(operation: string, reason: string, retryable = false) {
    super(`Storage operation ${operation} failed: ${reason}`, 'STORAGE_ERROR', 500, retryable, {
      operation,
      reason,
    })
  }

  getUserMessage(): string {
    return `存储操作失败: ${this.context?.reason || '未知错误'}`
  }
}

/**
 * 存储服务 (Core 层基础设施)
 * 使用 MinIO 作为对象存储
 */
@Injectable()
export class StorageService {
  private minioClient: Client
  private bucketName = 'juanie'

  constructor(
    private config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(StorageService.name)
    this.minioClient = new Client({
      endPoint: config.get('MINIO_ENDPOINT') || 'localhost',
      port: Number(config.get('MINIO_PORT')) || 9000,
      useSSL: config.get('MINIO_USE_SSL') === 'true',
      accessKey: config.get('MINIO_ACCESS_KEY') || 'admin',
      secretKey: config.get('MINIO_SECRET_KEY') || 'admin123456',
    })

    this.ensureBucketExists()
  }

  private async ensureBucketExists() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName)
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1')
        this.logger.info(`✅ Created MinIO bucket: ${this.bucketName}`)

        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        }
        await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy))
      } else {
        this.logger.info(`✅ MinIO bucket already exists: ${this.bucketName}`)
      }
    } catch (error) {
      const minioError = error as { code?: string }
      if (
        minioError.code === 'BucketAlreadyOwnedByYou' ||
        minioError.code === 'BucketAlreadyExists'
      ) {
        this.logger.info(`✅ MinIO bucket already exists: ${this.bucketName}`)
      } else {
        this.logger.error('MinIO bucket setup error', error)
      }
    }
  }

  async uploadFile(
    objectName: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    try {
      await this.minioClient.putObject(this.bucketName, objectName, buffer, buffer.length, {
        'Content-Type': contentType,
        ...metadata,
      })

      const endpoint = this.config.get('MINIO_ENDPOINT') || 'localhost'
      const port = this.config.get('MINIO_PORT') || '9000'
      const protocol = this.config.get('MINIO_USE_SSL') === 'true' ? 'https' : 'http'

      return `${protocol}://${endpoint}:${port}/${this.bucketName}/${objectName}`
    } catch (error) {
      this.logger.error('MinIO upload error', error)
      throw new StorageError('upload', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  async deleteFile(objectName: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, objectName)
    } catch (error) {
      this.logger.error('MinIO delete error', error)
      throw new StorageError('delete', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  async getPresignedUrl(objectName: string, expiry = 3600): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(this.bucketName, objectName, expiry)
    } catch (error) {
      this.logger.error('MinIO presigned URL error', error)
      throw new StorageError(
        'generatePresignedUrl',
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }

  async fileExists(objectName: string): Promise<boolean> {
    try {
      await this.minioClient.statObject(this.bucketName, objectName)
      return true
    } catch (_) {
      return false
    }
  }

  // ========================================
  // 项目 Logo 相关方法
  // ========================================

  /**
   * 验证图片类型
   */
  isValidImageType(contentType: string): boolean {
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ]
    return validTypes.includes(contentType.toLowerCase())
  }

  /**
   * 验证文件大小（最大 5MB）
   */
  isValidFileSize(size: number, maxSize = 5 * 1024 * 1024): boolean {
    return size <= maxSize
  }

  /**
   * 上传项目 Logo
   */
  async uploadProjectLogo(projectId: string, buffer: Buffer, contentType: string): Promise<string> {
    const ext = contentType.split('/')[1] || 'png'
    const objectName = `projects/${projectId}/logo.${ext}`
    return await this.uploadFile(objectName, buffer, contentType)
  }

  /**
   * 删除项目 Logo
   */
  async deleteProjectLogo(projectId: string): Promise<void> {
    // 尝试删除所有可能的扩展名
    const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
    for (const ext of extensions) {
      const objectName = `projects/${projectId}/logo.${ext}`
      try {
        await this.deleteFile(objectName)
      } catch (_) {
        // 忽略不存在的文件
      }
    }
  }
}
