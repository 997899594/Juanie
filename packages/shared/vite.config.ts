import { createLibConfig } from '../../configs/vite/lib.config'

export default createLibConfig({
  name: 'JuanieShared',
  external: [], // 工具库通常不需要外部依赖
  input: 'src/index.ts',
})
