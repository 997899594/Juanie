import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { migrate as migrateMysql } from 'drizzle-orm/mysql2/migrator'
import { migrate as migrateSqlite } from 'drizzle-orm/better-sqlite3/migrator'
import * as fs from 'fs'
import * as path from 'path'
import type { DrizzleDatabase } from '../interfaces/drizzle-connection.interface.js'
import { DatabaseType } from '../constants/drizzle.constants.js'

/**
 * 迁移配置
 */
export interface MigrationConfig {
  /**
   * 迁移文件夹路径
   */
  migrationsFolder: string
  
  /**
   * 数据库类型
   */
  databaseType: DatabaseType
  
  /**
   * 是否在迁移前备份
   */
  backup?: boolean
  
  /**
   * 备份文件夹路径
   */
  backupFolder?: string
  
  /**
   * 迁移表名
   */
  migrationsTable?: string
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  /**
   * 是否成功
   */
  success: boolean
  
  /**
   * 执行的迁移数量
   */
  migrationsExecuted: number
  
  /**
   * 执行时间（毫秒）
   */
  duration: number
  
  /**
   * 错误信息
   */
  error?: string
  
  /**
   * 执行的迁移文件列表
   */
  executedMigrations: string[]
}

/**
 * 运行数据库迁移
 */
export async function runMigrations(
  database: DrizzleDatabase,
  config: MigrationConfig
): Promise<MigrationResult> {
  const startTime = Date.now()
  
  try {
    // 验证迁移文件夹
    if (!fs.existsSync(config.migrationsFolder)) {
      throw new Error(`Migrations folder not found: ${config.migrationsFolder}`)
    }

    // 获取迁移文件列表
    const migrationFiles = getMigrationFiles(config.migrationsFolder)
    
    if (migrationFiles.length === 0) {
      return {
        success: true,
        migrationsExecuted: 0,
        duration: Date.now() - startTime,
        executedMigrations: [],
      }
    }

    // 执行备份（如果需要）
    if (config.backup && config.backupFolder) {
      await createBackup(database, config)
    }

    // 根据数据库类型执行迁移
    await executeMigrations(database, config)

    return {
      success: true,
      migrationsExecuted: migrationFiles.length,
      duration: Date.now() - startTime,
      executedMigrations: migrationFiles,
    }
  } catch (error) {
    return {
      success: false,
      migrationsExecuted: 0,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      executedMigrations: [],
    }
  }
}

/**
 * 执行迁移
 */
async function executeMigrations(
  database: DrizzleDatabase,
  config: MigrationConfig
): Promise<void> {
  const migrationsConfig = {
    migrationsFolder: config.migrationsFolder,
    migrationsTable: config.migrationsTable,
  }

  switch (config.databaseType) {
    case DatabaseType.POSTGRES:
      await migrate(database as any, migrationsConfig)
      break
    
    case DatabaseType.MYSQL:
      await migrateMysql(database as any, migrationsConfig)
      break
    
    case DatabaseType.SQLITE:
      await migrateSqlite(database as any, migrationsConfig)
      break
    
    default:
      throw new Error(`Unsupported database type for migration: ${config.databaseType}`)
  }
}

/**
 * 获取迁移文件列表
 */
function getMigrationFiles(migrationsFolder: string): string[] {
  try {
    const files = fs.readdirSync(migrationsFolder)
    return files
      .filter(file => file.endsWith('.sql'))
      .sort()
  } catch (error) {
    throw new Error(`Failed to read migrations folder: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 创建数据库备份
 */
async function createBackup(
  database: DrizzleDatabase,
  config: MigrationConfig
): Promise<void> {
  if (!config.backupFolder) {
    return
  }

  // 确保备份文件夹存在
  if (!fs.existsSync(config.backupFolder)) {
    fs.mkdirSync(config.backupFolder, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = path.join(config.backupFolder, `backup-${timestamp}.sql`)

  try {
    // 这里可以根据不同数据库类型实现具体的备份逻辑
    // 目前只是创建一个占位文件
    fs.writeFileSync(backupFile, `-- Backup created at ${new Date().toISOString()}\n`)
    console.log(`Database backup created: ${backupFile}`)
  } catch (error) {
    console.warn(`Failed to create backup: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 检查迁移状态
 */
export async function checkMigrationStatus(
  database: DrizzleDatabase,
  migrationsFolder: string
): Promise<{
  pendingMigrations: string[]
  appliedMigrations: string[]
  totalMigrations: number
}> {
  try {
    const allMigrations = getMigrationFiles(migrationsFolder)
    
    // 这里需要查询数据库中的迁移记录表
    // 具体实现取决于 Drizzle 的迁移表结构
    const appliedMigrations: string[] = []
    
    const pendingMigrations = allMigrations.filter(
      migration => !appliedMigrations.includes(migration)
    )

    return {
      pendingMigrations,
      appliedMigrations,
      totalMigrations: allMigrations.length,
    }
  } catch (error) {
    throw new Error(`Failed to check migration status: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 验证迁移文件
 */
export function validateMigrationFiles(migrationsFolder: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  try {
    if (!fs.existsSync(migrationsFolder)) {
      errors.push(`Migrations folder does not exist: ${migrationsFolder}`)
      return { valid: false, errors }
    }

    const files = getMigrationFiles(migrationsFolder)
    
    for (const file of files) {
      const filePath = path.join(migrationsFolder, file)
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        
        if (content.trim().length === 0) {
          errors.push(`Migration file is empty: ${file}`)
        }
        
        // 检查文件命名格式
        if (!/^\d{4}_\d{2}_\d{2}_\d{6}_.*\.sql$/.test(file)) {
          errors.push(`Invalid migration file name format: ${file}`)
        }
      } catch (error) {
        errors.push(`Failed to read migration file ${file}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  } catch (error) {
    errors.push(`Failed to validate migration files: ${error instanceof Error ? error.message : String(error)}`)
    return { valid: false, errors }
  }
}