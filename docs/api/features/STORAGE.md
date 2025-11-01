# 📸 Logo 上传功能使用指南

## ✅ 已完成的功能

1. **MinIO 存储服务** - S3 兼容的对象存储
2. **项目 Logo 上传** - 支持多种图片格式
3. **Logo 删除** - 自动清理存储
4. **类型验证** - 图片格式和大小验证

---

## 🚀 快速开始

### 1. 启动 MinIO

```bash
# 启动所有服务（包括 MinIO）
docker-compose up -d minio

# 验证 MinIO 运行
docker-compose ps minio

# 访问 MinIO Console
open http://localhost:9001
# 用户名: admin
# 密码: admin123456
```

### 2. 配置环境变量

```bash
# .env 文件已经配置好了
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=admin123456
```

### 3. 启动应用

```bash
bun run dev
```

---

## 📡 API 使用

### 上传项目 Logo

```typescript
// 使用 tRPC Client
const result = await client.projects.uploadLogo.mutate({
  projectId: 'project-uuid',
  file: base64Image, // Base64 编码的图片
  contentType: 'image/png',
})

console.log(result.logoUrl) // http://localhost:9000/logos/projects/xxx/logo.png
```

### 删除项目 Logo

```typescript
const result = await client.projects.deleteLogo.mutate({
  projectId: 'project-uuid',
})

console.log(result.success) // true
```

---

## 🖼️ 支持的图片格式

- ✅ JPEG / JPG
- ✅ PNG
- ✅ GIF
- ✅ WebP
- ✅ SVG

**文件大小限制**: 5MB

---

## 💻 前端示例

### React 示例

```typescript
import { useState } from 'react'
import { trpc } from './trpc'

function ProjectLogoUpload({ projectId }: { projectId: string }) {
  const [uploading, setUploading] = useState(false)
  const uploadMutation = trpc.projects.uploadLogo.useMutation()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    // 验证文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert('文件大小不能超过 5MB')
      return
    }

    setUploading(true)

    try {
      // 读取文件为 Base64
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result as string
        const base64Data = base64.split(',')[1] // 移除 data:image/png;base64, 前缀

        // 上传
        const result = await uploadMutation.mutateAsync({
          projectId,
          file: base64Data,
          contentType: file.type,
        })

        alert('上传成功！')
        console.log('Logo URL:', result.logoUrl)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      alert('上传失败：' + error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && <p>上传中...</p>}
    </div>
  )
}
```

### 显示 Logo

```typescript
function ProjectLogo({ project }: { project: Project }) {
  return (
    <div>
      {project.logoUrl ? (
        <img
          src={project.logoUrl}
          alt={project.name}
          style={{ width: 100, height: 100, objectFit: 'cover' }}
        />
      ) : (
        <div style={{ width: 100, height: 100, background: '#ccc' }}>
          {project.name[0]}
        </div>
      )}
    </div>
  )
}
```

---

## 🔧 MinIO 管理

### 访问 MinIO Console

```bash
# 打开浏览器
open http://localhost:9001

# 登录
用户名: admin
密码: admin123456
```

### 查看上传的文件

1. 登录 MinIO Console
2. 点击 "Buckets"
3. 选择 "logos" bucket
4. 浏览 `projects/` 目录

### 手动删除文件

```bash
# 使用 mc (MinIO Client)
mc alias set local http://localhost:9000 admin admin123456
mc rm --recursive local/logos/projects/project-id/
```

---

## 📊 存储结构

```
logos/
├── projects/
│   ├── project-uuid-1/
│   │   └── logo.png
│   ├── project-uuid-2/
│   │   └── logo.jpg
│   └── project-uuid-3/
│       └── logo.svg
└── organizations/
    ├── org-uuid-1/
    │   └── logo.png
    └── org-uuid-2/
        └── logo.png
```

---

## 🔒 安全性

### 公开访问

- Logo bucket 配置为公开读取
- 任何人都可以访问 Logo URL
- 适合公开展示的项目 Logo

### 私有文件

如果需要私有文件，使用预签名 URL：

```typescript
// 在 StorageService 中
const presignedUrl = await storageService.getPresignedUrl(
  'projects/xxx/logo.png',
  3600 // 1 小时有效期
)
```

---

## 🎯 性能优化

### 1. 图片压缩

建议在前端压缩图片：

```typescript
import imageCompression from 'browser-image-compression'

async function compressImage(file: File) {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
  }
  return await imageCompression(file, options)
}
```

### 2. CDN 加速

生产环境建议使用 CDN：

```typescript
// 配置 CDN 域名
const cdnUrl = process.env.CDN_URL || 'http://localhost:9000'
const logoUrl = project.logoUrl.replace('http://localhost:9000', cdnUrl)
```

### 3. 缓存策略

```typescript
// 在 MinIO 上传时设置缓存头
await minioClient.putObject(bucket, objectName, buffer, buffer.length, {
  'Content-Type': contentType,
  'Cache-Control': 'public, max-age=31536000', // 1 年
})
```

---

## 🐛 故障排查

### MinIO 连接失败

```bash
# 检查 MinIO 状态
docker-compose logs minio

# 测试连接
curl http://localhost:9000/minio/health/live

# 重启 MinIO
docker-compose restart minio
```

### 上传失败

1. **检查文件大小**: 不超过 5MB
2. **检查文件类型**: 必须是图片
3. **检查 MinIO 状态**: 确保服务运行
4. **检查权限**: 确保用户有项目权限

### Bucket 不存在

应用启动时会自动创建 `logos` bucket，如果没有：

```bash
# 手动创建
mc alias set local http://localhost:9000 admin admin123456
mc mb local/logos
mc policy set public local/logos
```

---

## 📈 监控

### 查看存储使用情况

```bash
# MinIO Console
open http://localhost:9001

# 或使用 mc
mc du local/logos
```

### 查看上传统计

在 MinIO Console 中：
1. 点击 "Monitoring"
2. 查看 "Bandwidth" 和 "Requests"

---

## 🚀 下一步

### 1. 添加组织 Logo

```typescript
// 已经实现了 StorageService.uploadOrganizationLogo
// 只需要在 OrganizationsRouter 中添加端点
```

### 2. 添加图片裁剪

```typescript
// 使用 sharp 库
import sharp from 'sharp'

const resized = await sharp(buffer)
  .resize(512, 512, { fit: 'cover' })
  .toBuffer()
```

### 3. 添加图片优化

```typescript
// 自动转换为 WebP
const optimized = await sharp(buffer)
  .webp({ quality: 80 })
  .toBuffer()
```

---

## 📚 相关文档

- [MinIO 文档](https://min.io/docs/minio/linux/index.html)
- [MinIO SDK](https://min.io/docs/minio/linux/developers/javascript/minio-javascript.html)
- [S3 API 兼容性](https://min.io/docs/minio/linux/developers/s3-compatible-api.html)

---

## ✅ 测试清单

- [ ] MinIO 服务运行正常
- [ ] 可以访问 MinIO Console
- [ ] 上传 PNG 图片成功
- [ ] 上传 JPG 图片成功
- [ ] 上传 SVG 图片成功
- [ ] 文件大小验证工作
- [ ] 文件类型验证工作
- [ ] 删除 Logo 成功
- [ ] Logo URL 可以访问
- [ ] 权限检查工作正常

---

需要帮助？查看日志：
```bash
docker-compose logs -f minio
```
