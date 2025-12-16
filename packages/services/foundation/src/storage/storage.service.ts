import { Logger } from '@juanie/core/logger'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Client } from 'minio'

@Injectable()
export class StorageService {
  private minioClient: Client
  private bucketName = 'juanie'

  constructor(
    private config: ConfigService,
    private readonly logger: Logger,
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

  // 确保 bucket 存在
  private async ensureBucketExists() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName)
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1')
        this.logger.info(`✅ Created MinIO bucket: ${this.bucketName}`)

        // 设置公开访问策略（用于 Logo）
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
      // 忽略 bucket 已存在的错误
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

  // 上传文件
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

      // 返回公开访问 URL
      const endpoint = this.config.get('MINIO_ENDPOINT') || 'localhost'
      const port = this.config.get('MINIO_PORT') || '9000'
      const protocol = this.config.get('MINIO_USE_SSL') === 'true' ? 'https' : 'http'

      return `${protocol}://${endpoint}:${port}/${this.bucketName}/${objectName}`
    } catch (error) {
      this.logger.error('MinIO upload error', error)
      throw new Error('Failed to upload file')
    }
  }

  // 上传项目 Logo
  async uploadProjectLogo(projectId: string, buffer: Buffer, fileType: string): Promise<string> {
    const extension = this.getExtension(fileType)
    const objectName = `projects/${projectId}/logo${extension}`

    return await this.uploadFile(objectName, buffer, fileType, {
      'x-amz-meta-project-id': projectId,
      'x-amz-meta-upload-date': new Date().toISOString(),
    })
  }

  // 上传组织 Logo
  async uploadOrganizationLogo(orgId: string, buffer: Buffer, fileType: string): Promise<string> {
    const extension = this.getExtension(fileType)
    const objectName = `organizations/${orgId}/logo${extension}`

    return await this.uploadFile(objectName, buffer, fileType, {
      'x-amz-meta-organization-id': orgId,
      'x-amz-meta-upload-date': new Date().toISOString(),
    })
  }

  // 删除文件
  async deleteFile(objectName: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, objectName)
    } catch (error) {
      this.logger.error('MinIO delete error', error)
      throw new Error('Failed to delete file')
    }
  }

  // 删除项目 Logo
  async deleteProjectLogo(projectId: string): Promise<void> {
    // 列出该项目的所有 logo 文件
    const prefix = `projects/${projectId}/logo`
    const objectsList: string[] = []

    const stream = this.minioClient.listObjects(this.bucketName, prefix, true)

    // 使用 Promise 包装来处理 stream
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name) {
          objectsList.push(obj.name)
        }
      })
      stream.on('end', () => resolve())
      stream.on('error', (err) => reject(err))
    })

    // 删除所有找到的文件
    for (const objName of objectsList) {
      await this.deleteFile(objName)
    }
  }

  // 获取预签名 URL（用于临时访问私有文件）
  async getPresignedUrl(objectName: string, expiry = 3600): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(this.bucketName, objectName, expiry)
    } catch (error) {
      this.logger.error('MinIO presigned URL error', error)
      throw new Error('Failed to generate presigned URL')
    }
  }

  // 检查文件是否存在
  async fileExists(objectName: string): Promise<boolean> {
    try {
      await this.minioClient.statObject(this.bucketName, objectName)
      return true
    } catch (_) {
      return false
    }
  }

  // 获取文件扩展名
  private getExtension(contentType: string): string {
    const mimeTypes: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    }
    return mimeTypes[contentType] || '.png'
  }

  // 验证图片类型
  isValidImageType(contentType: string): boolean {
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ]
    return validTypes.includes(contentType)
  }

  // 验证文件大小（默认 5MB）
  isValidFileSize(size: number, maxSize = 5 * 1024 * 1024): boolean {
    return size <= maxSize
  }
}
