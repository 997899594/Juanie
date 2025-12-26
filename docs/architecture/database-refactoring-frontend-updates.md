2-19
 2025-1**最后更新**:开发团队  
护者**: ---

**维则

不向后兼容"原✅ 遵循"绝- 代码已删除
所有旧✅ 不向后兼容
- 

- ❌  兼容性
###
*: 5 个文件 **总计*个
-- **视图**: 2 **: 3 个
组件
- **范围
 影响字段的引用

###废弃
- ✅ 删除已判断逻辑所有字段值的 更新 ✅的代码
-所有使用旧字段✅ 更新- 的代码
旧 API 更新所有使用

- ✅ 
### 完成的工作

## 总结
刷新令牌

--- - 自动示用户重新连接
   - 提显示令牌过期状态
   - 态监控**
  . **Git 连接状P2（中期）

1### e`

Progress.vutionializaents/Initomponrc/cb/s件：`apps/we详细进度
   - 文每个步骤的 显示ps` 表
   -zation_steliect_initia查询 `proj   - 细初始化步骤显示**
*详`

2. *tories.vuews/Reposi/src/viewebs/ 文件：`applux 状态
   - 在仓库列表中显示 F -ux 状态
  表查询 Fles` rcou`gitops_res- 从  状态查询**
   lux**F

1. P1（短期）功能

###  待实现

---

##查看 Git 同步状态  - ✅ 查看成员列表
 
   - ✅ **5. **项目成员✅ 部署方法显示

Hash
   - mmit Co   - ✅ 查看  ✅ 查看部署列表
  -署记录**
 

4. **部时推送   - ✅ SSE 实 查看初始化错误

   - ✅初始化进度✅ 查看**
   - 
3. **项目初始化实现）
要单独查看 Flux 状态（需
   - ⚠️ 查看仓库同步状态
   - ✅  - ✅ 查看仓库列表管理**
  **仓库2. it 账户连接

 断开 Gt 账户
   - ✅新的 Gi
   - ✅ 连接的 Git 账户查看已连接   - ✅ Git 连接管理**

1. **功能测试
试建议

### 

## 测` 表

---esourcestops_r 移至 `gissage` -rrorMes.fluxEriereposito `es` 表
   -ourcgitops_res移至 `ime` - yncTtSes.fluxLasri `reposito` 表
   -essourcitops_re- 移至 `git` astSyncCommories.fluxL `reposit` 表
   -ources_res至 `gitopsatus` - 移uxSyncStes.flitorirepos
   - `**的字段
4. **删除ss'`
ucce → `'sed'`ync`'sus`: ies.statrepositor  - `
 种值: 4 种值 → 2 Method`eployment
   - `d**字段值变更**个独立字段

3. tus` → 多onStaitializati   - `in`
uss` → `stattuta   - `syncS
tus`s` → `staitSyncStatu
   - `gcommitHash`a` → `ommitSh   - `gitC*
**字段名变更*
2. .*`
ionsonnectrs.gitCs.*` → `useauthAccount - `users.o径变更**
  **API 路变更

1. 
### 不向后兼容的# 兼容性说明
--

#
-库列表
- 仓tories.vue` Reposic/views/web/sr录
2. `apps/ue` - 部署记oyments.v/Deplc/viewssr/web/）
1. `apps2 个# 视图文件（态

##初始化状- vue` ogress.lizationPrents/Initiamponrc/coeb/s/w. `apps 成员同步状态
3le.vue` -MemberTabs/Projectnentcompoc//web/sr2. `appsPI
- Git 连接 Aonfig.vue` sitoryCnents/Repoeb/src/compo. `apps/w）
1### 组件文件（4 个件清单


## 更新文---
 实时推送

 SSEps` 表查询，由ization_ste_initial `project详细步骤**: 通过误消息

** - 错ror`izationEr- `initial成时间
 完` -etedAtmplonCoalizati间
- `initi开始时artedAt` - tionStnitializa化任务 ID
- `i- 初始onJobId` lizatinitia
- `i*:
**新字段*库读取
```
不从数据时推送，订阅实SSE // 进度由  '初始化失败'
onError ||atiizitialct.inprojee = e.valussag码
errorMe新代
// ogress
us.prnitStat.value = i
progress '初始化失败'error ||?.usat initSte =age.valurrorMesss as any
eationStatuizt.initialprojecatus = onst initStt
// 旧代码
ctypescrip容**:
```

**变更内.vue`ressrogializationPponents/Initeb/src/comps/w `ap件**:
-
**影响文字段
s → 多个izationStatuinitial# ###s 表字段

4. project
### `

---

``要单独查询 -->s 表，需esourceops_r gitux 状态已移至->
<!-- Fl<!-- 新代码 -</Badge>

tus) }}
luxSyncStao.fext(repluxStatusTux: {{ getF
  Fl">tatuso.fluxSyncSbled && repnasConfig?.eo.gitopf="repe v-i
<Badg 旧代码 -->ue
<!--内容**:
```v*变更单独查询

*ources` 表，需要itops_res `gux 状态已移至**说明**: Fl

 字段删除usfluxSyncStatd'`

#### faile `''syncing'`,g'`, `持不变：`'pendin- 其他值保uccess'`
'` → `'s'synced变更**:
- `**状态值
>
```
dge
</Ba) }}status(repo.ncStatusText{{ getSy
  ">y'dar'seconefault' : ess' ? 'd 'succs ===po.statunt="reBadge :varia- 新代码 -->
<ge>

<!-}}
</BadStatus) ncepo.syStatusText(rSync{ getary'">
  {t' : 'secondul 'defanced' ?s === 'sypo.syncStatu="revariant>
<Badge :<!-- 旧代码 --vue
变更内容**:
````

**itories.vueiews/Reposweb/src/vpps/
- `a
**影响文件**: → status
cStatus

#### syn 表字段ositories. rep
### 3
---
e>
```
}
</Badgs) }er.statuLabel(membync getGitSs">
  {{er.statu"memb-if=Badge v- 新代码 -->
<!-ge>

</Bad) }}
<ustatcStSyn(member.giSyncLabel  {{ getGittus">
.gitSyncStaer v-if="memb>
<Badge 旧代码 --<!--ue
`

```v
}
``_linked'led' | 'noting' | 'faiced' | 'pend: 'syn  status?mber {
face Me型
inter

// 新类ed'
}ink_l' | 'notfailedding' | 'd' | 'pens?: 'syncegitSyncStatuember {
  rface M
inte
// 旧类型``typescript*:
`

**变更内容*ue`rTable.vojectMembeonents/Pr/src/comp- `apps/web**影响文件**:
 status

tatus →itSyncS### g字段

#embers 表 project_m## 2.
---

#anual'`
'm`'gitops' |   
**新值**:  | 'api'`| 'manual'ops-git' ui' | 'gitps-旧值**: `'gito 简化

**ymentMethodlo# dep
###>
```
7) }}
</div0, slice(mitHash..comyment
  {{ deplotops'">od === 'giMethent.deploymploymenttHash && demmiloyment.co"dep<div v-if=-->

<!-- 新代码 >
 }}
</divlice(0, 7)CommitSha.sployment.git{ de  {t')">
s-giitop 'gtMethod ===ploymenment.deloy || depui'itops-=== 'gmentMethod loyoyment.depdeplmmitSha && (.gitCoentoymplf="deiv v-i旧代码 -->
<dvue
<!-- ```变更内容**:
ue`

**eployments.views/Db/src/v `apps/we*:
-影响文件*sh

**mitHaa → commmitSh
#### gitCots 表字段
. deploymen更新

### 1
## 字段--
)
```

-ery(ons.list.qunnectis.gitCotrpc.userwait  = ations.valuennectCo[])
gi>(ny[]ref<aions = t gitConnect// 新代码
consy()

t.querAccounts.lis.oauthc.usersawait trpue = ccounts.val([])
oauthA<any[]>s = refoauthAccount
const 
// 旧代码pescriptty
```**:更内容

**变yConfig.vue`positors/Rerc/component`apps/web/s文件**:
- ist`

**影响ns.litConnectiosers.g*新 API**: `u  
*st`.lintsuthAccou `users.oa*:PI* API

**旧. Git 连接 A 1I 更新

###--

## AP

-名。I 和字段配数据库重构后的新 AP新以适
前端代码已全部更
## 更新概览


---*: ✅ 完成
 
**状态*19 5-12-02 2**:*日期录

*库重构 - 前端更新记# 数据