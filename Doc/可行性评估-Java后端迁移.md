# 可行性评估：后端迁移至 Java 21 / Spring Boot 3.5 / Spring Cloud Alibaba（v4.3 需求落地版）

> **2026-11-13 实证复核说明**：本文是迁移可行性与目标设计，不是 Java 平台已实现或已验收的证明。§15 记录本轮源码抽查、修订与未完成项，并优先于历史摘要中的“✅ 可行/已实现/完全等价/自动回滚”等无运行证据的表述。历史标注的 2026-11-14 晚于本次复核日期，保留原文但不作为本次证据时间。

> **版本**：**v4.3.4**（2026-11-14 追加：**11 项架构复核与修订同步**——注册接口定名 `PluginRegistry`、**插件安装/更新自动结构同步**、生成物覆盖策略与三级泛型基类、复杂查询已由前端自定义/预定义查询覆盖、`Parameter` 运行态参数中心、`ViewProfile` 契约复核、操作符双向映射、认证三插件（`sso`/`auth-third`/`usercenter`）、**在线（默认）/离线双模升级**、**默认 SQLite + 自动建库建表播种**、**异步读写对照**；新增 D-37~D-41 与 SCHEMA/INIT/PARAM/UP/ASYNC/AUTH-P 验收；工程量 90→**93**，MVP 53→**55**）｜v4.3.3（AI 就绪 + Spring AI Alibaba 评估；89→90）｜v4.3.2（分库分表/雪花 ID/读写分离；88→89）｜v4.3.1（§9.6 核实：零代码展现 7 项已全部交付，K9 7.0→4.5，总量 91→88）｜v4.3（9 项需求落地：前端只保 ArcoVue / 调度自持 + AntJob 平台能力 + XXL-Job 协议插件 / 存储插件（MinIO·OSS）/ Flowable + flowgram.ai / NewLife.Core 语义基准 / 菜单自动生成 / CubeDemo 全插件化 / 数据库收敛 6 种 / 两级缓存）｜v4.2（9 项未决问题收口 + AntJob 试点 + RabbitMQ/RocketMQ + dev/test/prod 环境）｜v4.1（范围收敛）｜v4.0（15 项决策 + DB/MQ 配置化 + L2 硬化 + 日志双落点）｜v3.0（零代码展现层 + 拆分就绪 + 可观测内建）｜v2.1（非 SaaS 许可重判 + 热插拔纠偏）｜v2.0（审计修订）｜v1.0（初版）
> **评估对象**：NewLife.Cube（WebAPI 主线）、NewLife.Cube.ArcoVue（ArcoVue 皮肤 + `packages/cube` 前端契约层）、NewLife.XCode（数据中间件）、NewLife.AI（AI 能力层）
> **评估命题**：保留前端不变，将后端改写为 Java 技术栈；同时满足**插件化 / 微内核热插拔 / Model.xml 单一事实源 / 业务仅引用基础组件**四项平台化要求
> **技术基线**：JDK 21 LTS + Spring Boot 3.5.x + Spring Cloud Alibaba 2025.0.0.0
> **许可基线**：**非 SaaS**（私有化部署 / 内部部署），按「是否向客户分发二进制」判定（§6.5）
> **评估方法**：全源码 + 全 Doc 情报分析（REA 路由判定：三仓库均具备完整源码，走"普通仓库分析"路径，不做反编译）
> **配套技术篇**：[Java迁移-微内核插件化架构设计.md](Java迁移-微内核插件化架构设计.md)（**v4.3.4**：插件颗粒度热插拔 + 非 SaaS 许可矩阵 + 调度自持 + 存储插件 + Flowable 工作流 + 菜单自动生成 + 两级缓存 + **自动结构同步/自动初始化** + **参数中心** + **在线/离线双模升级** + **异步读写**）

> **术语说明**：需求中提到的 `NewLife.Arco` 在本工作区不存在独立仓库，实际对应 **`NewLife.Cube.ArcoVue`**（Arco Design Vue 皮肤 + 共用契约包 `packages/cube`）。本评估按此外延执行。

---

## 1. 结论摘要

| 维度 | 结论 |
|---|---|
| **项目性质** | ✅ **全新项目**：平台重建 + `NewLife.Cube` 自身 + `CubeDemo`；**不涉及任何下游 .NET 系统** |
| **前端零改动** | ✅ 可行（**仅 ArcoVue** 保持；其余 8 套 SPA 与 7 套 MVC 主题不迁移、不验收） |
| **契约可验证性** | 有 5 份 OpenAPI 静态快照；运行期样本库仍需采集并与版本、配置和测试数据绑定，不能仅凭快照断言等价 |
| **热插拔** | 目标为插件包颗粒度；L2 生产可用性须先通过隔离发布、数据兼容、节点收敛与故障注入门禁 |
| **零代码展现** | ✅ **7 项已全部交付**（七视图 / 查询 / 条件填色 / 多级分组 / 洞察面板 / 工作台 / 自动化）；Java 侧为**契约复刻**（填色与分组在前端求值，后端零引擎） |
| **水平扩展** | ✅ S/M/L 三档同一二进制；**MQ = RabbitMQ 4.4.x / RocketMQ 5.5.x**（可按客户配置） |
| **数据库** | ✅ 配置式切换（`DbProvider` SPI + 驱动外置）；**只做 6 种**：SQLite / MySQL / PostgreSQL / 金仓 / 海量 / 达梦；**默认 SQLite 单文件库** |
| **结构同步** | 目标为按 `Model.xml` 自动比对并执行允许的 DDL；六库的事务性、权限、锁表和恢复能力均需实测。破坏性变更须人工审批，不承诺数据库自动回滚 |
| **运行初始化** | 目标为首次运行按权限建库、建表和播种；需步骤级记账、重启恢复与并发互斥，单凭 `cube_schema_history` checksum 不能保证幂等 |
| **参数中心** | ✅ `Parameter` 升级为运行态参数中心：系统配置 / LOV 值集 / 共享预定义查询 / 自定义字典（`Global/Tenant/Role/User` 四级作用域），布局类配置仍归 `ViewProfile` |
| **升级** | 目标为在线/离线共用校验与审计；只有旧版兼容当前数据时才自动回切，否则停写、告警并按演练后的计划恢复 |
| **异步读写** | 写侧拟借鉴 `EntityQueue`；可丢数据与关键数据分别使用内存队列和同事务 outbox，`afterCommit` 不保证持久；读侧虚拟线程 + JDBC 的效果待实测 |
| **认证插件化** | ✅ 内核只留最小认证 + 授权判定；`sso`（OAuth2 客户端/服务端）/ `auth-third`（短信邮件码 + TOTP MFA）/ `usercenter`（用户中心）三个系统插件承载其余能力 |
| **分库分表 / 雪花 ID** | ✅ 按 XCode 语义同步迁移：`ConnName` 跨库（无跨库事务）、`TimeShardPolicy` 全语义、`DataScale` 两义、雪花 **41/10/12 + epoch 1970** 兼容、读写分离四条件；**历史分片命名不可改** |
| **调度** | ✅ 内核 K15 自持（**零外部第三方调度组件**）+ AntJob 移植为平台能力（MIT）+ XXL-Job **协议**插件（不内嵌 GPL） |
| **文件存储** | ✅ `storage` 系统插件：本地 / NAS / **S3 兼容（MinIO、阿里云 OSS、腾讯 COS、七牛 Kodo）** |
| **缓存** | ✅ 两级：L1 Caffeine + **L2 Redis**（唯一分布式实现；单机可只开 L1） |
| **工作流** | ✅ **Flowable 7.x + flowgram.ai**（受限节点集 + 服务端编译 BPMN；现有 Workflow 实体按 Flowable 升级） |
| **AI 就绪** | 目标从 P1 建立工具和 SSE 契约基座；Spring AI 及 Alibaba 为候选，能否替代仅可按范围内的具体协议、权限和功能逐项实测后判定 |
| **可观测** | ✅ 内建 + SkyWalking 可插拔（未配置不记 Trace，但 `traceId` 仍生成）+ 日志**双落点**（DB/硬盘，保留期与尺寸全配置化） |
| **部署形态** | ✅ **仅内嵌 Tomcat**（明确不做 war 外置容器）；配置按 **dev / test / prod** 三环境区分 |
| **验证样本** | ✅ `CubeDemo`（**插件示范集**）+ `NewLife.AntJob`（作为**平台调度能力**迁移，不再只是试点） |
| **工程量** | **≈ 93 人月**（含 `cube-migrate` MVP、调度/存储/工作流/菜单/缓存/分片/AI 就绪/**结构同步**/**参数中心**/**双模升级**/**异步写**增量）；**MVP 口径 ≈ 55 人月** |
| **团队** | 6~7 人 × 14~16 个月（AI 辅助 12~13 个月） |
| **推荐方案** | **方案 E：契约优先 + 微内核平台化渐进替换** |

**一句话结论**：v4.3.4 在 v4.3.3 基础上把"**平台该自动的事全部自动化**"——插件装上就自动建表播种（对齐 XCode 反向工程 + `InitData`）、有网就在线升级（离线兜底）、运行态参数集中到 `Parameter`、高频写走异步批写；AI 仍按 v4.3.3 的三条硬约束（元数据即工具 / 权限即工具边界 / 契约即基线）从 **P1** 起生效，AI 层选型保持 **Spring AI 1.1.2 + Spring AI Alibaba 1.1.2.2（均 Apache-2.0）可替代 NewLife.AI**。工程量 90 → **93 人月**（+1.0 结构同步、+0.5 参数中心、+0.5 在线升级、+0.5 异步写、+0.5 认证插件拆分），MVP 53 → **55**。可以进入 P0。

## 1.1 v4.1 → v4.2 收口（9 项未决问题回复）

| # | 回复 | 影响与修订 |
|---|---|---|
| 1 | **冻结 .NET 侧平台功能变更** | ✅ 写入约束 C5：P0 起 .NET 平台只修 P0 级缺陷，不再演进；需预留少量 .NET 维护人力做"冻结期兜底" |
| 2 | **全新项目，不考虑下游 .NET 系统** | ✅ §2.3 重写：删除下游迁移相关内容；**R25 撤销**；契约样本库定位由"迁移差分预言机"改为"**契约回归基线**"（永久防退化） |
| 3 | **选 `NewLife.AntJob` 做试点验证** | ✅ 新增 §2.4：AntJob（98 个 .cs / 12,469 行，含 Server/Agent/Web/Data/Extensions）作为**真实业务系统试点**，+1.5 人月（**v4.3 升级为平台调度能力**，见 §1.6-2） |
| 4 | **`cube-migrate` MVP 本次交付** | ✅ 由"可选 +1"转**正式交付 +1**（用途改为：**迁移平台自身 39 个控制器 + CubeDemo**，不是给下游用） |
| 5 | **主用 RabbitMQ + RocketMQ 最新稳定版** | ✅ MQ 实现收敛为 **RabbitMQ 4.4.x + RocketMQ 5.5.x**；Kafka/ActiveMQ 仅保留 SPI 不实现（省 ~0.5） |
| 6 | **不做 war 外置容器部署** | ✅ 仅内嵌 Tomcat；删除 war profile（省 ~0.5） |
| 7 | **授权到期宽限期 30 天** | ✅ `license` 插件：到期后 30 天内全功能 + 每日告警，之后转只读 |
| 8 | **审计保留期/尺寸/提供者全部配置化** | ✅ 架构篇 §13.2.2 补全配置键（`sink`/`retention-days`/`max-bytes`/`backups`/`table`/`datasource`） |
| 9 | **用 dev/test/prod 三环境区分（不区分交付态/自用态）** | ✅ 删除"交付态/自用态双档案"，改为 Spring Profiles：`dev`/`test`/`prod` |

> **口径确认**：`cube-migrate` 的用途已从"下游迁移工具"改为"**平台自身迁移加速器**"——用它把 `NewLife.Cube` 的 39 个 Area 控制器里的 `ListFields/FormFields/SearchFields` 静态配置自动转成 `cube:Presentation` DSL，避免手工重写 6 万行里最琐碎的声明部分。

## 1.2 v3.0 → v4.0 决策落地（15 项未决问题回复）

| # | 回复 | 判定 | 修订内容 |
|---|---|---|---|
| 1 | 私有化交付为主 + 大量自用系统 | ✅ | 许可按"分发"判定；~~双配置档案~~ → **v4.2 已改为 dev/test/prod 三环境 Profile**（D-24） |
| 2 | 后期升级 JDK 25 + Boot 4.x | ✅ | 架构篇 §0.6 升级路径 + CI 双目标编译（`-Pboot4`） |
| 3 | ~~下游所有系统同步迁移~~ → **本次不做全量迁移** | ✅ **范围收敛** | 改为 §2.3「范围边界」：仅平台 + CubeDemo；迁移工具链降级为可选（+1 人月，不计入基线） |
| 4 | **不保留 .NET 版本** | 🟠 边界明确 | 边界 = **平台源码归档、不再发 .NET 新版本**；已部署下游继续运行既有二进制（只读维护）。契约样本库永久化；CubeDemo 全量验收兜底 |
| 5 | 信创中间件不验收，用轻量商业应用服务器 | ✅ 省工 | 默认内嵌 Tomcat（Apache-2.0）；§9.2 重写 |
| 6 | Workflow / AI 纳入首期 | ✅ | 不裁剪；Workflow 提到 P3、AI 在 P4 |
| 7 | L2 热升级生产启用 | 🟠 需硬化 | 架构篇 §7.5.1 H1~H8（双版本并行/灰度/哨兵/自检） |
| 8 | 数据库由项目交付，**配置式替换** | ✅ | 架构篇 §5.11 `DbProvider` SPI + 驱动外置 + 方言矩阵 |
| 9 | 授权到期降级只读 | ✅ | 架构篇 §7.9 只读语义 + `licenseState` 增量字段 |
| 10 | 客户集群用 MQ，**可配置** | ✅ | 架构篇 §5.12 `EventTransport` SPI（5 种 provider） |
| 11 | 零代码优先级按 P2/P3 | ✅ | 切片不变 |
| 12 | 自助配置界面参考 ArcoVue 方案 | ✅ | 架构篇 §12.2：11 类对象 + 端点清单（前端已依赖，必须实现） |
| 13 | （L 档拆分场景待明确） | ⏸ | K14 仅做接口预留与门禁，实际不拆（省 1~1.5 人月） |
| 14 | 日志/审计落客户 DB 或硬盘 | ✅ | 架构篇 §13.2.2 双落点（自研异步批量写入，不用 DBAppender） |
| 15 | APM 用 SkyWalking，可插拔，未配置不记 Trace | ✅ | 架构篇 §13.2.1：**`traceId` 生成与 Span 上报解耦** |

> **两条必须强调的连带影响**
> 1. **范围已收敛为全新项目**：只做平台重建 + `NewLife.Cube` 自身 + `CubeDemo` + AntJob 迁移，**不涉及任何下游 .NET 系统**。工程量 **≈ 89 人月**（v4.3.2 口径），与下游系统数量无关（R25 已撤销）。
> 2. **第 4 条取消了长期并行**：切换后只能回滚到"上一个 Java 版本"。因此 P0 的契约样本库不是一次性交付物，而是要长期跑在 CI 上的**防退化网**。

## 1.3 v2.1 → v3.0 修订（三项补充要求）

| # | 业务方要求 | 判定 | 修订内容 |
|---|---|---|---|
| **C1** | 零代码能力必须保留：**多维视图、自定义查询、填色、分组、自动化、页面洞察面板、首页工作台/看板** | ✅ 已实现（v4.3.1 复核） | ①**核实现状**：7 项在 .NET + ArcoVue **全部已交付**（详见 §9.6）；②Java 侧定位为**契约复刻**：配置容器 + 筛选下推 + Widget 聚合 + 自动化执行器；③~~§4.7 零代码 DSL~~、~~RuleEvaluator/GroupEngine~~ **降级/取消**（填色与分组在前端求值）；④K9 7.0 → 4.5 |
| **C2** | 微内核设计时就要考虑水平扩展与微服务化；小项目单体简单部署，大项目按模块拆分 | ✅ 可达成 | 重写 §9.3：引入 **S/M/L 三档部署形态（同一二进制）+ 10 条拆分就绪规则 + 卫星服务拆分优先级**；新增内核 `cube-kernel-cluster`（本地/远程双派发）；明确禁止跨域 JOIN、跨域只经事件（单体时也坚持） |
| **C3** | 日志诊断、APM 一开始就要考虑 | ✅ 可达成（现状有基础） | 新增架构篇 §13「可观测与诊断（从第一天）」：`traceId` 契约对齐 + W3C `traceparent` 传播 + 结构化日志 + Micrometer 指标 + 慢 SQL（等价 `TraceSQLTime`）+ **内置 `cube-plugin-diagnostics` 诊断插件**（链路检索/慢接口/错误聚合/JVM/插件健康）；新增验收 D-1~D-6 |

> **这三项不是附加题，而是决定"平台是否值得建"的关键**：
> - C1 决定业务开发能否真的"只写 Model.xml"
> - C2 决定大项目能否活
> - C3 决定私有化现场能否自助排障（客户无 APM、无外网是常态）
>
> 相应地，工程量由 52 → **71 人月**，P1 起就要包含可观测骨架，P2 要包含展现层引擎。

## 1.4 v2.0 → v2.1 修订（两项需求纠偏）

| # | 业务方反馈 | 影响面 | 修订内容 |
|---|---|---|---|
| **B1** | **平台不作 SaaS** | 许可证判定、部署架构、运维形态 | ①许可基准由"SaaS 合规"改为"**是否向客户分发二进制**"（D1 内部自用 / D2 私有化交付 / D3 SaaS）→ MinIO、Redis 7.4+、Elasticsearch、Grafana 从 ❌ 放宽为 ⚠️（§6.5）；②新增 §6.6 非 SaaS 部署形态的 7 项架构约束；③新增 `license` 授权插件、离线升级包、集群一致性简化为 DB 轮询；④缓存支持"全关"以适配 4C8G 客户机 |
| **B2** | **热插拔颗粒度不是实体类** | 插件运行时（K7）、元数据 Registry、代码生成、切片计划 | ①热插拔单位修正为**插件包**，实体/路由/菜单/权限/作业/前端资源随包同生共死（架构篇 §7.0）；②`EntityRegistry` 改为 `registerDomain/unregisterDomain` **原子整包**，移除单实体热注册通道（架构篇 §3.4）；③明确"改字段 ⇒ 发新版插件"，禁止运行期单字段改动；④新增插件依赖图与级联停用、停用语义（enable/disable/uninstall/purge）、配置型插件、离线升级、插件专项验收 P-1~P-8 |

> **B2 是实质纠偏**：v2.0 的"运行期注册单个 EntityMeta 即可零编译 CRUD"会破坏 ①类加载隔离（元数据已卸载但类仍在，ClassLoader 无法回收）②事务性（半加载产生"有元数据无路由"等不一致）③与"业务代码写在 `XxxBiz`"的模型冲突。
> 改为插件包颗粒度后，"新增一个实体需重装插件"（L1 秒级），换来可靠性与可维护性——这是自觉取舍（架构篇 ADR-05）。
> 工作量影响：内核 K7 由 4.0 → 4.5 人月（增加依赖图/级联停用/离线包/授权/泄漏检测），**总量 47 → 52 人月**。

## 1.5 v1 → v2 审计发现与修复（18 项）

> 审计范围：v1 全部章节 × 4 个数据源（XCode Doc 100 篇 / NewLife.AI Doc 18 篇 / Cube Doc 70 篇 / 源码与许可证核验）

### A. 阻断级（必须修复，否则方案不可用）

| # | v1 缺陷 | 证据 | v2 处置 |
|---|---|---|---|
| **A1** | 推荐 **XXL-Job** 作为调度组件 | GitHub License API 核验：`xuxueli/xxl-job` = **GPL-3.0** | ~~改为 PowerJob / Quartz+ShedLock~~ → **v4.3 再改**：调度内核自持（K15）+ AntJob 平台化（MIT）+ XXL-Job **协议插件**（不内嵌 GPL，§1.6-2） |
| **A2** | 组件映射表写 **MinIO/OSS** 作为对象存储 | 核验：`minio/minio` = **AGPL-3.0**（网络服务即触发开源义务） | ~~改为 SeaweedFS / Apache Ozone~~ → **v4.3 再定**：**采用 MinIO/OSS**（独立进程 + 不改源码，义务仅覆盖自身），做成 `storage` 插件；SeaweedFS 仅作 Apache 栈备选（§1.6-3） |
| **A3** | 无插件化设计，与"微内核热插拔"目标不符 | 需求 G1 | 新增架构篇 §7：PF4J（Apache-2.0）+ 四级热更新模型 + 类加载隔离 + 卸载纪律 |
| **A4** | 无 Model.xml 单一事实源设计，"业务成本下降"未落地 | 需求 G3/G4 | 新增架构篇 §4：JAXB 绑定 XSD + Maven 插件生成 + 分部类语义映射 + 覆盖规则表 |
| **A5** | 未识别"插件热插拔 与 Spring Boot 启动期固定 Bean"的根本冲突 | Spring 组件扫描的 Controller/HandlerMapping 启动期固化 | 架构篇 ADR-02/ADR-03：单一 `EntityHandlerMapping` + 可增删 `RouteRegistry`；插件独立 `AnnotationConfigApplicationContext` |
| **A6** | 无商用许可证矩阵 | 商用约束 | 新增 §6.5 完整矩阵（✅采用 / ❌禁用 / ⚠️待确认） |

### B. 高危级（显著影响正确性或估算）

| # | v1 缺陷 | 证据 | v2 处置 |
|---|---|---|---|
| **A7** | 未评估 **JDBC 驱动许可** | `mysql-connector-j` = GPL-2.0 + FOSS 例外；`ojdbc` = OTN/FUTC 再分发限制 | 驱动矩阵：MariaDB Connector/J（LGPL-2.1，MySQL）、pgjdbc（BSD-2，PG 及经确认的金仓/海量）、达梦/金仓/海量须厂商提供 |
| **A8** | 遗漏 `/meta` 的 **Accept-Language 本地化** | 后端存在 **32 份 Locale 词表**（`NewLife.Cube/Locales/*.yml`），字段译文由 `DataField.Localize()` 提供 | 架构篇 §6.3：i18n 契约 + 词表迁移 + 双语 diff 验收 |
| **A9** | "复用 `check-openapi.sh` 做 L1 契约"**不可执行** | 该脚本依赖 .NET 编译产物 + git-bash awk/grep，纯 shell 实现，无法处理 Java 侧文档 | 改为：基线 JSON 作为只读输入 + Java 侧 springdoc 产出 + 自研递归 diff 比对器 |
| **A10** | "锁定 Cube tag"**不可行** | `git tag` 仅到 `发布3.3.2020.0308`（2020 年）；当前版本走 NuGet 日期版本（如 `1.1.2026.x`） | 改为：锁定 **commit SHA**（当前 `b0ed746bd`）+ NuGet 包版本双锚 |
| **A11** | "保留前端"范围含糊 | 实有 **9 套 SPA**（Vue/NaiveUI/ArcoVue/Vuetify/TDesign/MUI/Shadcn/Angular/Svelte）+ **7 套 MVC 主题** | **v4.3 落定（D-25）**：**仅 ArcoVue**；其余 8 套 SPA 与 7 套 MVC 主题**不迁移、不验收**（不再有"按需验证"） |
| **A12** | 工作量不含内核平台化投入 | v1 仅在"XCode 替代层"含糊加了 3 人月代码生成器 | 重估：内核 18.5 人月独立成项（§8） |
| **A13** | 未处理"下游二次开发应用"范围 | 只在未决问题里提及 | 升级为**范围风险 R11**，并给出"平台化后边际成本下降"的对冲说明（§8.3） |
| **A14** | 未给多副本共享状态的**精确清单** | XCode/Cube Doc 情报确认 **15 项**进程内状态 | 架构篇 §5.8 逐项给方案 |

### C. 中危级（易埋坑）

| # | v1 缺陷 | 证据 | v2 处置 |
|---|---|---|---|
| **A15** | `X-Cube-Field-Validation` 只列头名未说语义 | `EntityController.cs:356-364`：写请求携带 `1/true/yes`（忽略大小写）才启用字段级校验；读请求不带头 | 架构篇 §6.4 明确"按需启用，不默认拒绝" |
| **A16** | 未强调 `itemType` 是**开放字符串**而非枚举 | XCode 源码/测试：含 `Number/mail/mobile/image/html/TimeSpan/date/json/code`，插件可扩展 | 架构篇 §3.3：保留原始字符串透传，禁止白名单裁剪 |
| **A17** | 未给"业务仅引用基础组件"的依赖治理 | 需求 G2 | 架构篇 §9：BOM + 唯一 starter + 6 条 ArchUnit 门禁 |
| **A18** | 工作流引擎许可证与语义未评估 | Camunda 8 = 专有；Flowable = Apache-2.0；flowgram.ai = **MIT**（已核验 LICENSE） | **v4.3 落定（D-29）**：**Flowable 7.x** + **flowgram.ai** 画布；现有 29 个 Workflow 文件按 Flowable 升级，语义映射与"受限节点集 + 编译 BPMN"见架构篇 §7.15 |

> **未修复（保持原判断）**：Java 23 已 EOL 的纠偏、Boot 3.5 开源支持已于 2026-06-30 结束的提示、6 项水平扩展阻塞点、"微服务化不靠换语言"的结论 —— 均经复核成立。

## 1.6 v4.2 → v4.3 收口（9 项需求落地）

| # | 需求 | 决策 | 影响与修订 |
|---|---|---|---|
| 1 | **前端仅锁定 ArcoVue**，其余 SPA 与 MVC 主题不迁移 | ✅ D-25 | 验收范围收窄为 ArcoVue（L3 仅此一套）；删除"其余 SPA 按需验证"；MVC 主题彻底不迁移 |
| 2 | **AntJob 迁移为平台能力和插件**，不再需要外部第 3 方调度组件；同时支持 **XXL-Job 插件** | ✅ D-26 / D-27 | 调度改为 **内核 K15 自持 + `job-ant` + `job-xxl` 协议插件**；删除 PowerJob/Quartz+ShedLock 选型；新增 Cron 语义等价要求（`d#Lk` 等） |
| 3 | **文件/附件存储支持 MinIO / 云 OSS**，做成系统插件 | ✅ D-28 | 新增 `storage` 系统插件与 `ObjectStorage` SPI；MinIO 以 AGPL 独立进程方式采用；复用 Cube 已有 `S3ObjectStorage` 语义 |
| 4 | **工作流用 Flowable**，前端 **flowgram.ai**，后端实体按 Flowable 升级 | ✅ D-29 | 新增 §7.15：引擎表 + 业务扩展表、语义映射、受限节点集 + `FlowGraph → BPMN2` 编译器 |
| 5 | 底层基础组件**研究 NewLife.Core 代码与 Doc** | ✅ D-30 | 新增架构篇 §15.4 组件对照表（`ICacheProvider`/`Cron`/`TimerX`/`IPlugin`/`ITracer`/`Snowflake`…） |
| 6 | **按插件控制器动态生成/更新菜单**，不需人工添加 | ✅ D-31 | 架构篇 §7.7 重写：生成层 + 管理员覆盖层 + 用户层；幂等、软删、快照回滚、权限位同步注册 |
| 7 | **CubeDemo 非核心能力全部插件化** | ✅ D-32 | CubeDemo 转为 `demo-school` / `demo-test` / `demo-workflow` 三个插件；新增 P-13"拆除验证" |
| 8 | 数据库只支持 **sqlite / mysql / postgresql / 金仓 / 海量 / 达梦** | ✅ D-33 | 删除 SQL Server / Oracle / DB2 / 瀚高；DB-1 拆为 DB-1a（三库必测）/ DB-1b（国产库交付前实测） |
| 9 | **同时支持本地缓存与分布式缓存（Redis）** | ✅ D-33 | 缓存对齐 `ICacheProvider` 两级模型；Redis 为唯一分布式实现；新增 CACHE-1~4 验收与降级策略 |

**连带影响（必须一起改）**

1. **工程量 +8 人月**（83 → 91；v4.3 口径，v4.3.1 复核后为 **88**，见下）：内核 +1.0（菜单自动生成 0.5 + 两级缓存 0.5）、功能 +7.0（作业/调度 4.0 + 存储 1.0 + 工作流 1.5 + CubeDemo 插件化 0.5）、回归专项 +1.0，扣除原"AntJob 试点 +1.5"（转交付，投入并入作业/调度 5.0）。
2. **风险登记册 +5 条**（R34~R38）：Cron 语义漂移、MinIO/Redis 许可交付、flowgram → BPMN 表达力、菜单生成与人工调整冲突、调度插件协议跟版。
3. **AntJob 从"试点"升级为"交付物"**：原 P4 的"试点报告"改为 **P3 迁移验收 + 缺口回灌**，投入计入平台能力。

**v4.3.1 核实补记（§9.6）**

4. **零代码展现 7 项已全部实现**（ArcoVue 迁移方案 §7.4/§8.5 + 已归档 OSC 0005/0006/0015/0016/260815fa86/26081903c0/2608280e9e/26082815a1/260830a1b2/260902ef43/26092694a1/261004d7f4）：取消"填色/分组需补齐"的结论。
5. **K9 展现层引擎 7.0 → 4.5**（−2.5：去掉服务端填色规则引擎与 GroupEngine），内核平台化 46.0 → **44.5**（再 +1.0 分片/雪花），总工程量 91 → 88 → **89**（v4.3.2）。
6. **`cube:Presentation` 文件化 DSL 降级为可选增强**（默认不做）——现状权威源是库（`UserProfile`/`ViewProfile`/`Parameter`），双源会漂移；`/meta` 不再规划 `views/queries/insights` 扩展键。

**v4.3.2 追加（分库分表与雪花 ID，D-35）**

7. **分库分表 / 雪花 ID / 读写分离必须同步迁移**：Cube 的日志表、物联网监测表与跨库业务实体直接依赖，**不是可选增强**。
8. **语义逐条对齐 XCode**：`ShardModel`/`IShardPolicy`/`TimeShardPolicy`（区间推导、条件裁剪、缺范围抛错、批量分组）、`DataScale=time` 与 `timeShard:fmt` 两义（大表禁实体缓存）、`AutoShard` **每分片分页不合并**、`EntitySplit` 的并发串表教训（改为 `ShardScope`/独立 Session）、`ReadWriteStrategy` 四条件。
9. **雪花 ID 兼容是硬约束**：41/10/12 位 + epoch 1970 不得改（否则存量 ID 与分片解析失配）；workerId 用 Redis 自增分配（复用 §5.5 的 L2）、冲突拒绝启动、时钟回拨 1h+10s 容忍窗口。
10. **工作量 +1**：K4 4.5 → **5.5**（分片+雪花由"跟随"改为显式交付，含历史分片兼容与 SHARD/ID 验收），总量 88 → **89**（MVP 51 → 52）。

**v4.3.3 追加（AI 就绪与 Spring AI Alibaba，D-36）**

11. **AI 就绪提前到迁移第一天**：内核 `cube-kernel-ai`（K16）进 **P1**——`ToolRegistry`（工具清单由元数据+路由生成）、`AiContext`（用户/租户/权限/页面）、MCP server（`/mcp`）、`AiSseWriter`（`/Ai/AiChat` 事件与序列化口径）；三条硬约束 **AIR-1 元数据即工具 / AIR-2 权限即工具边界 / AIR-3 契约即基线**。
12. **Spring AI Alibaba 可替代 NewLife.AI（分层替代）**：**Spring AI 1.1.2**（Apache-2.0）覆盖 `ChatClient`/工具/MCP/ChatMemory/多模态/向量；**Spring AI Alibaba 1.1.2.2**（Apache-2.0）可选覆盖 Graph 与多智能体编排；Cube 自研薄层承担 SSE 契约、动态工具、权限裁剪、模型热切换、审计配额。详见 §9.8。
13. **明确不复刻的四项**：46 家服务商元数据/报价体系、用户记忆 10 类（EVO）、OpenAI 兼容入站网关（GW）、IM 渠道（钉钉/企微/飞书/Slack/Telegram）——均非平台必需，按需单独立项。
14. **工作量 +1**：内核 K16 **0.5** + `ai` 插件 3.0 → **3.5**，总量 89 → **90**（MVP 52 → 53）；新增 **AI-1~AI-7** 验收与 **R42~R44** 风险。

---

**v4.3.3 → v4.3.4 收口（11 项架构复核与修订，D-37~D-41）**

| # | 修订项 | 结论 | 落点（架构篇） | 本文影响 |
|---|---|---|---|---|
| 1 | 注册接口为何叫 `EntityRegistry` 而非 `PluginRegistry` | **改为 `PluginRegistry`**：注册原子单位是**插件域**（实体只是载荷之一，同事务还注册路由/菜单/权限/作业）；实体的元数据存储另名 `MetaStore` | §3.4（含"为什么改名"三条理由） | D-37 |
| 2 | 插件安装/更新时**自动结构同步** | ✅ 采纳：内核 `SchemaSync` 按 `Model.xml` 与库比对执行 DDL，四档 `Migration`（默认 `On`，表级只能收紧），改结构前自动备份；**部署与开发不跑脚本** | §7.8.1、§7.4 | D-38；+1.0 人月；SCHEMA-1~4 |
| 3 | 生成物清单复核 + 平台/项目/插件**三级泛型基类** | ✅ 修正：`OrderController` 与原 .NET 一致**存在即跳过**（含 `Search` 业务代码，`ClassBuilder` 实测只在文件不存在时写盘）；基类链 `AbstractEntityController<E,M>` → 项目基类 → 插件控制器；`Order.java` 覆盖、`OrderBiz.java`/`OrderController.java` 跳过 | §4.3、§4.4 | D-37 |
| 4 | 复杂业务查询在 ArcoVue 已由「自定义查询 + 预定义查询」实现 | ✅ 采纳：条件组合类查询已零代码（14 op 条件构建器 + 保存/共享/恢复）；业务代码只接跨表/聚合/游标 | §4.6、§5.9.2、§5.9.5 | §9.6 补充 |
| 5 | `Parameter` 增强为运行态参数中心 | ✅ 采纳：同一表承载系统配置 / LOV 值集 / 共享预定义查询 / 自定义字典；新增 `Scope/TenantId/Domain/Format/Version/IsSystem/Expire`，`Kind` 只追加不重排 | §5.16 | D-39；+0.5 人月；PARAM-1~3 |
| 6 | `ViewProfile` 实体与 JSON 子契约复核 | ✅ 逐字段核对实体 `视图配置.cs` 与前端 `viewProfile.ts`：确认 15 个业务列（含 `ActiveQueryId`/`QueriesJson`/`DashboardJson`/`Version`）；**`Name`/`SortsJson` 并不存在**（排序在 `ViewsJson[].sorts`，已修正文档） | §5.9.5、§12.2.1 | 契约基线补充 |
| 7 | 查询表达式支持 `== != > < >= <=` | ✅ 采纳：Java 无运算符重载 → 三处落实（生成的 `Order.F` 字段句柄 / 动态字段白名单 / JSON 符号别名归一）；**前端 14 个 op 是唯一权威集合** | §5.2.1 | — |
| 8 | 认证/权限/租户：SSO、第三方验证、用户中心做系统插件 | ✅ 采纳：内核只留最小认证 + 授权判定；`sso`（OAuth2 客户端/服务端）、`auth-third`（短信邮件码 + TOTP MFA + 图形码 + 风控）、`usercenter`（用户中心）三插件，依据 `SsoController`/`MfaController`/`Services/Auth/*` 实测 | §8.5、§7.1 | +0.5 人月；AUTH-P-1~4 |
| 9 | 系统升级在线/离线双模，**默认在线** | ✅ 采纳：同一套"清单 → 兼容矩阵 → 签名 → dry-run → 备份 → 执行 → 回滚 → 审计"；在线为默认，无外网自动提示改离线包；**内核自身不热替换**（大版本走旁路切换） | §7.12 | D-40；+0.5 人月；UP-1~5 |
| 10 | 数据库默认 **SQLite**，首次运行/切换库自动建库建表 + 初始化 | ✅ 采纳：默认 `jdbc:sqlite:./data/cube.db`；启动链路 建库 → 结构同步 → 播种（内核 → 系统插件 → 业务插件，幂等，`cube_schema_history` 记账） | §5.11.1、§5.11.5 | D-41；INIT-1~4 |
| 11 | 数据库**异步读写**能力复核并入 §15.5 | ✅ 采纳：写侧 `EntityQueue` 等价（两级队列/自适应周期/背压 15s/批量 10000/关闭等 3s）+ **Java 新硬规则"必须 afterCommit 入队"**；读侧虚拟线程 + 超时，**不引入 R2DBC** | §5.17、§15.5 | +0.5 人月；ASYNC-1~3 |

**连带影响**

1. **工程量 +3.0 人月**（90 → **93**）：结构同步 1.0、参数中心 0.5、在线升级 0.5、异步写 0.5、认证插件拆分 0.5；**MVP 53 → 55**（结构同步 / 参数中心 / 异步写属基座必需）。
2. **验收新增 6 组**：SCHEMA-1~4、INIT-1~4、PARAM-1~3、UP-1~5、ASYNC-1~3、AUTH-P-1~4（架构篇 §11.5 已索引）。
3. **风险 +3 条**（R45~R47）：自动 DDL 在生产误删/锁表、在线升级供应链、认证插件拆分后的登录态一致性。
4. **契约资产 +2 项**：`ViewsJson`/`QueriesJson` 的 round-trip 样本、`Parameter` 四级作用域样本，均进 `cube-contract` 基线。

---

## 2. 评估范围与方法

### 2.1 已覆盖数据源

| 仓库/模块 | 内容 | 规模 |
|---|---|---|
| `NewLife.Cube`（第三代 API） | 后端主体 | 378 `.cs` / 63,430 行 |
| `NewLife.CubeNC`（第二代 MVC） | 兼容层，大量 `<Compile Include>` 共享 | 352 `.cs` / 45,525 行 |
| `NewLife.Cube.ArcoVue/web` | 前端 SPA | 513 文件 / 76,553 行 |
| `packages/cube` | 前端共用契约层 | 31 文件 / 7,279 行 |
| `NewLife.XCode` | 数据中间件核心 + 10 个数据库提供程序 | 约 274 `.cs` / 61,695 行 |
| `NewLife.AI` | AI 能力层（客户端/工具/技能/编排/MCP/网关） | Doc 18 篇 + 源码 |
| `spring-projects/spring-ai` | Spring AI 1.1.2：`starters/`（含 MCP server-webmvc / client、model-* 系列、chat-memory、vector-store）、`mcp/` | 目录清单已核 |
| `alibaba/spring-ai-alibaba` | Spring AI Alibaba 1.1.2.2：`pom.xml`（revision / Spring AI 1.1.2 / Boot 3.5.8）、`spring-ai-alibaba-bom`、README | 版本与模块已核 |
| Doc 资料 | XCode 100 篇、Cube 70 篇、AI 18 篇、Api 9 篇 | — |

### 2.2 未覆盖（边界声明）

- 未启动服务采集字节级响应（P0 首要动作）
- 未逐条核对 463 个操作的实现细节
- 未评估 ArcoVue 之外的皮肤对契约的额外依赖
- 未实测信创数据库（达梦/金仓/海量）的 JDBC 驱动与方言兼容性
- 许可证核验基于 GitHub License API（20 个组件）+ 公开许可文本；达梦/金仓/海量驱动需法务确认（v4.3 已排除 Oracle/SQL Server/DB2/瀚高）

---

### 2.3 范围边界：全新项目，不涉及下游 .NET 系统

| ✅ 纳入本次范围 | ❌ 不在本次范围 |
|---|---|
| **平台重建**：微内核 + 系统插件 + 业务插件框架（G1~G7） | 任何下游 .NET 业务系统（**本项目视为全新项目**） |
| **NewLife.Cube 自身迁移**：39 个 Area 控制器、认证/权限/系统管理/导入导出/通知/Workflow/AI/Widgets | 下游自定义实体、控制器、前端页面 |
| **`CubeDemo` 迁移**（平台能力样板） | 国产数据库实测（由具体项目交付时接入） |
| **`NewLife.AntJob` 试点验证**（§2.4，真实业务系统） | war 外置容器部署（明确不做） |
| `cube-migrate` MVP（**用于迁移平台自身**，非下游） | 下游迁移工具链完整版 |
| 契约回归基线 + 回归套件（**永久资产**） | — |

#### 2.3.1 三条推论

1. **总工程量 = 平台侧 ≈ 89 人月**，与任何下游系统无关。
2. **"不保留 .NET 版本"** 指：平台源码归档、不再发布 .NET 新版本；P0 起**冻结 .NET 侧平台功能变更**（仅修 P0 级缺陷）。由于不存在下游依赖，本次切换的爆炸半径 = **平台 + CubeDemo + AntJob**。
3. **契约样本库的定位变化**：本项目不是"从 .NET 差分迁移"，而是"按契约重建"。因此样本库的作用从"迁移期差分预言机"转为"**长期契约回归基线**"——它防止的是 Java 版本自身的漂移，而不是与 .NET 的一致性。.NET 侧只在 P0~P2 期间作为**只读参考实现**（读代码/跑行为），不作长期对照。

#### 2.3.2 `cube-migrate` 的真实用途（回应决策 4）

虽然不做下游迁移，但**平台自身有大量声明式配置需要搬运**：

| 对象 | 数量 | 手工成本 | `cube-migrate` 处理 |
|---|---|---|---|
| Area 控制器 | 39 个 | 每个 50~200 行静态构造配置 | AST 解析 → `cube:Presentation` DSL 初稿 |
| 领域实体 | 数十个（`NewLife.Cube/Entity/` 74 个 .cs） | 逐个核字段 | 扫描生成 Model.xml 草案 + 差异报告 |
| CubeDemo 实体/控制器 | 少量 | — | 同上 |

**MVP 范围（+1.0 人月）**：`scan`（解决方案扫描）+ `model`（Model.xml 草案/校验）+ `ctrl`（静态构造 → DSL）+ `report`（差异报告）。**不含**重写方法（`Search`/`Valid`/`OnInsert`）的自动转译——那部分仍需人工。

### 2.4 `NewLife.AntJob`：从"试点"升级为"平台调度能力"（决策 3 → v4.3 D-26）

**v4.3 变更**：AntJob 不再只是"验证平台能否承载真实业务"的试点，而是**迁移为平台自带能力**（`job-ant` 系统插件），使平台**不再依赖任何外部第三方调度组件**；同时以 `job-xxl` 协议插件兼容 XXL-Job。

| 项 | 现状（本地实测） |
|---|---|
| 代码规模 | **98 个 `.cs` / 12,469 行** |
| 工程结构 | `AntJob` / `AntJob.Agent` / `AntJob.Data` / `AntJob.Extensions` / `AntJob.Server` / `AntJob.Web` |
| 业务特征 | 任务调度（Data / Time / Message 三模式）、切片并行、作业分发、Agent 心跳、结果回传、Web 管理界面 |
| 许可 | **MIT**（新生命自有），移植与分发无限制 |
| 与 Cube 关系 | 同属 NewLife 生态，但**不是** Cube 插件形态 → 正好检验"平台能否承载独立业务" |

**迁移范围**

| 项 | 内容 |
|---|---|
| 做 | 核心域全量迁移：作业定义 / 切片调度 / 执行与回传 / Agent 注册心跳 / 管理端点与页面；作为 `job-ant` 代码型插件交付 |
| 做 | 与内核 K15 分工：K15 负责"到点触发"，AntJob 负责"大任务切片并行"（架构篇 §5.13.5） |
| 不做 | 性能压测、生产替换、AntJob 历史数据在线迁移（提供导出脚本） |
| 产出 | ①`job-ant` 插件 ②Cron 语义等价证明（JOB-1）③缺口清单回灌 |
| 投入 | **3.0 人月**（取代原"+1.5 试点"；另计 K15 内核 1.5 + XXL 协议 0.5） |

> **价值**：CubeDemo 证明"平台能跑"，AntJob 证明"平台能承载真实业务"，且**顺手补齐了平台的调度短板**——这是本方案里少见的"验证与交付合一"。风险见 R31（缺口回灌）与 R34（Cron 语义漂移）。

## 3. 现状基线（硬数据）

| 指标 | 数值 | 来源 |
|---|---:|---|
| 后端 API 代码 | 378 文件 / 63,430 行 | `NewLife.Cube/` |
| MVC 兼容层代码 | 352 文件 / 45,525 行 | `NewLife.CubeNC/` |
| 前端 SPA | 513 文件 / 76,553 行 | `NewLife.Cube.ArcoVue/web/` |
| 前端契约层 | 31 文件 / 7,279 行 | `packages/cube/src/` |
| XCode 核心 | ~274 文件 / 61,695 行 | `NewLife.XCode/XCode/` |
| **API 契约面** | **358 paths / 463 操作 / 211 schema**（Admin 214/280/113） | `CubeDemo/contracts/openapi/*.json` |
| 已实现功能点 | 190（188 已实现 / 2 废弃） | `Doc/功能清单.md` |
| Area 控制器 | 39 个 | `NewLife.Cube/Areas/` |
| 多语言词表 | 32 份 YAML | `NewLife.Cube/Locales/` |
| 测试资产 | 280 个测试文件；ArcoVue 134 Vitest + 6 E2E；Vue 10 E2E | 仓库统计 |
| 前端皮肤 | 9 套 SPA + 7 套 MVC 主题 | `Doc/Api/内置前端皮肤.md` |
| Model.xml XSD | `XCode/ModelSchema.xsd`（22.8 KB，命名空间 `Model202604`） | 可被 JAXB 直接绑定 |
| 当前代码锚点 | commit `b0ed746bd`（2026-10-31） | `git log` |

---

## 4. 前端契约分析

### 4.1 前端是"动态页面协议的渲染器"，不是 REST 消费者

`/meta` 决定列表列、表单控件、搜索项、工具栏、按钮权限；前端据此渲染，不硬编码业务字段。相关文档：[`Api/核心接口架构.md`](Api/核心接口架构.md)、[`Api/WebAPI接口规范.md`](Api/WebAPI接口规范.md)、[`Api/字段元数据.md`](Api/字段元数据.md)、[`Api/页面呈现架构.md`](Api/页面呈现架构.md)。

### 4.2 刚性契约清单（Java 端必须逐条等价）

| # | 硬契约 | 证据 |
|---|---|---|
| 1 | 常见信封 `{code,data,message,traceId,page,stat,fieldErrors}`；`code===0` 成功；业务状态码映射受配置控制，认证过滤器、限流、415 等存在不同 HTTP 状态和响应形态，逐路径采样 | `packages/cube/src/api/client.ts`、规范 §36.3–36.4、`ControllerBaseX.cs`、`RateLimitAttribute.cs` |
| 2 | 令牌：`Authorization: <裸 JWT>`（**无 Bearer**）、Cookie `token`、`X-Token`、`?token=`/`?jwtToken=` 四来源；仅接受三段式 JWT | `api/client.ts`、`api/token.ts`、规范 §36.9 |
| 3 | `POST /Auth/Login|Refresh|Logout`、`GET /Auth/Info`；refresh 体 `{refreshToken,userName}`；刷新令牌**轮换 + 黑名单防重放** | [`Api/认证接口设计.md`](Api/认证接口设计.md) §2.4/§6 |
| 4 | `GET /Auth/Challenge` + RSA-OAEP/**SHA-256** 一次性挑战（300s） | 同上 |
| 5 | 分页 `pageIndex/pageSize`，响应 `totalCount` 为**字符串**；`sort/desc/orderBy/q|Q/dtStart/dtEnd` | 规范 §36.5–36.6 |
| 6 | 主键与 Int64 一律字符串化；`id/Id/ID` 三写兼容 | `api/api.ts`、`utils/index.ts` |
| 7 | 头：`X-Tenant`（租户 **Code**）、`X-App-Id`、`X-Cube-Field-Validation` | `ArcoVue/web/src/api/index.ts` |
| 8 | 通用 CRUD：`GET/POST/PUT/PATCH/DELETE /{type}[/{id}]`；`/meta`、`/export`、`/import`、`/Upload`、`?ids=`、`?restore=true` | `api/api.ts`、规范 §36.2 |
| 9 | 导出返回**文件流**（非信封）；上传 `multipart` 字段 `file`；可选 `Idempotency-Key`（10 分钟重放） | 规范 §36.2 |
| 10 | `/Cube/MenuTree` + 权限位（1/2/4/8/16/32）；菜单同时是**权限载体** | `router/index.ts`、`page/index.ts` |
| 11 | `/meta` 字段 `displayName` 按 `Accept-Language` 本地化 | [`规范/前端.md`](规范/前端.md)、32 份 Locale 词表 |

> 文档明确声明"前后端同版本发布，无需兼容旧写法"（规范 §36.1）⇒ 必须整体对齐单一版本，不能"大致相似"。

### 4.3 契约资产（可机械复用）

- 基线：`CubeDemo/contracts/openapi/{CubeDemo,CubeDemo_admin,CubeDemo_cube,CubeDemo_school,CubeDemo_test}.json`
- .NET 侧门禁：`scripts/check-openapi.sh`（仅校验 `(path, method)` 存在性）→ **不能在 Java 侧直接复用**（A9）
- Java 侧方案：同一份基线 JSON 作只读输入，springdoc 产出后递归 diff（架构篇 §11）

### 4.4 前端验收缺口（v1 遗漏）

- **无跨皮肤统一契约测试套件**：ArcoVue 仅 134 个 Vitest 逻辑测试（不 mount `.vue`）+ 6 个 Playwright E2E；Vue 皮肤 10 个 E2E
- 唯一贴近后端边界的是 `devProxy.spec.ts`（断言 `/api`、`/Auth`、`/Cube`、`/Sso` 前缀与前缀代理）
- ⇒ **无法靠现有前端测试判定"后端等价"**，必须自建 L2 运行时样本库（P0 核心交付）

---

## 5. 后端能力面（重写主体）

### 5.1 三层结构

```
宿主管线（AddCube/UseCube，17 步中间件）
        ↓
元数据引擎（XCode Meta.Fields → PageMetaBuilder → /meta）   ← 真正核心
        ↓
通用控制器（EntityController<T> 等 39 个声明式薄壳）
        ↓
XCode（FindAll/Insert/Update/Delete、WhereExpression、EntityCache、Migration、拦截器）
```

### 5.2 XCode 能力面 vs Cube 实际消费子集

| XCode 能力 | Cube 是否消费 | Java 策略 |
|---|---|---|
| `Meta.Fields/ConnName/Session/Cache` | ✅ | 自研元数据 Registry（解析 `Model.xml`） |
| CRUD 静态方法 | ✅ | 元数据驱动的通用 SQL 引擎 |
| `WhereExpression` | ✅ | `Filters` 链式 API（等价运算符全集） |
| `EntityCache`/`SingleCache`/`FieldCache` | ✅ | Caffeine + 分布式失效广播 |
| 拦截器（Time/User/IP/Trace/DataScope/Tenant） | ✅ | `EntityHook` SPI |
| Migration 四档 | ✅ | Liquibase diff API（Apache-2.0） |
| `DataScale` 分片 / TimeShard | ✅ | **`ShardPolicy` + `TimeShardPolicy` 全语义对齐**（区间推导/条件裁剪/缺范围抛错/批量分组）；`time` 与 `timeShard:fmt` 两义；大表禁实体缓存（§5.7.3~5.7.5） |
| 雪花 ID（`IEntityOperate.Snow`） | ✅ | `SnowflakeId`：**41/10/12 + epoch 1970 兼容**；workerId 经 Redis 分配；回拨策略（§5.7.8） |
| 多库 `ConnName` | ✅ | `DataSourceRegistry` 按 ConnName 路由；**无跨库事务/跨库 JOIN**（§5.7.2） |
| 读写分离 `ReadWriteStrategy` | ✅ | `AbstractRoutingDataSource` + `{name}Readonly` 约定；四条件判定（§5.7.9） |
| **结构同步（反向工程）** | ✅ | **自研 `SchemaSync`**（不依赖 Liquibase）：正向读库 → 与 `Model.xml` 推导的 `IDataTable` 比对 → 四档 `Migration`（默认 `On`，表级只能收紧）→ 自动 DDL；改结构前自动备份（架构篇 §7.8.1） |
| **建库 + 初始化（`InitData`）** | ✅ | `DbProvider.databaseExists/createDatabase` + `SeedInitializer` + `cube_schema_history` 幂等；默认 SQLite 即建文件（§5.11.5） |
| **异步批写（`EntityQueue`）** | ✅ | `AsyncWriteQueue`：两级队列 + 周期 500~5000ms 自适应 + 背压 15s + 批量 10000 + 关闭等 3s；**Java 追加 afterCommit 入队硬规则**（§5.17） |
| **延迟队列（`DeferredQueue`）** | ✅ | `DelayQueue` / Redis ZSET，用于审计与日志异步落库 |
| `EntitySplit` 临时切换 | ⛔ 不复刻 | 其并发串表风险已确认；改用 `ShardScope` / 独立 `EntitySession`（§5.7.7） |
| 10 个数据库提供程序 | 按部署 | `PageDialect` SPI + 厂商驱动 |

> **可替代**：CRUD、方言、事务、批量。**不可替代**：元数据 → 前端协议这一层（必须自研）。
> **XCode 的缺口**：不支持运行期热加载新实体（`TableItem` 以类型为键静态缓存）；无分布式缓存失效。Java 侧必须补上——这正是"微内核"的价值点。

### 5.3 MVC/Razor 层可整体弃用

`RazorViewEngineOptions`、`ThemeViewLocationExpander`、`ViewBag`、55+ `.cshtml`、7 套 MVC 主题均无需迁移。重写面从 ~10.9 万行收敛至 **~6.3 万行 API 侧逻辑**。

---

## 6. 目标技术栈决策

### 6.1 版本矩阵（核验 endoflife.date / SCA Releases）

| JDK | 支持状态 | Spring Boot | Spring Cloud Alibaba |
|---|---|---|---|
| **23** | ❌ 2024-09 发布，**2025-03-18 EOL**，非 LTS | 仅 3.3.x（已 EOL） | 无官方配套 |
| **21 LTS** | ✅ 至 2029-12 | **3.5.x**（开源支持 2026-06-30 结束；扩展支持至 2032-06-30） | **2025.0.0.0**（Boot 3.5.0 / Cloud 2025.0 / Nacos 3.0.3） |
| **25 LTS** | ✅ 至 2031-09 | 4.0.x / 4.1.x（支持 17–26） | 2025.1.0.0（Boot 4.0 / Cloud 2025.1 / Nacos 3.1.1） |

**决策**：采用 **JDK 21 LTS + Boot 3.5.x + SCA 2025.0.0.0**（已确认）。

### 6.2 取舍与应对

| 项 | 说明 | 应对 |
|---|---|---|
| Boot 3.5.x 开源支持已于 2026-06-30 结束 | 后续安全补丁不进 OSS 发布线 | ①版本全量 pin（BOM 唯一源）；②订阅 CVE 源，自建回移流程；③预留 Boot 4.x + SCA 2025.1 升级路径（JDK 21 可原地升） |
| JDK 21 的 `ScopedValue` 仍为预览 | 不能作为 ThreadLocal 替代基线 | 用 `TransmittableThreadLocal` + 显式传参（架构篇 §8.4） |
| JDK 21 虚拟线程 | 提升吞吐，但 ThreadLocal 传播需谨慎 | 需要时 `spring.threads.virtual.enabled=true`，同时确保 TTL 覆盖 |

### 6.3 SCA 组件裁剪（单体 + 少量治理）

| 组件 | 采用 | 理由 |
|---|---|---|
| Nacos（配置中心） | ✅ | 替代 `CubeSetting`/`appsettings.json`；支持灰度与热更新 |
| **调度** | 自研内核 K15（**不选外部组件**） | 存量 `CronJob` 语义需无损延续；客户现场少一个中间件；彻底规避 GPL 内嵌（D-26/D-27） |
| **AI** | ✅ **Spring AI 1.1.2（核心）+ Spring AI Alibaba 1.1.2.2（可选编排）** | 覆盖对话/工具/MCP/记忆窗口/多模态/流式；两库均 Apache-2.0；**不引入** Studio/Admin 与 a2a-nacos/agentscope/config-nacos starter（§9.8） |
| Nacos（注册中心） | 🟡 观望 | 单体内收益低；预留拆分能力 |
| Sentinel | 🟡 可选 | 可映射现有 `RuntimeMiddleware` + `BlockService` |
| Gateway | 🟡 可选 | 前移 `UseApiPrefixRewrite`/CORS/静态资源 |
| Seata | ❌ | 现状单库本地事务 |
| RocketMQ | 🟡 可选 | 通知/告警异步化；亦可先用 Spring 事件 → 后升级到 `KernelBus` |
| Dubbo | ❌ | `NewLife.Remoting` 用量有限 |

### 6.4 插件运行时选型

**PF4J（Apache-2.0）** + 自研 Spring 集成层：提供插件描述符、ClassLoader 隔离、生命周期、依赖解析；内核侧自研 `RouteRegistry`/`EntityRegistry`/`DisposableRegistry` 完成"热插拔"语义（架构篇 §7）。

> 不选 OSGi：版本/部署复杂度与 Spring Boot 生态冲突，团队学习成本不划算。

### 6.5 许可证合规矩阵（**非 SaaS 场景重新判定**）

#### 6.5.1 判定基准变更

v1 按"SaaS 合规"判定，导致把"仅对 SaaS 生效"的条款误用到私有化交付场景。v2.1 改按**是否向客户分发二进制/镜像**判定：

| 交付形态 | 说明 | 许可义务 |
|---|---|---|
| **D1 内部自用** | 只在本组织内运行，不向第三方交付二进制 | **无分发 ⇒ GPL/AGPL 均不产生义务**（内部私用） |
| **D2 私有化交付**（本平台默认） | 客户现场安装，交付镜像/安装包 | **构成分发** ⇒ GPL 传染对**内嵌库**有效；AGPL 义务**仅覆盖该组件自身**（提供其源码即可，不改源码则可用） |
| **D3 SaaS** | 已排除 | — |

> 若某项目确认只做 D1，下表中 ❌ 项可放宽为 ⚠️（但仍不建议，避免将来转 D2 时返工）。

#### 6.5.2 判定变化对照（v1 → v2.1）

| 组件 | 许可 | D1 | **D2（默认）** | v1 判定 | 变化 |
|---|---|---|---|---|---|
| **XXL-Job**（`xxl-job-core` 内嵌 JAR） | GPL-3.0 | ✅ | ❌ **不可内嵌** → **改为协议兼容插件**（自研执行器，§5.13.6） | ❌ | 方式变更（D-27） |
| **MinIO**（独立进程，S3 协议） | AGPL-3.0 | ✅ | ✅ **采用**（不改源码 + 提供源码指引） | ❌ | **放宽为采用**（D-28） |
| **Redis 8.x** | RSALv2 / SSPLv1 / **AGPLv3** 三选一 | ✅ | ✅ **可用**（平台只做客户端） | ❌ | **放宽** |
| **Redis ≤7.2 / Valkey** | BSD-3 | ✅ | ✅ 可用（交付首选） | — | 新增说明 |
| **Flowable 7.x** | Apache-2.0 | ✅ | ✅ 可用 | — | **新增采用**（D-29） |
| **flowgram.ai** | MIT | ✅ | ✅ 可用 | — | **新增采用**（D-29） |
| **Elasticsearch** | SSPL / ELv2 | ✅ | ✅ **可用**（非 SaaS 不触发 SSPL 核心条款） | ❌ | **放宽** |
| **Grafana** | AGPL-3.0 | ✅ | ⚠️ 可用（独立进程 + 提供源码） | ❌ | **放宽** |
| **MySQL Connector/J** | GPL-2.0 + FOSS 例外 | ✅ | ❌ **不可**（分发需 Oracle 商业许可） | ❌ | 不变 |
| **Camunda 8** | 专有 | ❌ | ❌（需商业许可） | ❌ | 不变 |
| **达梦 / 金仓 / 海量 JDBC** | 厂商专有 | ⚠️ | ⚠️ 随项目商业许可分发（见 §6.5.6） | — | 新增说明 |

#### 6.5.3 ✅ 采用清单（D2 私有化交付安全，已核验 SPDX）

| 领域 | 组件 | 许可 |
|---|---|---|
| 应用框架 | Spring Boot 3.5.x / Spring Security / Spring Cloud Alibaba 2025.0 | Apache-2.0 |
| 配置中心 | Nacos 3.0.3（**可选**，单机可只用本地配置） | Apache-2.0 |
| **调度** | **内核 K15（自研）** + AntJob 移植（MIT）/ XXL-Job 协议插件（无 GPL 依赖） | MIT / 自研 |
| 数据访问 | MyBatis-Plus / ShardingSphere | Apache-2.0 |
| 迁移 | Liquibase / Flyway Community | Apache-2.0 |
| 本地缓存 | Caffeine | Apache-2.0 |
| 分布式缓存 | **Redis**（客户端 Lettuce / Spring Data Redis）；服务端 Redis 8.x / ≤7.2 / Valkey 均可 | Apache-2.0 / BSD-3 |
| 插件 | **PF4J** | Apache-2.0 |
| Excel / Office | FastExcel / Apache POI | Apache-2.0 |
| JSON / JWT | Jackson / Nimbus JOSE+JWT | Apache-2.0 |
| 认证（可选） | Sa-Token | Apache-2.0 |
| OpenAPI | springdoc-openapi | Apache-2.0 |
| AI | **Spring AI 1.1.2** + **Spring AI Alibaba 1.1.2.2**（可选编排）；DashScope 原生 starter 可选不默认；**不引** LangChain4j | Apache-2.0 |
| 工作流 | **Flowable 7.x**（引擎）+ **flowgram.ai**（画布，MIT） | Apache-2.0 / MIT |
| 文件存储 | 本地 / NAS / **S3 兼容**（MinIO、阿里云 OSS、腾讯 COS、七牛 Kodo）；备用 SeaweedFS | AGPL-3.0（MinIO，独立进程）/ 厂商协议 / Apache-2.0 |
| 可观测 | OpenTelemetry / Micrometer / 本地落盘 / SkyWalking（可选） | Apache-2.0 |
| 代码生成 | JavaPoet / FreeMarker | Apache-2.0 |
| XML 绑定 | Jakarta XML Binding 4.x | EPL-2.0 或 GPL-2.0+CPE（classpath 例外，商用可） |
| 测试 | JUnit 5 / Testcontainers（MIT）/ ArchUnit / REST Assured | EPL-2.0 / MIT / Apache-2.0 / Apache-2.0 |
| 驱动 | pgjdbc（BSD-2，用于 PG 及经厂商确认的金仓/海量）/ MariaDB Connector/J（LGPL-2.1，用于 MySQL）；达梦/金仓/海量官方驱动随项目交付 | — |

#### 6.5.4 ❌ 仍然禁用（D2 分发下不可用）

| 组件 | 原因 | 替代 |
|---|---|---|
| **XXL-Job**（v1 误推） | GPL-3.0 内嵌 JAR ⇒ 分发即传染，需开源全部应用代码 | **自研协议兼容执行器** `job-xxl`（仅 HTTP/JSON，不引依赖）；D1 内部自用可切官方实现 |
| **MySQL Connector/J** | GPL-2.0+FOSS，闭源分发需 Oracle 商业许可 | **MariaDB Connector/J**（LGPL-2.1） |
| **Camunda 8** | 专有，需商业许可 | **Flowable 7.x**（Apache-2.0） |

#### 6.5.5 ⚠️ 可用但建议替代（D2 放宽项）

| 组件 | 放宽理由 | 仍建议替代为 | 替代收益 |
|---|---|---|---|
| MinIO（AGPL-3.0） | 独立进程 + 不改源码 ⇒ 义务仅覆盖自身；**按需求采用**（D-28） | 备用 SeaweedFS（Apache-2.0） | 客户要求纯 Apache 栈时替换 |
| Redis 8.x（RSALv2/SSPL/AGPL） | 非 SaaS 不触发核心限制；平台只做客户端 | 交付优先 Redis ≤7.2 或 Valkey（BSD-3） | 免源码提供义务，协议完全兼容 |
| Elasticsearch（SSPL） | 非 SaaS 可用 | **OpenSearch**（Apache-2.0） | 无许可顾虑 |
| Grafana（AGPL-3.0） | 独立进程 + 提供源码 | SkyWalking UI / 自建看板 | 减少合规文档负担 |

> **合规交付物**：私有化交付需随包提供《第三方组件清单 + 许可证声明 + 源码获取指引》（SBOM，用 `license-maven-plugin` 生成）。这比"全面禁用 AGPL"更经济——详见架构篇 §10。

#### 6.5.6 ⚠️ 需采购/法务确认

达梦 DM JDBC、人大金仓 KingBase JDBC、海量 VastBase JDBC（厂商专有驱动，须随商业许可分发）；GraalVM Native（GPLv2+CE 可用，但与插件热加载互斥，**不建议** Native 化）。

### 6.6 非 SaaS 交付形态对架构的影响（新增）

平台定位为**私有化部署 / 内部部署**，带来 7 项约束，直接影响架构取舍：

| # | 约束 | 架构含义 |
|---|---|---|
| P1 | **客户内网、常无外网** | 依赖全自托管；镜像离线导入；AI 必须支持本地模型（Ollama/vLLM）；插件升级走**离线包** |
| P2 | **数据库是客户的**（达梦/金仓/海量/MySQL/PG 概率高） | 方言覆盖从"可选"升级为**硬需求**；DDL 兼容性风险最高 |
| P3 | **硬件规格不确定**（可能 4C8G） | 缓存规模必须可配且支持"全关"；不假设大内存；启动要快 |
| P4 | **升级窗口由客户给，且常要求不停机** | **这是热插拔诉求的真实动因** → 插件级 L1/L2 热更新优先级最高 |
| P5 | **可能 1~3 节点，不追求弹性伸缩** | 集群一致性可用最简方案（DB 轮询），不必强上 MQ / 注册中心 |
| P6 | **需要授权控制**（到期/节点数/模块许可） | 新增 `license` 系统插件（离线激活、模块级校验） |
| P7 | **可观测性不能依赖公网** | 日志/指标本地落盘；链路采样率可关；Prometheus 可选 |

> **关键结论**：非 SaaS 使**热插拔从"锦上添花"变成"交付刚需"**（P4），同时使集群复杂度下降（P5）、离线能力要求上升（P1）。

## 7. 组件映射表（含许可）

| .NET 现状 | Java 目标 | 许可 | 难度 |
|---|---|---|---|
| ASP.NET Core 中间件管线（17 步） | Spring Boot Filter/Interceptor + `SecurityFilterChain` | Apache-2.0 | 高 |
| Cookie Scheme `Cube` + JWT `UserToken` | 自研 JWT Filter（裸 token + 4 来源）+ Spring Security | Apache-2.0 | 高 |
| XCode `Meta`/`FieldItem`/`TableItem` | 自研元数据 Registry（JAXB 解析 XSD） | — | 极高 |
| `PageMetaBuilder`/`PageService`/`ToolbarBuilder` | 自研 `MetaBuilder`（键级规格见架构篇 §6.2） | — | 极高 |
| XCode DAL / `WhereExpression` | `Filters` 链式 API + `PageDialect` SPI | — | 高 |
| **分片路由**（`ShardModel`/`IShardPolicy`/`TimeShardPolicy`） | 自研 `ShardPolicy`（区间推导/条件裁剪/缺范围抛错/批量分组）+ 分片 DDL 懒建 | — | **高**（§5.7.3~5.7.6） |
| **跨分片查询**（`AutoShard`） | `ShardService.autoShard`（顺序执行 + 调用方聚合；**每分片分页不合并**） | — | 高 |
| **雪花 ID**（`IEntityOperate.Snow`） | `SnowflakeId`（41/10/12 兼容 + Redis workerId + 回拨策略） | — | 中高 |
| **读写分离**（`ReadWriteStrategy`） | `AbstractRoutingDataSource` + `{name}Readonly` 约定 | Apache-2.0 | 中 |
| **多库 ConnName** | `DataSourceRegistry` 按连接名路由（无跨库事务） | Apache-2.0 | 中 |
| **分片临时切换**（`EntitySplit`） | **不复刻**；`ShardScope` / 独立 `EntitySession` | — | 中 |
| EntityCache / SingleCache / FieldCache | Caffeine + `KernelBus` 分布式失效 | Apache-2.0 | 中 |
| 拦截器（Time/User/IP/Trace/DataScope） | `EntityHook` SPI | — | 中 |
| Migration 四档 | Liquibase `diff` API + 只读差异报告 | Apache-2.0 | 中 |
| 租户 `AsyncLocal` | `ThreadLocal` + `TransmittableThreadLocal` | Apache-2.0 | 中 |
| `NewLife.Office`（Excel/CSV/JSON/XML/ZIP） | FastExcel + 自研 CSV/JSON/XML/ZIP 通道 | Apache-2.0 | 中 |
| `NewLife.AI` + `/Ai/AiChat` SSE | **Spring AI 1.1.2 + Spring AI Alibaba 1.1.2.2** + 自研 SSE 契约层（`SseEmitter`）+ MCP server/client（§9.8） | Apache-2.0 | 中高 |
| `NewLife.Stardust`（APM） | OpenTelemetry + SkyWalking（`traceId` 对齐信封） | Apache-2.0 | 低 |
| Workflow（29 文件） | Flowable（语义差异需 P3 评估） | Apache-2.0 | 中高 |
| Widgets 工作台（28 文件） | 自研（布局 JSON + `/meta`） | — | 低 |
| 定时作业 `CronJobAttribute`+`JobService` | **内核 K15（自研 CubeCron + 抢占 + 历史）** + `job-ant` / `job-xxl` 插件 | MIT / 自研 | 中高 |
| 文件存储（本地/NAS/S3） | `storage` 插件：`ObjectStorage` SPI（local/nas/s3：MinIO、OSS、COS、Kodo） | AGPL-3.0（MinIO 独立进程）/ 厂商协议 | 中 |
| 模块加载（`ModuleManager`，仅启动期） | PF4J + **插件域**（依赖图/级联停用/离线包/授权） | Apache-2.0 | 极高 |
| 代码生成（XCodeTool） | 自研 `cube-codegen`（Maven 插件 + JavaPoet/FreeMarker） | Apache-2.0 | 极高 |
| 视图/列偏好（`ViewProfileModel` + Profile JSON） | `ViewEngine` + 三层覆盖（默认/模板/个人） | — | 高 |
| 自定义查询（`QueriesJson`） | `QueryStore` → 统一条件 DSL → `Filters`（**已由 ArcoVue 自定义/预定义查询交付**，后端只做存储与下推） | — | 中 |
| 查询表达式（`WhereExpression`） | `Filters` + 生成字段句柄 `Order.F`（编译期字段校验）+ JSON 符号别名归一（**前端 14 个 op 为权威集合**，架构篇 §5.2.1） | — | 中 |
| 运行态参数（`Parameter`） | `Parameter` 增强：四类用途（系统配置/LOV/共享查询/字典）× 四级作用域（Global/Tenant/Role/User），域级缓存失效（架构篇 §5.16） | — | 中 |
| 结构同步 / 建库 / 播种 | `SchemaSync`（四档 Migration）+ `DbProvider.databaseExists/createDatabase` + `SeedInitializer`（架构篇 §7.8.1、§5.11.5） | — | 高 |
| 系统升级 | 在线（默认）/离线双模：清单 + 兼容矩阵 + 签名 + dry-run + 备份点 + 失败回滚 + 审计（架构篇 §7.12） | — | 中高 |
| 异步批写 / 延迟队列 | `AsyncWriteQueue`（周期自适应、背压、afterCommit 入队）+ `DelayQueue`（架构篇 §5.17） | — | 中 |
| 填色（规则存 `ViewsJson`，前端求值） | **无后端引擎**（v4.3.1 核实：现状已实现） | — | 低 |
| 多级分组（前端组头行） | **无后端引擎**（筛选已服务端化） | — | 低 |
| 自动化（`EntityAutomationModel` + Worker） | **新增** `AutomationEngine`（DB 队列 + 幂等 + 重试） | — | 高 |
| 洞察面板（`DashboardJson` + Widget） | `WidgetRegistry` + `DatasetEngine` | — | 中高 |
| 工作台/看板（`WidgetLayout` + `Parameter`） | `BoardEngine` + 三层覆盖 | — | 中高 |
| 运行时监测（`RunTimeMiddleware`） | Micrometer + Filter + 慢 SQL 记录 | Apache-2.0 | 中 |
| APM（Stardust） | OpenTelemetry（W3C `traceparent`）+ SkyWalking 可选 | Apache-2.0 | 中 |
| 日志/审计（`XTrace` + `LogProvider`） | JSON 日志 + MDC + 审计表（带 `traceId`） | Apache-2.0 | 中 |
| 系统自检（`Admin/Index`、`Admin/Db`） | **新增** `cube-plugin-diagnostics`（链路/慢接口/错误聚合/JVM/插件健康） | — | 中高 |
| 单进程部署 | S/M/L 三档同一二进制 + `Dispatcher` 双实现 | Apache-2.0 | 极高 |

---

## 8. 工作量估算（重估）

### 8.1 内核平台化（v3.0 重估）

| 内核模块 | 人月 | 说明 |
|---|---:|---|
| K1 元数据模型 + **域级** Registry + 多版本/广播 | 3.5 | 字段级规格 + ShowIn 三语法 + 移植 XCode 测试用例 |
| K2 Model.xml DSL（JAXB + `cube:` 扩展 + 校验 + 规范化） | 含于 K3 | 直接绑定 `ModelSchema.xsd`；宽容模式 + 严格校验双轨 |
| K3 代码生成器 + 插件打包（含展现 DSL 解析/生成/种子数据） | **4.5** | v2.1 为 3.0，新增 DSL 解析与 shared 配置种子生成 |
| K4 通用数据访问引擎（Filters/方言/分页/拦截器/缓存/事务/**分片/雪花 ID/读写分离**） | 5.5 | 6 库方言 + 15 项状态外置 + **分片与雪花由"跟随"改为显式交付**（v4.3.2） |
| K5 通用 Web 层（路由/信封/绑定/`/meta`/导入导出/文件） | 3.5 | 契约等价主战场 |
| K7 插件域运行时（依赖图/生命周期/L1 启停/L2 热升级/回滚/离线包/授权/泄漏检测） | 4.5 | 颗粒度=插件包 |
| **K9 展现层引擎**（配置存取「模板 < 个人，整份覆盖」/ 保存查询 / 洞察聚合） | **4.5** | v4.3.1 核实：填色与分组是**前端已有能力**（后端零引擎），只复刻配置契约与 `Widget/Query` 聚合 |
| **K10 自动化引擎**（触发器/条件/动作/DB 队列/重试/幂等/审计） | **4.0** | 动作可插拔；无脚本 |
| **K10' 工作台/看板**（栅格布局/个人与公共/挂菜单/角色可见） | **2.5** | 复用 Widget 组件 |
| **K13 可观测与诊断**（TraceId/日志/指标/慢 SQL/**诊断插件**） | **3.5** | 含 `cube-plugin-diagnostics` |
| **K14 拆分就绪**（本地/远程双派发、分布式锁、事件传输、三档部署装配） | **2.0** | S/M/L 同一二进制 |
| **菜单自动生成**（生成层/覆盖层/差量/快照回滚） | **0.5** | §7.7 |
| **两级缓存**（L1 Caffeine + L2 Redis + 降级） | **0.5** | §5.5 |
| **K16 AI 就绪骨架**（ToolRegistry / AiContext / MCP server / SSE 契约基座 / 工具权限钩子） | **0.5** | §5.15（v4.3.3 新增） |
| **结构同步 `SchemaSync`**（正向读库 + 差异 + 6 方言 DDL + 建库 + 备份前哨 + 差异报告 + 迁移历史） | **1.0** | §7.8.1（v4.3.4 新增） |
| **参数中心**（`Parameter` 增强 + 四级作用域 + 域级失效 + 批量读取） | **0.5** | §5.16（v4.3.4 新增） |
| **在线升级通道**（清单 + 签名 + 灰度 + 断点续传 + 回滚，与离线共用流水线） | **0.5** | §7.12（v4.3.4 新增） |
| **异步读写**（`AsyncWriteQueue` + 虚拟线程读 + 观测端点） | **0.5** | §5.17（v4.3.4 新增） |
| **小计** | **42.0** | |

> K15 调度内核（1.5）不在此计，已并入 §8.2「作业/调度 5.0」，避免重复计算。

### 8.2 功能与业务迁移

| 子系统 | 人月 | 难度 |
|---|---:|---|
| 认证/令牌/MFA/Challenge/验证码/短信邮件/OAuth/SSO（**含 `sso`/`auth-third`/`usercenter` 三插件拆分**） | 5.5 | 极高 |
| 系统管理插件（admin 27 + cube 8 控制器） | 4.0 | 高 |
| 权限/菜单/角色/部门/租户/DataScope/访问规则 | 3.0 | 高 |
| 导入导出/模板/附件存储（`storage` 插件：local/nas/s3） | 2.5 | 中高 |
| 通知/告警/审计（告警规则引擎） | 1.2 | 高 |
| Workflow 插件（Flowable 集成 + 语义适配 + flowgram 编译） | 3.5 | 高 |
| AI 插件（SSE 契约 / MCP server·client / 动态工具与权限裁剪 / 模型配置热切换 / 本地模型 / 审计配额） | 3.5 | 高 |
| 作业/调度（K15 内核 + AntJob 迁移 + XXL 协议插件） | 5.0 | 中高 |
| CubeDemo 插件化（拆为 `demo-*` 插件 + 拆除验证） | 0.5 | 低 |
| **小计** | **28.7** | |

> 注：视图/查询/填色/分组/洞察/看板/自动化**不再计入功能迁移**，全部上移到内核 K9/K10（因为它们是"平台能力"，不是"某个业务模块"）。

### 8.3 回归与总额（v4.3.1 收口）

| 项 | 人月 | 变化 |
|---|---:|---|
| 内核平台化 | **47.5** | 含 DB 配置式切换 2.0、L2 生产硬化 2.0、日志双落点 1.5、SkyWalking 1.0、MQ 双实现 1.5；**v4.3 新增 菜单 0.5 + 缓存 0.5**；**v4.3.1 K9 7.0→4.5**；**v4.3.2 K4 4.5→5.5**；**v4.3.3 新增 K16 AI 就绪 0.5**；**v4.3.4 新增 结构同步 1.0 + 参数中心 0.5 + 在线升级 0.5 + 异步写 0.5** |
| 功能与业务（NewLife.Cube 自身 + CubeDemo） | **31.7** | 含自助配置对象后端 3.0；**v4.3 新增 作业/调度 4.0 / 存储 1.0 / 工作流 1.5 / CubeDemo 插件化 0.5**；**v4.3.3 AI 3.0→3.5**；**v4.3.4 认证插件拆分 5.0→5.5** |
| `cube-migrate` MVP（迁平台自身） | **+1.0** | 决策 4：转正式交付 |
| 运维 / 交付（仅内嵌 Tomcat，无 war profile） | 1.0 | 决策 6：−0.5 |
| 契约回归（L1/L2/L3 + P/Z/D + DB/MQ/日志/L2 + **调度/存储/缓存/菜单/工作流/结构同步/参数/升级/异步/认证插件专项**） | **12.0** | 含 CubeDemo 全量验收；v4.3 新增 5 类专项 +1.0（v4.3.4 六组新验收已在同一回归包内摊销） |
| **合计** | **≈ 93** | v4.2 的 83 **+ 10**（v4.3 +8、v4.3.1 −3、v4.3.2 +1、v4.3.3 +1、v4.3.4 +3，见下） |

> 分层口径合计 93.2，与模块口径 93 的差异为取整缓冲。
> **v4.3 增量构成**：内核 +1.0（菜单 0.5 + 缓存 0.5）、功能 +7.0（作业 4.0 + 存储 1.0 + 工作流 1.5 + CubeDemo 0.5）、回归 +1.0、**扣除原"AntJob 试点 +1.5"**（试点转交付，投入已并入作业/调度 5.0）→ 净 **+7.5 ≈ +8**。
> **v4.3.1 复核下调**：K9 展现层 7.0 → 4.5（**−2.5**：填色规则引擎与 GroupEngine 均无后端需求），合计 91 → 88；MVP 口径不受影响（K9 不在 MVP 基座内）。
> **v4.3.2 上调**：K4 4.5 → 5.5（**+1.0**：分片与雪花 ID 由"跟随"改为显式交付，含历史分片兼容与 SHARD/ID 验收），合计 88 → **89**，MVP 51 → **52**。
> **v4.3.3 上调**：K16 AI 就绪内核 **+0.5**（工具注册表 / AiContext / MCP server / SSE 契约基座进 P1）、`ai` 插件 3.0 → 3.5（**+0.5**：MCP server·client + 工具权限裁剪 + 契约回归），合计 89 → **90**，MVP 52 → **53**（K16 骨架在 MVP 基座内）。
> **v4.3.4 上调**：结构同步 `SchemaSync` **+1.0**、参数中心 **+0.5**、在线升级通道 **+0.5**、异步读写 **+0.5**、认证插件拆分 **+0.5**，合计 90 → **93**；MVP 53 → **55**（结构同步 / 参数中心 / 异步写属基座必需，在线升级与认证插件拆分属 P3 交付但计入总盘）。

#### 分层交付与 MVP 口径

| 层 | 内容 | 人月 | 建议 |
|---|---|---:|---|
| **MVP 基座** | K1/K3/K4(基本)+**分片与雪花(基本)**/K5/K7(含基本 L2)/K14(基本) + K13 骨架 + **K15 调度** + **菜单自动生成** + **两级缓存** + **`SchemaSync` + 自动建库建表播种** + **`Parameter` 参数中心** + **异步批写队列** + **`storage` 插件** + **K16 AI 就绪骨架** + 认证 + 权限 + 系统管理 + 导入导出 + i18n + 运维 + 基础回归 | **≈ 55** | **先上线** |
| 展现增强 | K9 配置契约（视图/查询/仪表盘/工作台 + Widget 聚合）+ K10' 看板 | 7.0 | P2 |
| 自助配置对象 | UserProfile/ViewProfile/Workbench/Widget/EntityComment/Inbox/Lov/Attachment/AI 配置 | 3.0 | P2 |
| 数据库配置化 | DbProvider SPI + 驱动外置 + 2 库实测（6 库收敛后） | 2.0 | P2 |
| MQ 双实现 | RabbitMQ + RocketMQ（Kafka/ActiveMQ 仅留 SPI） | 1.5 | P2 |
| `cube-migrate` MVP | scan/model/ctrl/report | 1.0 | P2 |
| 生产级 L2 | H1~H8 | 2.0 | P3 |
| 自动化 | K10 | 4.0 | P3 |
| 诊断 + 日志双落点 + SkyWalking | K13 完整 | 6.0 | P3 |
| 回归增强 | DB/MQ/日志/L2/调度/存储/缓存/菜单/工作流专项 | 6.0 | 随阶段 |
| AntJob 迁移（`job-ant`） | Server/Agent/Data/Provider 全量 + 缺口清单 | 3.0 | P3 |
| 工作流（Flowable + flowgram） | 引擎集成 + 语义适配 + 编译器 | 3.5 | P3 |
| **AI 插件完整（`ai`）** | SSE 契约 + MCP server·client + 动态工具与权限 + 模型热切换 + 本地模型 + 审计配额 | 3.5 | P2 骨架 / P4 完整 |

#### 估算版本溯源

| 版本 | 平台侧人月 | 主要差异 |
|---|---:|---|
| v1 | 40 | 无平台化 |
| v2.1 | 52 | +内核平台化 |
| v3.0 | 71 | +展现层 + 自动化 + 可观测 + DSL |
| v4.0 | 85 | +DB 配置化 + MQ + L2 硬化 + 自助配置 + 日志 + SkyWalking + 迁移工具链 |
| v4.1 | 81 | 收敛为平台 + CubeDemo，剔除下游迁移 |
| v4.2 | 83 | +AntJob 试点 + cube-migrate 转正 + MQ 双实现收敛 |
| **v4.3** | **91** | **+调度自持（K15/AntJob/XXL 协议）+ 存储插件 + 工作流 Flowable/flowgram + 菜单自动生成 + 两级缓存 + 6 库收敛 + 新增专项回归** |
| **v4.3.1** | **88** | **§9.6 复核：零代码展现 7 项已全部实现 → K9 7.0→4.5（−2.5），取消“补齐填色/分组”** |
| **v4.3.2** | **89** | **+分库分表/雪花 ID/读写分离显式交付（K4 4.5→5.5），新增 SHARD-1~7 / ID-1~4** |
| **v4.3.3** | **90** | **+AI 就绪（K16 0.5 进 P1）与 `ai` 插件 3.0→3.5，新增 AI-1~AI-7** |
| **v4.3.4** | **93** | **+自动结构同步 1.0 / 参数中心 0.5 / 在线升级 0.5 / 异步读写 0.5 / 认证插件拆分 0.5；新增 SCHEMA·INIT·PARAM·UP·ASYNC·AUTH-P 六组验收** |

### 8.4 团队配置

| 配置 | 排期（平台侧 93 人月） | 说明 |
|---|---|---|
| 6 人（5 后端 + 1 契约/测试） | 17 个月 | 下限 |
| 7 人（6 后端 + 1 契约/测试） | 14~15 个月 | 推荐：内核可 3 线并行（元数据+数据/展现层/插件+可观测） |
| 6 人 + AI 辅助 + P0 前置 | 12~13 个月 | 风险集中在契约、展现 DSL、调度语义与工作流适配 |

**技能结构**：①元数据/数据引擎骨干 2 人；②插件运行时 + 拆分就绪 1 人；③展现层 + 自助配置 1 人；④认证权限 + 系统插件 1 人；⑤**可观测/APM + 诊断插件 1 人（必需，不可兼任）**；⑥契约与自动化测试 1 人。

**AntJob 迁移**：P3 阶段由 1~2 人承担（需深度理解平台能力，外包不合适）；与 K15 调度内核同一小组负责，避免"作业语义两套口径"。

### 8.5 与其他方案的横向对比

| 方案 | 人月 | 说明 |
|---|---:|---|
| A 全量重写（无平台化） | ~45 | G1/G5/G6/G7 均不满足 |
| B 契约优先（无插件化/无 Model.xml） | ~48 | 同上 |
| C 内核复用（.NET 内核 + Java 新增） | 6~10 | 与决策 4（不保留 .NET）冲突 |
| D 边界隔离 | 1~3 | 与决策 4 冲突 |
| **E 契约优先 + 微内核平台化**（推荐） | **平台 ≈ 93** | 满足 G1~G7 与 41 项决策（范围 = 平台 + CubeDemo 插件集 + AntJob 迁移） |

## 9. 动机达成度分析

### 9.1 技术栈统一 — ✅ 达成

单一语言栈、招聘与协作成本下降。代价是放弃 `NewLife.Core/XCode/Office/Remoting`，需自建等价物（已计入 §8.1）。

### 9.2 信创国产化 — ✅ 平台能力覆盖，**验收不含具体国产库**

**决策**：信创中间件（TongWeb/Apusic 等）不在验收范围；达梦/金仓/海量**不采购**，由具体项目交付时接入。

| 项 | v4.0 结论 |
|---|---|
| 应用服务器 | **仅内嵌 Tomcat**（Apache-2.0，商用安全、轻量、免运维）；**明确不做 war 外置容器部署**（决策 6），故无 TongWeb/Apusic 适配与验收工作 |
| 数据库 | 平台提供**配置式替换**（`DbProvider` SPI + 驱动外置加载 + 方言能力矩阵 + 方言自检），**只做 6 种**：SQLite / MySQL / PostgreSQL / 金仓 KingBase / 海量 VastBase / 达梦 DM（v4.3 已排除 SQL Server / Oracle / DB2 / 瀚高） |
| 驱动与许可 | 厂商驱动**不打包进主包**，由具体项目提供 `plugins/drivers/*.jar`；主包缺失驱动时延迟失败、不影响其他数据源 |
| 实测边界 | 平台研发期用 **MySQL + PostgreSQL（或 SQLite）** 验证 SPI 完备性；国产库实测在**首个国产化项目**内完成，平台提供"实测清单与自检工具" |

**增益判断（修正 v2.1）**：换 Java 的国产化增益**主要在应用服务器与 OS 层**（Java 生态对外置容器的适配面更广），数据库层增益有限（XCode 已支持达梦/金仓）。但**"配置式切换"本身是真实增益**——同一套代码可交付到不同数据库的客户。

**P2 必须完成**：`DbProvider` SPI + 驱动外置 + 方言自检 + 至少 2 库实测（DB-1~DB-4）。
**项目交付时补做**：目标库实测 + 方言差异修正 + 客户 DBA 联合验证。

### 9.3 微服务化 / 水平扩展 — ✅ **可达成，但必须第一天就按拆分就绪设计**

> v2.1 的判断是"换语言不会自动带来水平扩展"。v3.0 保留这个判断，但**把解法内建进微内核**：拆分能力不靠后期改造，而是从内核 API 形状、插件边界、数据访问规则上就位。

#### 9.3.1 三档部署形态（同一份二进制）

| 形态 | 适用规模 | 进程拓扑 | 必须组件 | 可选组件 | 配置 |
|---|---|---|---|---|---|
| **S 单机** | 小项目/试点/≤200 并发 | 1 进程（内核 + 全部插件） | DB + 本地磁盘 | 无 | `cube.deploy.mode=monolith` |
| **M 集群** | 中型/2~5 节点 | N 个同构进程 | DB + **Redis（L2 缓存/锁/队列）** + **内核 K15 调度（DB 抢占）** | `job-ant` 集群、Nacos、网关 | `cube.deploy.mode=cluster` |
| **L 微服务** | 大型/按模块伸缩 | 内核（对称）+ 卫星服务 | Nacos + 网关 + **MQ（RabbitMQ 4.4.x / RocketMQ 5.5.x，按客户配置）** + 每服务独立 schema | 独立调度集群 | `cube.deploy.mode=distributed` |

**"小项目像单体一样简单"的保证**：
- S 档 = 一个 jar + 一个 DB，无 Redis、无 Nacos、无网关、无 MQ
- 插件全部 in-process 加载，`Dispatcher` 走本地实现
- 启动自检自动选择方言、自动建表（Migration `On` 档）、缓存可全关
- 交付物 = 安装包 + 授权文件，客户双击脚本即可

**"大项目能水平扩展"的保证**：
- 插件边界 = 未来服务边界；跨插件只经 `ExtensionPoint` / `KernelBus`，本地方案与远程方案**同一接口**
- 切换只需把 `LocalDispatcher` 换成 `RemoteDispatcher`（RPC/MQ）+ 打开网关路由
- 卫星服务拆分优先级：`ai` / `job-ant` / `storage`+`file` / `workflow` / `notify` 可独立拆；`admin` / `perm` / 内核保持对称部署

#### 9.3.2 十条拆分就绪规则（从第一行代码就遵守）

| # | 规则 | 后果（若不遵守） |
|---|---|---|
| S1 | 跨插件只经 ExtensionPoint / KernelBus | 拆不动，只能整包搬 |
| S2 | **禁止跨域 JOIN**（单体里也禁） | 拆分后查询断裂 |
| S3 | 无共享内存假设（缓存/锁/会话/事件全经 Provider） | 多副本数据错乱 |
| S4 | 每个 ExtensionPoint 有本地/远程双实现 + 同一套契约测试 | 切远程时行为漂移 |
| S5 | 进程无状态（不写本地文件、无节点亲和） | 无法水平扩容 |
| S6 | 跨域事件消费幂等（携带 `eventId` + 位点） | 重复消费导致数据错 |
| S7 | 分布式 ID（雪花） | ID 冲突 |
| S8 | 单域本地事务 + 跨域事件补偿（**不引 Seata**） | 分布式事务复杂度爆炸 |
| S9 | `traceparent` 全链路传播 | 拆分后无法定位问题（与 §9.7 联动） |
| S10 | 配置外置（统一 `CubeConfig`） | 改配置要重打包 |

> 规则的门禁手段：ArchUnit（S1/S3/S5）、SQL 静态检查（S2）、契约测试双跑（S4）、事件 SDK（S6）、拦截器（S9）。**这些门禁在 P1 就接入 CI**，而不是等到 L 档。

#### 9.3.3 六项旧阻塞点的解法（v2.1 已列，此处给落点）

| # | 阻塞点 | 解决（S/M/L 通用） |
|---|---|---|
| 1 | 全表实体缓存 | Caffeine + 域级广播失效；缓存可全关 |
| 2 | 单对象缓存 | 同上 |
| 3 | 进程内定时作业 | S 档内置单节点调度；M/L 档 K15 内核 + DB 行级抢占（或 Redis 锁） |
| 4 | 数据保护密钥环 | 共享密钥环（DB / Redis） |
| 5 | 本地文件存储 | 本地盘（S）→ NAS → 对象存储（L），存储 SPI 抽象 |
| 6 | SSE / AI 长连接 | 网关粘性（L）或单点部署 AI 插件（M） |

### 9.4 插件化 / 微内核热插拔（新需求）— ✅ 可达成，**颗粒度 = 插件包**

**颗粒度定义**（本次纠偏）：一次热插拔操作 = 一个插件包（含 N 个实体 + N 条路由 + 菜单 + 权限位 + 作业 + 前端资源 + DB 迁移）。内核**不提供**单实体/单字段/单路由的公开热注册通道。

| 级别 | 能力 | 耗时 | 生产建议 |
|---|---|---|---|
| **L1 热启用/停用** | 不重启开关插件（路由/菜单/权限/作业全部同步生效或失效） | 秒级 | ✅ **默认采用** |
| **L2 热升级** | 同插件 in-place 替换（stop → unload → load(new) → start），失败自动回滚 | 秒~十秒 | ✅ 可选（`plugin.hot-upgrade=true`） |
| **L3 滚动替换** | 集群逐节点替换，业务无感 | 分钟级 | ✅ 兜底（跨主版本/依赖变更/内核 API 变更强制） |

**为什么不做单实体热注册**（三条硬理由）

1. **类加载隔离要求同生共死**：`Order.class`/`OrderBiz.class` 在插件 ClassLoader 中，只卸载元数据会残留引用、阻止 ClassLoader 回收 → Metaspace 泄漏。
2. **事务性**：整包注册失败可整包回滚；单条注册中途失败会留下"有元数据无路由""有路由无权限"的不一致状态。
3. **心智一致**：XCode/Cube 中业务模块 = 一个程序集（含多个实体），保持"一个插件包 = 一个业务模块"。

**代价（自觉取舍）**：新增一个实体需重装插件（L1 场景下为秒级）。换取的是可靠性与可维护性（架构篇 ADR-05）。

**配套能力**（缺一不可，否则"热插拔"名存实亡）

| 能力 | 说明 |
|---|---|
| 插件依赖图 | 拓扑排序 + 环检测 + 版本区间求交；系统插件不得依赖业务插件 |
| 级联停用 | 停用被依赖插件时，依赖方**必须一并停**，避免半可用状态 |
| 停用语义 | `enable` / `disable`（数据保留、路由 503、菜单隐藏）/ `uninstall`（保数据）/ `purge`（危险） |
| 在途业务策略 | `block` / `readonly` / `drain`（workflow 默认 `drain`） |
| 离线升级包 | 私有化交付必需（客户内网无外网） |
| 授权插件 | 到期/节点数/模块许可，离线激活 |
| 卸载纪律 | `DisposableRegistry` + ArchUnit 禁 `Executors`/静态非 final + 弱引用哨兵检测 |

### 9.5 Model.xml 单一事实源（新需求）— ✅ 可达成

- 编译期：`Model.xml` → 9 类生成物（含"生成一次不覆盖"的 `XxxBiz.java`，1:1 对应 `.Biz.cs`）
- 运行期：**以插件包为单位**安装/升级（`配置型插件` = 只含 Model.xml，无需 Java 代码）→ 插件域原子注册 → **零编译即得 CRUD + `/meta`**；不提供「单个 Model.xml 热注册单实体」的通道
- 覆盖度：**80~90% 场景只需 Model.xml**，10~20% 经 `XxxBiz`、`XxxController` 或插件扩展（与魔方理念一致）
- **运行期结构（D-38）**：插件安装/更新时内核执行**自动结构同步**——`Model.xml` → 期望结构 vs 库实际结构 → 差异 DDL（建库/建表/加列/改列/删列/加减索引全 11 类操作），四档 `Migration`（`Off`/`ReadOnly`/`On`/`Full`，默认 `On`，**表级只能收紧**），改结构前自动备份；**部署与开发人员不跑 DDL 脚本**。这直接对齐 XCode 的"改完 Model.xml 重启即生效"体验（原方案只规划了脚本迁移，属于倒退，v4.3.4 已纠正）
- **运行期初始化（D-41）**：默认 SQLite 单文件库；首次运行或切到空库时自动**建库 → 建表 → 播种**（内核 → 系统插件 → 业务插件，`cube_schema_history` 保证幂等）
- 生成物覆盖策略（D-37）：数据类/DTO/接口**每次覆盖**；`XxxBiz.java` 与 `XxxController.java` **存在即跳过**（后者含 `Search` 业务代码，与 Cube 生成器实测行为一致）；并提供平台 → 项目 → 插件**三级泛型基类链**
- 详见架构篇 §4.3/§4.4/§4.6、§7.8.1、§5.11.5

---

### 9.6 零代码展现能力（新要求 C1）— ✅ **已全部实现**（v4.3.1 核实修正）

> **核实依据（2026-11-13）**：`NewLife.Cube.ArcoVue/ArcoVue企业中后台迁移方案.md` §3.1 能力矩阵 / §7.4 多维视图完成度 / §8.5 工作台·仪表盘·流程 / §10.3 里程碑 / §10.4 代码审查结论；`NewLife.Cube.ArcoVue/openspec/changes/archive/` 下 OSC-0005/0006/0012/0015/0016/0019、260815fa86、26081903c0、2608280e9e、26082815a1、260830a1b2、260902ef43、26092694a1、260926c2b8、261004d7f4、26100514b7；后端 `NewLife.Cube/Controllers/{CubeController(ViewProfile),WorkbenchController,WidgetController,AutomationController}.cs`。
> **结论变更**：v4.2 的"5 项复刻 + 2 项（填色/分组）补齐"**已过期**——7 项能力在 .NET + ArcoVue **全部已交付**，缺口不存在。

#### 9.6.1 现状核对（逐项给实现载体与归属）

| 能力 | 已实现载体 | 归属 | 零代码程度 |
|---|---|---|---|
| 多维视图（七种） | `ViewProfile.ViewsJson/ColumnsJson/CardJson/FormJson`；table/tree/card/kanban/calendar/gantt/**map**（OSC-0005/0006/0019/261004d7f4） | 配置存后端 + **渲染在前端** | 全配置 |
| 自定义查询 | `QueriesJson` v2 + 工具栏"查询簇"；筛选经 `viewFilter`（`logic` + `conditions`）**尽力下推**，任一条件不可翻译则整段放弃下推、前端 `matchesViewFilter` 兜底；排序 `sorts` ≤3 列服务端（白名单，非法 400）（OSC-0016、260830a1b2、26092694a1） | 后端执行 + 前端编辑 | 全配置 |
| 条件填色 | 规则存当前命名视图 `ViewsJson`（≤50 条单条件；单元格 / 行侧边 / 整行 / 整列），**前端求值**（OSC-26081903c0） | **纯前端** | 全配置 |
| 多级分组 | 表格内组头行（≤3 级、可折叠）+ 甘特按字段只读分组（OSC-0015、26092694a1） | **前端分组**（筛选已服务端化） | 全配置 |
| 页面洞察面板 | `ViewProfile.DashboardJson` + `POST /Cube/Widget/Query`（count/sum/avg/min/max/**group**，走数据权限与租户条件，不可翻译→400）+ `Sources`/`Catalog`/`Data`（OSC-2608280e9e） | **后端聚合** + 前端渲染 | 全配置 |
| 首页 / 命名工作台 | `UserProfile.HomeJson` > 主角色 `Parameter(Workbench.Role)` > 系统种子；`PUT /Cube/Workbench`、`/Role/{id}`；命名工作台 `Parameter(Workbench.Named)` + 发布自动挂菜单（OSC-26082815a1、260902ef43） | 后端 | 布局零代码 |
| 实体自动化 | `EntityAutomation.GraphJson(nodes/edges)` + 执行器 + 异步队列 + 站内信/邮件/短信/钉钉/企微；触发器 insert/update/delete/fieldChange/schedule/webhook/manual；条件 JSON 与 `ViewFilter` 同构（OSC-260815fa86） | 后端 | 全配置 |

> **Java 侧定位**：不是"补齐"，而是**契约复刻**——①配置容器（Profile/Parameter 读写）②筛选下推（`Filters`）③**Widget 聚合/分组查询**（唯一需要后端计算能力的项，.NET 已有）④自动化执行器；**条件填色与表格分组完全在前端，后端零工作量**。

#### 9.6.2 v4.3.4 复核补记（复杂查询 / `ViewProfile` 契约）

| 复核项 | 事实（源码为证） | 对方案的影响 |
|---|---|---|
| **复杂业务查询是否仍需大量业务代码** | 不需要：`QueriesJson` v2（`{version:2, queries:[{id,name,q,filter}]}`）+ 14 个 `op` 的条件构建器，已覆盖"条件组合 + 保存 + 共享 + 跨设备恢复"；排序 `sorts` ≤3 服务端白名单，非白名单 400 | 架构篇 §4.6 原先把"复杂业务查询"整体划给业务代码属**过度保守**，已改为"通用条件组合零代码，业务只接跨表/聚合/游标" |
| **`ViewProfile` 字段是否有 `Name`/`SortsJson`** | **没有**。实体实际列：`Id/UserId/TypePath/View/ColumnsJson/ViewsJson/ActiveViewId/ActiveQueryId/GanttJson/CardJson/FiltersJson/QueriesJson/PageSize/FormJson/DashboardJson/Version` + 6 个审计列 + `Remark`；唯一索引 `IU_ViewProfile_UserId_TypePath`；排序在 `ViewsJson[].sorts` | 架构篇 §12.2.1 的字段清单已修正；避免按"想象中的表结构"建库导致前端配置读不出来 |
| **JSON 子契约的宽容/丢弃规则** | 前端 `viewProfile.ts` 对非法值**丢弃而不报错**、未知顶层属性存 `_raw` round-trip 保留、`allowViewDetail`/`allowDelete` 已废弃仍归一化、`chartOption` ≤32KB 且保存前剔除运行时数据 | 后端 Jackson 必须宽容 + 服务端再校验；**round-trip 字节级稳定**进契约基线 |
| **`Parameter` 与 `ViewProfile` 的职责边界** | 现状 `Parameter` 已被用于工作台角色层与 AI 配置；`ViewProfile` 专管布局 | 架构篇 §5.16 明确"布局归 `ViewProfile`、全局共享运行态数据归 `Parameter`"，禁止双写 |

#### 9.6.2 Java 侧方案（与现状对齐，详见架构篇 §5.9 / §5.10）

| 设计 | 内容 |
|---|---|
| **权威源** | **库为唯一权威**（`UserProfile`/`ViewProfile`/`Parameter`），与现状一致；`Model.xml` 的 `cube:Presentation` 文件化 DSL **降级为可选增强（默认不做）**——避免"文件 + 库"双源漂移，且前端已有可视化编辑器 |
| **共享筛选 schema** | 一套 JSON（`logic: all\|any` + `ops`）同时服务：列表筛选（下推）、保存查询、自动化条件、Widget 过滤——**与前端 `matchesViewFilter` 语义对齐**（OSC-0015 / 260815fa86 已如此定义） |
| **安全边界** | 无脚本、无方法调用；字段/操作符白名单；聚合仅 `count/sum/avg/min/max/group`。**筛选下推语义分两种**：①列表筛选——白名单（GetPage search∪list）内尽力下推，**任一条件不可翻译则整段放弃下推**（前端兜底，与 .NET 一致，不得 500）；②Widget 聚合——不可翻译直接 **400**（禁止前端假聚合） |
| **三层覆盖** | 视图：全局模板（`UserId=0`）< 个人；工作台：用户 > 主角色 > 系统；**沿用现状，不新增租户层** |
| **零新增前端契约** | 端点沿用 §12.2 的 11 类对象；**不在 `/meta` 新增** `views/queries/insights` 键（前端不从 `/meta` 取这些） |
| **前端零改动** | 填色 / 分组 / 七视图渲染复用 ArcoVue 现有实现 |

#### 9.6.3 关键能力落点

| 能力 | Java 侧 | 说明 |
|---|---|---|
| 多维视图 | `ViewConfigStore` | 只做配置存取与**整份覆盖**（模板 `UserId=0` < 个人），不做逐字段深合并；不渲染、不推断视图语义 |
| 自定义查询 | `QueryStore` + `Filters` | `QueriesJson` 原样存取；执行时编译为 `Filters`；不可翻译的条件**整段放弃下推**（前端兜底） |
| 条件填色 | **无后端引擎** | `ViewsJson.colors` 原样透传，求值在前端 |
| 多级分组 | **无后端引擎** | 分组在前端；后端只保证筛选/排序正确下推 |
| 页面洞察面板 | `WidgetQueryService` | count/sum/avg/min/max/group + 数据权限 + 租户 Where + 时间分桶（6 库方言） |
| 首页 / 命名工作台 | `WorkbenchStore` | user>role>system 读取；发布时 upsert 槽 + 菜单（`Sort` 顶置） |
| 自动化 | `AutomationEngine` | GraphJson 执行 + DB 队列 + 幂等 + 通知渠道 |

**可选增强（不在对齐范围，默认不做）**：服务端分组与组内聚合（超大数据量场景）、`cube:Presentation` 文件化 DSL、`/meta` 扩展键下发。需要时单独立项，不与"复刻"混做。

#### 9.6.4 表述边界（避免过度承诺）

- **不承诺** .NET 侧不存在的后端能力：服务端填色求值、服务端表格分组、字段矩阵 ACL（BE-B2 仍开放）
- **不承诺** i18n（现状 0 实现，矩阵 P0 残留）与组件测试（现状 `.spec.ts` 134 个纯逻辑测试、组件测试 0、Playwright 6）
- **不承诺** 日历议程、卡片画册布局（现状开放 / 已撤回）、甘特依赖线、视图 Tab 拖序
- 填色与分组既在前端求值，**其性能与注入风险随之前移到前端**；后端只需保证筛选可翻译且参数化（见 R21 修订）
- 现状未归档的只剩 **OSC-0018（实体界面自定义设计方案，纯文档 + 技能蓝图，仍 Draft）** 与 OSC-0011 收口——二者都**不影响**上述 7 项能力清单

### 9.7 可观测与诊断（新要求 C3）— ✅ 内建，且**不依赖外部 APM**

#### 9.7.1 现状基线（.NET 侧已有）

| 能力 | 现状 | 缺口 |
|---|---|---|
| `traceId` | 响应信封已有 `traceId`（`DefaultSpan.Current.TraceId`）；审计 `Log.TraceId` 可跳 Stardust | 未证实全入口解析 W3C `traceparent` |
| 请求耗时 | `RunTimeMiddleware`（Stopwatch + SQL 次数），请求级不落库 | 无指标导出、无慢接口排行 |
| 慢 SQL | `TraceSQLTime` 默认 1000ms，写日志文件（`SQLPath`），`SQLMaxLength` 4096 截断 | 无聚合表、无参数脱敏结构化字段 |
| 日志 | `XTrace` + 文件 | 非结构化、无统一 MDC 字段 |
| APM | Stardust | 私有化现场常无该平台 |
| 监控 | `Admin/Index` 返回 CPU/内存快照 | 无 GC/线程/连接池、无 Prometheus |

#### 9.7.2 Java 侧要求（从 P1 就上）

| 项 | 要求 |
|---|---|
| **TraceId 契约** | 无上游则生成 32 位 hex；**入站解析 `traceparent`，出站注入**；信封字段名与格式不变；日志 MDC/审计/诊断三处一致 |
| 日志 | JSON 结构化 + 固定 MDC 键（`traceId/spanId/userId/tenantId/pluginId/route`）；分级采样；敏感脱敏 |
| 指标 | Micrometer：HTTP、DB 池、缓存、JVM(堆/GC/线程)、自动化队列、插件状态、慢 SQL 计数 |
| 慢 SQL | 等价 `TraceSQLTime`（默认 1000ms）+ 参数脱敏 + 可选聚合表供 TOP N |
| **诊断插件** | `cube-plugin-diagnostics`：链路检索、慢接口 TOP、错误聚合、慢 SQL 排行、JVM/线程 dump、连接池、插件与元数据一致性、审计查询；**复用 Admin 列表页渲染，零额外前端开发** |
| 告警 | 阈值/突增/连续失败/心跳缺失；去重 + 静默窗口；渠道：站内/邮件/Webhook/钉钉/企微 |
| 外部对接（可选） | OTLP→OTel Collector、SkyWalking、Prometheus+Grafana；**关掉它们后内置诊断必须独立可用** |
| 开销 | 默认低开销；观测开启后吞吐下降 < 5%；诊断端点独立权限位 + 自身访问审计 |

#### 9.7.3 Trace 可插拔与日志双落点（决策 14/15）

**Trace Provider 可插拔**

| provider | 行为 |
|---|---|
| **`none`（默认）** | **仍生成 `traceId`**（信封硬契约）+ 写日志 MDC；**不建 Span、不上报、不加载 Agent** |
| `skywalking` | SkyWalking Java Agent / OTel Bridge → SkyWalking OAP |
| `otlp` | OTel SDK → OTLP Collector |

> **关键**：`traceId` 的**生成**与 Span **上报**解耦。客户不使用 APM 时仍能靠 `traceId` 把日志、审计、诊断面板串起来；只有采集与上报被关闭。若把 `traceId` 也关掉，会破坏信封契约（前端/外部客户端已在消费）。

**日志与审计双落点**（对齐 NewLife.Core 的 `XTrace` + `CompositeLog` + `LogProvider` 设计）

| 落点 | 实现 | 说明 |
|---|---|---|
| 硬盘（默认） | Logback `RollingFileAppender` + `SizeAndTimeBasedRollingPolicy` | UTF-8；按 `{app}/{node}/{level}` 分层；`max-bytes`/`backups`/`retention-days` 可配；路径可指向客户任意盘 |
| 客户数据库 | 自研 `DbLogWriter`（**异步批量 INSERT**，非 Logback DBAppender） | 有界队列 + 批量 + 重试 + 队列满降级写补偿文件 + 告警；**绝不阻塞业务线程** |
| 配置 | `cube.obs.log.sink = file | db | both`；审计数据源可独立（指向客户审计库） | 审计**必落库**、不可篡改（应用层禁 UPDATE/DELETE）；运行日志默认只落盘 |

**审计表字段对齐**：`Category/Action/Success/UserName/CreateUser/CreateUserID/CreateIP/CreateTime/Remark/TraceId/LinkId` + 租户 ID + 插件 ID；索引 `CreateTime`、`TraceId`、`(CreateUserID,CreateTime)`、`(Category,CreateTime)`。
**保留与清理**：文件按 `backups`/`retention-days` 自清；数据库由 K15 调度按合同保留期清理。

#### 9.7.4 为什么必须"一开始就有"

1. **私有化现场的常态是"无外网 + 无 APM + 无专职运维"**，事后补埋点意味着要重跑全部业务路径；
2. `traceId` 已在**响应信封契约**里（前端/客户端已在用），一旦后期改传播方式就会破坏契约；
3. 拆分（L 档）后跨进程定位问题**只能**靠 `traceparent` 传播，晚补等于重做链路；
4. 诊断能力是"交付质量"的一部分，直接影响客户现场的问题响应时间。

### 9.8 AI 就绪与 Spring AI Alibaba 替代评估（新要求）— ✅ **可行（分层替代）**

> 需求：①平台**从迁移之初就要 AI 就绪**；②评估 **Spring AI Alibaba** 替代 `NewLife.AI` 的可行性，可行则直接并入方案。
> 核实依据：`NewLife.AI/Doc/{架构设计,MCP架构,功能清单,模型供应商多模态能力矩阵}.md`；`NewLife.Cube/AI/*`（18 个文件：`AiController`/`AIService`/`AIPlugin`/`CubeTools`/`BrowserToolService`/`Checkpoint` 等）；`alibaba/spring-ai-alibaba` 主仓 `pom.xml` + `spring-ai-alibaba-bom` + README；`spring-projects/spring-ai` 的 `starters/` 与 `mcp/` 清单。

#### 9.8.1 结论

| 判断 | 结论 |
|---|---|
| 能否替代 `NewLife.AI` | ✅ **可以**，但只能**分层替代**，不能整体照搬：**Spring AI（核心）+ Spring AI Alibaba（可选编排）+ Cube 自研薄层（契约/权限/审计）** |
| 覆盖度 | 核心面（对话/流式/工具调用/MCP/记忆窗口/多模态/Embedding）**全覆盖**；`AGENT`（多智能体）由 Spring AI Alibaba 的 `graph-core`/`agent-framework` 覆盖 |
| 缺口 | 4 项：**服务商广度（46 家）、用户记忆 10 类（EVO）、OpenAI 兼容入站网关（GW）、IM 渠道（钉钉/企微/飞书/Slack/Telegram）** —— **均非平台必需**，按需单独立项 |
| 许可 | Spring AI **Apache-2.0**；Spring AI Alibaba **Apache-2.0**；`dashscope-sdk` 仅可选引入 → **D2 私有化交付安全** |
| 对工作量的影响 | AI 由 3.0 → **4.0 人月**（内核 K16 0.5 + 插件 3.5）；总量 89 → **90** |

#### 9.8.2 为什么不能"整体照搬"

| 维度 | `NewLife.AI` | Spring AI / Spring AI Alibaba |
|---|---|---|
| 定位 | "**多服务商 SDK + 网关 + 对话产品**"：46 家服务商注册发现、模型元数据/报价、Filter 链、MCP、Planner、渠道集成 | Spring AI 是"**AI 能力框架**"（`ChatClient`/`Tool`/`MCP`/`ChatMemory`/向量）；Spring AI Alibaba 是"**Agent/Graph 编排框架**" |
| 服务商 | 46 家 + 17 模型家族能力推断 | 以 starter 为粒度（openai/ollama/deepseek/anthropic/google-genai/mistral/bedrock…），**无"服务商元数据+报价"体系** |
| 结论 | 平台真正需要的是"**页面上下文 + 动态工具 + 单端点 SSE**"这层薄契约，不是 46 家服务商 | 因此：**框架用 Spring AI，契约层自研** |

#### 9.8.3 能力对照（逐模块）

| 模块 | `NewLife.AI` 现状 | Java 落点 | 覆盖 |
|---|---|---|---|
| **AI** 服务商/协议 | 46 家注册发现；OpenAI / Anthropic / Gemini / DashScope / Ollama / Bedrock 六协议 | `spring-ai-starter-model-*`（6 类） | 🟡 **部分**（收敛 3~6 家） |
| **AI** 统一接口与能力元数据 | `IChatClient` 同步/流式、能力标记、`ToolChatClient`、Embedding/Rerank/视频/余额/语音 | `ChatClient`/`ChatModel` + 多模态；`EmbeddingModel` + 向量库 | ✅ 核心覆盖；Rerank/视频/余额/语音 🟡（DashScope 可选） |
| **AI** MCP | 自研 MCP 客户端/服务端 | `spring-ai-starter-mcp-server-webmvc` + `spring-ai-starter-mcp-client(-webflux)` | ✅ **覆盖** |
| **CHAT** 对话/会话/多模态 | WebUI、会话管理、消息展示 | `ai` 插件（`AiSession`/`AiMessage`/`AiChatLog`）+ `/Ai/AiChat` SSE；界面由 ArcoVue 现有 AI 浮窗承担 | ✅ **契约等价** |
| **TOOL** 技能/工具/Filter/注入 | 技能包、`[Description]` 工具、`IChatFilter` 链、注入策略、数据库工具 | `@Tool` + `ToolCallbackProvider` + Advisor 链；技能 = 提示模板 + 工具白名单 | ✅ **覆盖** |
| **EVO** 用户记忆 10 类 | 10 类记忆自动提取与注入 | `ChatMemory` 仅消息窗口 → **需自研抽取** | ❌ **缺口** |
| **GW** API 网关 | 多协议入站 + AppKey + 模型路由 + 用量 | 无对应 → 自研 `ai-gateway` 可选插件 | ❌ **缺口**（默认不做） |
| **IM** 渠道 | 钉钉/企微/飞书/Webhook/Slack/Telegram | 无对应 | ❌ **不复刻** |
| **AGENT** 编排 | Planner、多 Agent、反思、HITL | Spring AI Alibaba `graph-core`/`agent-framework`（顺序/并行/路由/循环、持久化、流式、HITL） | ✅ **覆盖**（可选插件，P5+） |
| Studio/Admin 控制台 | 无（用管理页） | `spring-ai-alibaba-studio` 仅开发期 | ⛔ **不投产** |

#### 9.8.4 版本与许可（pin）

| 组件 | 版本 | 许可 | 说明 |
|---|---|---|---|
| Spring AI | **1.1.2** | Apache-2.0 | 核心：`ChatClient`/工具/MCP/ChatMemory/多模态/向量；**MCP server-webmvc 与 client 均在其 `starters/` 中**（已核实目录） |
| Spring AI Alibaba | **1.1.2.2**（`revision`） | Apache-2.0 | 依赖 Spring AI 1.1.2；`pom.xml` 中 `spring-boot.version=3.5.8`、JDK 17+；模块：`bom`/`graph-core`/`agent-framework`/`studio`/`admin`/`sandbox` + 5 个 starter（a2a-nacos / agentscope / builtin-nodes / config-nacos / graph-observation） |
| DashScope 原生 starter | 1.1.2.1 | Apache-2.0 | `com.alibaba.cloud.ai:spring-ai-alibaba-starter-dashscope`，**不在主仓 BOM**；默认不引入 |
| 不采用 | — | — | `studio`/`admin`（调试台）、`starter-a2a-nacos`/`-agentscope`/`-config-nacos`（引 Nacos + A2A 依赖，平台无诉求） |
| Boot 4 目标 | ⚠️ 待确认 | — | Spring AI 1.1.x 面向 **Boot 3.5.x**（Alibaba 1.1.2.2 即以 3.5.8 为基线）；Boot 4 目标下 AI 插件版本需在 P2 门禁前确认（见 R42） |

#### 9.8.5 缺口处理

| 缺口 | 处理 | 阶段 |
|---|---|---|
| 服务商广度（46 → 3~6 家） | 只做 `openai-compatible`（含 vLLM/DeepSeek/千问兼容）、`ollama`；可选 `anthropic`/`google-genai`/`dashscope`；新家按项目加 starter | MVP |
| 用户记忆 10 类（EVO） | **不做**（无明确需求）；如需，按"会话摘要 + 显式用户偏好表"最小实现 | P5 可选 |
| 入站网关（GW） | **不做**；如需对外提供 AI API，单独立项 `ai-gateway` | P5 可选 |
| IM 渠道 | **不做** | — |
| 模型元数据/报价体系 | **不做**；仅在配置页展示"当前 provider/model + 连通性检测" | MVP |

#### 9.8.6 「AI 就绪」的落法（架构篇 §5.15）

AI 就绪不是"加个插件"，而是**三条硬约束从 P1 起生效**（否则后期补会返工）：

| 约束 | 内容 | 为什么必须早 |
|---|---|---|
| **AIR-1 元数据即工具** | 工具清单由 K1 元数据 + K5 路由表**生成**；新增实体/控制器插件 → 工具自动出现 | 工具清单若写死，后续每加实体都要改 AI 代码 |
| **AIR-2 权限即工具边界** | 工具调用与 HTTP 走**同一套** `Permission + DataScope + Tenant` 判定；无权限工具**不下发**给模型 | AI 是新的越权入口；事后加权限会出现"老工具无守卫" |
| **AIR-3 契约即基线** | `/Ai/AiChat` 事件与序列化口径（camelCase / 忽略 null / 中文直出 / Int64→String）进契约基线；ArcoVue 零改动 | SSE 契约一改，前端 AI 浮窗即坏 |

#### 9.8.7 风险

见 R42（版本跟随与非官方项目）、R43（离线模型能力差异）、R44（AI 工具越权与数据外泄）。

## 10. 风险登记册

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | **`/meta` 保真度**（字段顺序、`visible/readOnly/sensitive/virtual`、`dataSource` vs `lovCode`、工具栏语义） | 前端"零改动"不成立 | 键级规格（架构篇 §6.2）+ 黄金样本 + JSON Schema 断言 |
| R2 | **RSA-OAEP MGF1 默认 SHA-1** | 登录静默失败 | 显式 `OAEPParameterSpec(SHA-256, MGF1, SHA-256)` + 单测 |
| R3 | **裸 token / Cookie 名** | 全部 401 | 关闭默认 Bearer，自建 Filter |
| R4 | **Long 精度 / `id/Id/ID`** | 前端错乱 | 全局 Long→String + 大小写不敏感 |
| R5 | **租户上下文传播**（异步/线程池/虚拟线程） | 越权风险 | `TransmittableThreadLocal` + 显式传参 |
| R6 | **XCode 语义缺位**（Migration/Cache/分片/ShowIn） | 行为漂移 | 明确只迁子集；Liquibase diff；自持 ShardPolicy；移植 XCode 测试用例 |
| R7 | **业务实体配置外溢**（静态构造函数配字段，Java 无对应物） | 后续下游迁移成本高 | `Model.xml` + `XxxBiz` + 保留配置式 DSL；本次不投入转换脚本 |
| R8 | **契约无版本缓冲**（前后端同版发布） | 任何偏差即线上故障 | 锁定 commit `b0ed746bd` + NuGet 版本双锚；灰度双跑 |
| R9 | **插件类加载器泄漏**（反复 L2） | Metaspace OOM | 连续升级次数上限（默认 20）+ 强制建议 L3 + 弱引用哨兵 + `DisposableRegistry` |
| R10 | **商用许可**（GPL 内嵌 / 专有） | 法务阻断 | §6.5 矩阵 + `license-maven-plugin` 门禁 + SBOM 随包交付 |
| R11 | ~~下游二次开发应用范围~~（已移出本次范围） | — | 保留为**后续立项输入**；本次不评估 |
| R12 | **前端无契约测试套件** | 无法判定等价 | 自建 L2 样本库（P0） |
| R13 | **Boot 3.5 EOL** | 安全补丁缺失 | 版本 pin + CVE 订阅 + Boot 4.x 路径 |
| R14 | **团队 Java 熟练度** | 估算失效 | P0/P1 架构与契约评审门禁 |
| **R15** | **插件颗粒度的代价**：加一个实体也要重装插件 | 业务迭代感知"变慢" | L1 装箱秒级；提供"开发态热部署"（dev 模式监听 Model.xml 自动重装）；文档明确该取舍 |
| **R16** | **停用/卸载残留**：路由、菜单、前端资源、在途业务 | 前端 404/空白、半可用 | 停用即返 `503+code=-5`；菜单按启用集合裁剪；旧前端资源保留 7 天；在途策略 `block/readonly/drain`（P-1/P-2/P-3 验收） |
| **R17** | **级联停用遗漏** | 依赖方半可用 | 依赖图逆拓扑停用 + 安装期强制校验（R5 规则） |
| **R18** | **离线环境交付**（无外网、客户 DB 版本未知、硬件低配） | 现场无法起服 | 离线包 + dry-run 演练；缓存可全关；方言差异报告；启动自检清单 |
| **R19** | **"复刻"被做成"重写"**：额外实现服务端分组 / 文件化 DSL / `/meta` 扩展键 | 工期失控、与前端已有实现重复 | v4.3.1 明确：填色/分组在前端求值，后端零引擎；`cube:Presentation` DSL 与 `/meta` 扩展键**默认不做**（§9.6.3 可选增强），需单独立项（Z-3/Z-4 按"配置往返"验收） |
| ~~R20~~ | ~~分组聚合与分页语义冲突~~ | — | **已撤销**（v4.3.1：表格分组在前端，后端不做服务端聚合，无此冲突；Widget 聚合为独立端点，语义清晰） |
| **R21** | **筛选翻译偏差 / SQL 注入 / 假聚合** | 越权数据、性能塌陷、数字不可信 | 筛选编译为参数化 `Filters` + 字段/操作符白名单；**列表筛选不可翻译则整段放弃下推（前端兜底）**、**Widget 聚合不可翻译 → 400**；排序 ≤3 列白名单；填色规则（≤50 条）在前端求值，与后端无关（D-32 验收） |
| **R22** | **自动化重复触发/风暴** | 数据被反复修改 | 幂等键 + 单规则并发上限 + 触发链深度上限（默认 3）+ 循环检测（Z-7 验收） |
| **R23** | **可观测开销与信息泄露** | 生产变慢 / 敏感信息外泄 | 默认低采样；诊断端点独立权限位；参数与字段脱敏；诊断访问自身记审计（D-6 验收） |
| **R24** | **拆分就绪规则在压力下被绕过**（图省事直接跨域调用） | 后期拆不动 | S1~S10 全部接入 CI 门禁（ArchUnit/SQL 检查/契约双跑），P1 即生效 |
| ~~R25~~ | ~~下游范围错配~~ | — | **已撤销**（决策 2：全新项目，不涉及下游 .NET 系统） |
| **R26** | **平台切换后无 .NET 回滚路径**（决策 1/4；爆炸半径 = 平台 + CubeDemo + AntJob） | 平台层出问题只能回上个 Java 版本 | 契约回归基线永久化 + CubeDemo 全量验收 + 保留 .NET 镜像 90 天（只读）+ **冻结 .NET 侧平台功能变更**（需预留少量兜底人力） |
| **R27** | **L2 生产启用**（决策 7） | 类加载器泄漏/元数据漂移/升级失败 | H1~H8 硬化 + 节点灰度 + 双版本并行 + 自动回滚 + Metaspace 水位拒绝（P-9~P-12 验收） |
| **R28** | **国产库未实测**（决策 8：不采购、由项目交付） | 首个国产化项目踩方言坑 | `DbProvider` SPI + 方言自检 + 实测清单；研发期用 2 库验证 SPI；交付前做 SQL 兼容性检查 |
| **R29** | **MQ 型号多样导致语义差异**（决策 10） | 顺序/重试/死信行为不一致 | 统一 `EventEnvelope` + 至少一次 + 幂等消费 + 每 provider 跑同一套 conformance 测试（MQ-1~MQ-3） |
| **R30** | **日志落客户库的性能与权限**（决策 14/24） | 慢查询/表空间膨胀/无 DDL 权限 | 异步批量 + 补偿文件 + **保留期/尺寸/提供者全配置化** + 交付前确认 DDL 权限与表空间；`sink` 可按环境降级为 `file` |
| **R31** | **AntJob 迁移暴露平台结构性缺口** | 需返工内核（作业调度/实体模型） | 调度内核 K15 提到 **P2** 先落地，AntJob 迁移放 P3；P3 前做"能力盘点"对照 AntJob 需求清单；缺口 >3 条则调整 P3 范围而非硬扛 |
| **R32** | **双 MQ 语义差异**（RabbitMQ 无顺序消息、RocketMQ 有） | 事件顺序假设在 RabbitMQ 下失效 | 事件设计**不依赖全局顺序**，按 key 分区 + 幂等；RabbitMQ 用单队列单消费者模拟 key 序；conformance 测试双跑 |
| **R33** | **dev/test/prod 三环境配置漂移** | 生产行为与测试不一致 | 配置 Schema 校验（启动期）+ 环境差异白名单 + 生产配置变更审计 |
| **R34** | **Cron 语义漂移**（0=周日 / `d#Lk` / `?`，与 Spring/Quartz 不同） | 定时任务在错误时间触发，或直接解析失败 | 自研 `CubeCron`（移植 `Cron.cs` 算法与单测）+ JOB-1 逐条比对"下 N 次触发时间"；**禁止直接用 `Spring CronExpression`** |
| **R35** | **MinIO / Redis 许可交付争议** | 交付审计卡住、被迫替换组件 | MinIO 只做独立进程 + 不改源码 + SBOM 源码指引；Redis 交付优先 ≤7.2 或 Valkey；《第三方组件清单》随包 |
| **R36** | **flowgram 画布表达力不足**（它不是 BPMN 编辑器） | 业务方需要的审批拓扑画不出来，回头改内核 | 7 类节点受限 + 服务端编译校验 + 不支持形态显式拒绝；复杂流程走"导入 BPMN + 只读回显"或插件自定义控制器（WF-4） |
| **R37** | **菜单自动生成与人工调整冲突** | 管理员改完被下次生成覆盖；或菜单重复/错位 | 三层合成 + 覆盖层只存差异 + `lastUpdate` 去抖 + 幂等门禁（MENU-2/MENU-3） |
| **R38** | **调度插件协议跟版**（XXL-Job Admin 2.4/3.x 字段差异；AntJob 语义漂移） | 对接失败、作业不执行 | 协议 conformance 测试（JOB-5/JOB-6）+ 版本矩阵 + 明确"仅支持已测版本" |
| **R39** | **历史分片命名/存量数据失配** | 迁移后查不到历史数据（"数据消失"） | 迁移前盘点分片基线（连接名+表名+行数+时间范围）；**命名模板冻结**；SHARD-6 逐表行数比对 |
| **R40** | **雪花 workerId 冲突 / 时钟回拨** | ID 重复 → 主键冲突、分片错位 | workerId 经 Redis 自增分配 + 启动唯一性校验（冲突拒绝启动）；回拨策略 `fail/wait`（窗口 1h+10s）；ID-1~ID-3 验收 |
| **R41** | **分片分页语义被误改**（有人把"每分片分页"改成"全局合并"） | 与 .NET 行为不一致、性能塌陷 | 保持"每分片分页不合并"（SHARD-4 显式断言）；全局 Top-N 只允许走 `Widget/Query` 或专用归并端点 |
| **R42** | **AI 依赖跟版**：Spring AI 1.1.x 面向 Boot 3.5.x；Spring AI Alibaba 为**非 Spring 官方**项目，版本节奏跟随 Spring AI | Boot 4 目标下 AI 插件不可用；两库 API 破坏性变更导致返工 | 版本 pin + 只在 `ai` 插件内使用（内核 K16 只依赖自研接口，不依赖 Spring AI 类型）；`-Pboot4` 门禁对 AI 插件单独标注"待确认"；升级前跑 AI-1~AI-7 |
| **R43** | **离线模型能力差异**：本地 Ollama/vLLM 小模型在工具调用与长上下文上弱于云模型 | 演示效果差、客户预期落差 | 默认离线 + 云可选；提示词与工具描述按小模型优化（工具 ≤8 个/次、参数结构化）；对外承诺以"离线可跑通流程"为口径，不以模型能力对赌 |
| **R44** | **AI 工具越权与数据外泄**（工具可查任意实体；上下文带出隐藏字段） | 越权读取、敏感信息外泄 | AIR-2：工具与 HTTP 同权限判定 + 无权限工具不下发；上下文只取"当前页可见字段"，`ShowIn` 隐藏字段不进上下文；写操作只回填表单不落库；MCP 端点默认关闭且只暴露只读工具（AI-2/AI-3 验收） |
| **R45** | **自动 DDL 在生产误删/锁表**（D-38：默认 `On`，但有人手改成 `Full` 或遇到大表改列） | 数据丢失、业务中断数十分钟 | 默认 `On`（不删列不改类型）+ 表级只能收紧 + `AlterColumn/DropColumn` 在超阈值行数时**拒绝自动执行**并出"在线变更建议单" + 改结构前强制备份 + 全程审计（SCHEMA-2/SCHEMA-3） |
| **R46** | **在线升级的供应链风险**（更新源被劫持 / 清单与包不一致 / 私有源权限过宽） | 植入后门、装错版本、无法回滚 | 包签名 + 逐文件 SHA256 + 更新源域名白名单 + **签名不符直接拒绝（不进 dry-run）** + 灰度分批 + 失败自动回滚 + 审计（UP-2/UP-4） |
| **R47** | **认证插件拆分后的登录态一致性**（`sso`/`auth-third` 停用、跨节点登录类型不一致、绑定关系孤立） | 客户误停插件后全站掉线；或第三方登录后本地账号重复创建 | 停用 `sso` **不吊销已签发 JWT**（只在过期前有效）+ 登录类型由 `/Auth/Info.loginTypes` 动态下发 + 绑定走 `用户链接` 唯一约束 + AUTH-P-1~4 验收 |

## 11. 方案对比与推荐

| 方案 | 做法 | 工作量 | 风险 | 适用 |
|---|---|---|---|---|
| **A 全量重写（无平台化）** | Java 一次性替换全部 API，逐个重写 39 个控制器 | ~42 人月 | 🔴 极高 | 一次性去 .NET，不接受平台化投入 |
| **B 契约优先（无插件化/无 Model.xml）** | 冻结契约 → 内核 → 按模块切流 | ~44 人月 | 🟠 可控 | 仅要求"换语言" |
| **C 内核复用** | 元数据/CRUD 内核留 .NET，Java 只接新业务 | 6~10 人月 | 🟡 低 | 只是"新业务要 Java" |
| **D 边界隔离** | .NET 注册 Nacos、前置 Gateway，Java 只写增量服务 | **1~3 人月** | 🟢 最低 | 动机是治理/双栈共存 |
| **E 契约优先 + 微内核平台化渐进替换**（**推荐**） | 冻结契约 → 建内核（元数据/代码生成/**插件域**/**展现层**/**自动化**/**可观测**/**拆分就绪**/**调度**/**分片·雪花**） → 系统插件化 → 业务插件化 → 切流 | **~89 人月**（MVP 基座 ≈ 52；裁自动化/诊断 → 约 80） | 🟠 可控 | **技术栈统一 + 信创 + 微服务化 + 插件化 + Model.xml 零代码 + 可拆分部署 + 自带诊断（当前场景 G1~G7）** |

**推荐 E 的理由**

1. 四项平台化要求（G1~G4）只有 E 能同时满足；A/B 交付的是"另一个 CRUD 框架"
2. 契约已有 OpenAPI 基线 + 正式文档双重固化，可机械验收
3. 内核不可拆分且是单点风险，前移到 P1 后风险可控
4. 保留 .NET 参照实现作为**差分预言机**，任何偏差即时定位
5. 平台化投入（≈89，v4.3.2 口径）可由后续每个业务模块的边际成本下降对冲（§8.3）——虽本次不迁移下游，但平台建好后每个新业务的成本是常数级
6. **非 SaaS 私有化交付场景下**，插件热升级是「客户现场不停机升级」的唯一可行路径（L1 秒级 / L2 十秒级 / L3 兜底），这是方案 A/B 给不了的能力

**若动机权重变化**：信创+微服务化权重最高且可接受双栈 → 先做方案 D（1~3 人月验证收益）；技术栈统一为硬约束 → 直接 E。

---

## 12. 切片计划（四类门禁；范围 = 平台 + CubeDemo 插件集 + AntJob 迁移）

| 阶段 | 周期 | 内容 | 出口门禁 |
|---|---|---|---|
| **P0 契约冻结** | 2~3 周 | 启动 `CubeDemo` 采集 `/meta`/视图/工作台/自动化实际配置样本（中/英）；锁定 commit；**契约回归基线定为永久资产**；**冻结 .NET 侧平台功能变更** | 基线全绿（358/463/211） |
| **P1 内核最小闭环 + 可观测骨架 + AI 就绪骨架** | 8~10 周 | K1/K2/K4/K5 + 生成器 MVP + CRUD + `/meta`；**K13 骨架**（TraceId/W3C/JSON 日志/慢 SQL/health/指标）；**K16 `cube-kernel-ai` 骨架**（ToolRegistry/AiContext/MCP server/SSE 契约基座）；**S1~S10 门禁进 CI**；**CI 双目标编译 `-Pboot4`**；**dev/test/prod 三环境档案** | 单实体 diff=0；**D-1/D-3**；ArchUnit 全绿；**`/mcp` 能列出 1 个实体的工具** |
| **P2 插件域 + 展现层 + 自助配置 + 数据/MQ/缓存/调度/存储 + 迁移器** | 14~16 周 | K7 插件域；K9 展现层；**12 类自助配置对象与端点**；**DB 配置式切换（6 库）**；**分库分表 + 雪花 ID + 读写分离**；**`SchemaSync` 自动结构同步 + 首次运行自动建库建表播种**；**`Parameter` 参数中心**；**异步批写队列**；**RabbitMQ/RocketMQ 双实现**；**K15 调度内核 + 菜单自动生成**；**L1+L2 缓存**；**`storage` 插件（local/nas/MinIO/OSS）**；**`sso`/`auth-third`/`usercenter` 插件骨架**；**`ai` 插件骨架（模型配置热切换 + `/Ai/AiChat` 占位 + `AiChatLog`）**；K14 双派发骨架；**`cube-migrate` MVP**；导入导出；i18n | `/Auth/*`、`/Cube/*` 全绿；P-1/P-2；Z-1~Z-5；**DB-1a/DB-2~DB-4 / MQ-1~MQ-3 / SHARD-1~7 / ID-1~4 / JOB-1~JOB-4 / MENU-1~MENU-4 / CACHE-1~CACHE-4 / FILE-1~FILE-3 / SCHEMA-1~4 / INIT-1~4 / PARAM-1~3 / ASYNC-1~3** |
| **P3 生产级热升级 + 工作流 + 调度插件 + 自动化 + 诊断 + 双模升级** | 14~16 周 | **L2 硬化 H1~H8**；**在线（默认）/离线双模升级**；K10 自动化；K10' 看板；**诊断插件 + 告警 + 日志双落点 + SkyWalking**；集群广播；`license`（**到期宽限 30 天**→只读）；**`workflow`（Flowable + flowgram）**；**`job-ant`（AntJob 迁移）** + `job-xxl`（协议兼容）；**CubeDemo 拆为 `demo-*` 插件** | P-3~P-13；Z-6/Z-7；**D-2/D-4~D-9**；**JOB-5~JOB-6 / WF-1~WF-5 / FILE-4 / UP-1~UP-5 / AUTH-P-1~AUTH-P-4** |
| **P4 AI + 拆分演练 + 国产库实测 + 切流** | 10~12 周 | **`ai` 插件完整**（Spring AI 1.1.2 + MCP server·client + SSE 契约 + 动态工具与权限裁剪 + 模型热切换 + 本地模型 Ollama/vLLM + 审计配额）；L 档拆分演练（ai / job-ant / storage 拆为卫星服务）；**金仓/海量/达梦 实测**；双跑灰度 → 切流 | 灰度期指标达标；跨进程链路仍成立；回滚演练通过；**DB-1b 通过**；**AI-1~AI-7 全绿** |

> **三层验证闭环**：
> - **P2 `CubeDemo`（配置型）** → 证明"业务方只写 Model.xml 即可上线"
> - **P3 `CubeDemo`（代码型）+ 热升级** → 证明"平台能承载自定义逻辑并现场升级"
> - **P4 `AntJob`（真实业务）** → 证明"平台能承载非 Demo 系统的真实业务复杂度"

## 13. 契约验证体系（修正 v1 不可执行方案）

| 层 | 工具 | 输入 | 判定 |
|---|---|---|---|
| **L1 静态契约** | springdoc-openapi（Java 产出）+ 自研递归 diff 比对器 | .NET 基线 `CubeDemo/contracts/openapi/*.json`（只读） | path/method/schema 缺失或签名变更即失败 |
| **L2 运行时样本** | 录制/回放比对器（REST Assured + Jackson 结构化 diff，忽略 `traceId`/时间/随机 ID） | 登录、`/Auth/Info`、`/Cube/MenuTree`、实体 `/meta`（中/英双语）、列表/详情、导出响应头 | 字段集/顺序/取值规则完全一致 |
| **L3 端到端** | Playwright（ArcoVue 6 + Vue 10）+ REST Assured | `CubeDemo + SQLite` 环境，baseURL 指向 Java | 交互路径全绿 |

**四类专项验收**（详细用例见架构篇 §11.2 / §11.4）：
- 插件 P-1~P-8：装卸、级联停用、在途策略、L2 热升级与回滚、无泄漏、离线包、双节点收敛
- 展现 Z-1~Z-7：七视图配置往返、保存查询与筛选下推一致、填色配置原样存取（前端求值）、分组由前端完成（后端不做聚合）、Widget 聚合逐值比对（不可翻译→400）、工作台三层与命名挂菜单、自动化触发与幂等
- **分片/雪花 SHARD-1~7 + ID-1~4**：区间推导与条件裁剪逐分片一致、AutoShard 每分片分页、批量分组、**历史分片命名不变**、懒建表；**雪花 41/10/12 兼容 + workerId 唯一 + 回拨策略 + 大表不缓存**
- 可观测 D-1~D-6：TraceId 三处一致、traceparent 入出、慢 SQL 脱敏、诊断面板权限、无 APM 可排障、开销 < 5%
- **AI 就绪 AI-1~AI-7**：`/Ai/AiChat` SSE 契约 diff=0、动态工具按页面与权限裁剪（越权被拒）、MCP `list_tools` 可见性、模型配置热切换、离线模型全流程、用量与配额、失败降级与插件停用语义
- 契约 L1~L3：OpenAPI diff、运行时样本、端到端

**插件专项验收 P-1~P-13**（详细用例见架构篇 §11.2）：装卸插件菜单即时生效无 404、系统插件停用级联、在途业务策略、L2 热升级不重启生效、升级失败回滚、连续 20 次 L2 无 Metaspace 增长、离线包 dry-run + 执行、双节点收敛、**删除全部 `demo-*` 插件后平台仍可运行**。

**门禁时机**：每 PR → L1 + 单测 + ArchUnit（A1~A8）；每日 → L2 关键样本；阶段出口 → L2 全量 + L3 + 插件专项；上线前 → 全部绿 + 灰度对比。

> v1 的错误：`.NET scripts/check-openapi.sh` 依赖 .NET 编译产物与 git-bash awk，**不能直接用于 Java 侧**（A9）。v2 改为"基线 JSON 作为不可变输入"。

---

## 14. 决策记录（v4.3.2 全部收口）

> **35 项决策**均已落定（15 + 9 + 9 + 1 + 1），**无未决问题**。本表作为项目基线，后续变更需走变更评审。

### 14.1 第一轮（15 项，v4.0）

见 §1.2。要点：私有化交付；JDK 21→25 升级路径；不保留 .NET；信创中间件不验收；Workflow/AI 首期；L2 生产启用；数据库配置式切换；授权到期只读；MQ 可配置；零代码按 P2/P3；自助配置界面参考 ArcoVue；日志落客户 DB/硬盘；SkyWalking 可插拔。

### 14.2 第二轮（9 项，v4.2）

| # | 决策 | 落地位置 |
|---|---|---|
| 1 | 冻结 .NET 侧平台功能变更 | §2.3.1、R26 |
| 2 | 全新项目，不考虑下游 .NET 系统 | §2.3、R25 撤销 |
| 3 | 选 `NewLife.AntJob` 验证 | §2.4、§12 P4 |
| 4 | `cube-migrate` MVP 本次交付 | §2.3.2、§8.3 |
| 5 | 主用 RabbitMQ + RocketMQ 最新稳定版（4.4.x / 5.5.x） | 架构篇 §5.12 |
| 6 | 不做 war 外置容器部署 | §9.2 |
| 7 | 授权到期宽限期 30 天 | 架构篇 §7.9 |
| 8 | 审计保留期/尺寸/提供者全配置化 | 架构篇 §13.2.2 |
| 9 | 用 dev/test/prod 环境区分 | 架构篇 §9.1、R33 |

### 14.3 第三轮（9 项，v4.3）

| # | 决策 | 落地位置 |
|---|---|---|
| 1 | **前端仅 ArcoVue**，其余 SPA 与 MVC 主题不迁移（D-25） | §1、§1.6-1、§12 P0 |
| 2 | **AntJob 迁移为平台能力和插件**，不再需要外部第三方调度组件（D-26） | §2.4、架构篇 §5.13、R31/R34/R38 |
| 3 | **同时支持 XXL-Job**，以协议兼容插件实现（D-27） | 架构篇 §5.13.6、§6.5.4、R38 |
| 4 | **文件/附件存储支持 MinIO / 云 OSS**，做成系统插件（D-28） | 架构篇 §5.14、§7.1、§6.5.5、R35 |
| 5 | **工作流 = Flowable + flowgram.ai**，后端实体按 Flowable 升级（D-29） | 架构篇 §7.15、R36 |
| 6 | **底层基础组件以 NewLife.Core 为语义基准**（D-30） | 架构篇 §15.4、§5.5/§5.13.4 |
| 7 | **菜单按插件控制器自动生成/更新**（D-31） | 架构篇 §7.7、R37 |
| 8 | **CubeDemo 非核心能力全部插件化**（D-32） | 架构篇 §7.14、P-13 |
| 9 | **数据库只做 6 种；缓存 = L1 本地 + L2 Redis**（D-33） | 架构篇 §5.11/§5.5、§9.2、R28 |

### 14.4 第四轮（v4.3.1 / v4.3.2 / v4.3.3 补记）

| # | 决策 | 落地位置 |
|---|---|---|
| 1 | **零代码展现 7 项已全部实现 → 契约复刻**（D-34） | §9.6、架构篇 §5.9/§4.7、§8.1（K9 4.5） |
| 2 | **分库分表 / 雪花 ID / 读写分离按 XCode 语义同步迁移**（D-35） | 架构篇 §5.7、§15.5、§5.2、§8.1（K4 5.5）、R39~R41 |
| 3 | **AI 就绪从第一天起 + Spring AI Alibaba 替代 NewLife.AI（可行，分层替代）**（D-36） | §9.8、架构篇 §5.15/§15.6、§6.3、§6.5.3、§8.1（K16 0.5）、§8.2（AI 3.5）、R42~R44 |

### 14.4.1 第五轮（v4.3.4 补记，11 项）

| # | 决策 | 落地位置 |
|---|---|---|
| 4 | **注册接口定名 `PluginRegistry`；生成物覆盖策略修正 + 三级泛型基类链**（D-37） | 架构篇 §3.4、§4.3、§4.4、§12.2.1 |
| 5 | **插件安装/更新自动结构同步（四档 Migration、表级只能收紧、改结构前备份）**（D-38） | 架构篇 §7.8.1、§7.4、§15.5、§8.1（+1.0）、R45 |
| 6 | **`Parameter` 升级为运行态参数中心**（D-39） | 架构篇 §5.16、§12.2.1、§8.1（+0.5） |
| 7 | **系统升级在线（默认）/离线双模**（D-40） | 架构篇 §7.12、§11.2（P-7）、§8.1（+0.5）、R46 |
| 8 | **默认 SQLite + 首次运行/切库自动建库建表播种 + 异步批写**（D-41） | 架构篇 §5.11.1、§5.11.5、§5.17、§8.1（+0.5 异步）、R45 |
| 9 | **认证内核外置 `sso`/`auth-third`/`usercenter` 三插件** | 架构篇 §8.5、§7.1、§8.2（+0.5）、R47 |

### 14.5 仍需在 P0 落实的前置动作（非决策，为执行项）

| # | 动作 | 责任 |
|---|---|---|
| 1 | 书面冻结 .NET 侧需求入口（仅接收 P0 级缺陷） | 项目管理 |
| 2 | 采集契约回归基线（含视图/工作台/自动化实际配置） | 契约组 |
| 3 | 与客户确认 MQ 型号基线（RabbitMQ 4.4.x / RocketMQ 5.5.x） | 交付 |
| 4 | 确认审计日志保留期与表空间（按客户合同） | 交付 |
| 5 | **导出 `CronJob` 全量表达式清单**（含 `?`/`#`/`#L`）作为 `CubeCron` 等价性样本 | 平台组 |
| 6 | **确认目标客户的对象存储形态**（MinIO 自建 / 云 OSS / NAS）与桶/权限策略 | 交付 |
| 7 | **确认 6 库中每个交付项目实际使用的库与驱动版本**（达梦/金仓/海量需厂商驱动包） | 交付 |
| 8 | **确认 Redis 交付形态**（Redis 8.x / ≤7.2 / Valkey；是否随包提供） | 交付 |
| 9 | 准备 AntJob 迁移需求清单（用于 P3 前能力盘点） | 产品 |
| 10 | 收集现有 Workflow 流程定义样本（用于 BPMN 转换与 WF-1 比对） | 产品 |
| 11 | **盘点现有分片基线**（连接名 + 表名 + 行数 + 时间范围）与 `DataScale` 声明清单 | 平台组 |
| 12 | **确认各交付项目的 workerId 分配方式**（Redis 可用性 / 是否需要显式配置） | 交付 |
| 13 | **确认 AI 模型供给形态**（离线 Ollama/vLLM 是否随交付提供或客户自备；云模型是否开通） | 交付 |
| 14 | **确认 Boot 4 目标下 AI 插件版本**（Spring AI 后续版本是否支持 Boot 4；否则 AI 插件锁 Boot 3.5 运行档） | 平台组 |
| 15 | **导出 `ViewProfile`/`UserProfile`/`QueriesJson` 真实样本**（含 `_raw` 未知字段、已废弃 `allowDelete`），作为 round-trip 基线 | 契约组 |
| 16 | **确认客户生产库的 DDL 权限与 `Migration` 档位**（是否有 DBA 统一管理；大表改列需在线变更窗口） | 交付 |
| 17 | **确认升级通道**（客户能否出网访问更新源；私有制品库地址与白名单域名） | 交付 |
| 18 | **确认认证插件清单**（是否需要 SSO/短信/MFA/用户中心，以及 IDP 类型与回调域名） | 交付 |
| 15 | **采集 `/Ai/AiChat` SSE 真实样本**（事件类型序列 + 字段 + 序列化形态）作为 AI-1 契约基线 | 契约组 |

## 附录 A：关键证据索引

| 主题 | 文件 |
|---|---|
| 宿主管线与中间件顺序 | [`../NewLife.Cube/CubeService.cs`](../NewLife.Cube/CubeService.cs) |
| 通用控制器 / 字段校验头 | `../NewLife.Cube/Common/EntityController.cs`（`:146,319,356-364`）、`EntityController.Patch.cs` |
| 字段元数据模型 | `../NewLife.Cube/ViewModels/{DataField,ListField,FormField,SearchField}.cs` |
| `/meta` 生成器 | `../NewLife.Cube/Common/PageMetaBuilder.cs`（`BuildFields:21`、`ApplyTraceUrl:42`、`BuildSearch:61`、`TryRemoveTimeField:118`、`BuildEntity:135`） |
| API 契约规范 | [`Api/WebAPI接口规范.md`](Api/WebAPI接口规范.md)、[`Api/核心接口架构.md`](Api/核心接口架构.md) |
| 认证契约 | [`Api/认证接口设计.md`](Api/认证接口设计.md) |
| 字段元数据 / 页面呈现 | [`Api/字段元数据.md`](Api/字段元数据.md)、[`Api/页面呈现架构.md`](Api/页面呈现架构.md) |
| 前端契约层 | `../packages/cube/src/api/{client,token,api}.ts`、`page/index.ts` |
| 前端字段/控件映射 | `../NewLife.Cube.ArcoVue/web/src/core/types/field.ts`、`components/useFieldInput.ts` |
| 契约基线 | `../CubeDemo/contracts/openapi/*.json` |
| 模块插件现状 | `../NewLife.CubeNC/Modules/ModuleManager.cs`（`:29-31,54-59,100-114`）、[`BASE-模块插件.md`](BASE-模块插件.md) |
| 魔方理念边界 | [`魔方理念.md`](魔方理念.md) |
| 多语言词表 | `../NewLife.Cube/Locales/*.yml`（32 份） |
| XCode 元数据/查询 | `../../NewLife.XCode/XCode/Configuration/{TableItem,FieldItem}.cs`、`Entity/Entity_Meta.cs`、`Model/WhereExpression.cs` |
| XCode 模型 XSD | `../../NewLife.XCode/XCode/ModelSchema.xsd`（`Model202604`） |
| XCode 代码生成器 | `../../NewLife.XCode/XCode/Code/EntityBuilder.cs`、`XCodeTool/CubeBuilder.cs` |
| XCode 扩展点/热加载结论 | `../../NewLife.XCode/Doc/{实体工厂完整接口（IEntityFactory）,实体拦截器框架（IEntityInterceptor）,元数据管理总览,AOT兼容性分析}.md` |
| AI 能力分层/插件化 | `../../NewLife.AI/Doc/{架构设计,技能管理需求,MCP架构,协议客户端分析}.md` |
| **调度现状（Cube 轻量调度）** | `../NewLife.Cube/Entity/{定时作业.cs,定时作业.Biz.cs}`、`../NewLife.CubeNC/Services/JobService.cs`、`../NewLife.CubeNC/Jobs/{ICubeJob.cs,CronJobAttribute.cs}` |
| **Cron 语义基准** | `../../X/NewLife.Core/Threading/Cron.cs`、`../../X/Doc/Cron表达式.md`（6 段 / 0=周日 / `?` / `d#k` / `d#Lk`） |
| **缓存两级模型基准** | `../../X/NewLife.Core/Caching/ICacheProvider.cs`、`../../X/Doc/缓存系统ICache.md` |
| **定时器基准** | `../../X/NewLife.Core/Threading/TimerX.cs`、`../../X/Doc/高级定时器TimerX.md` |
| **AntJob（迁移源）** | `../../AntJob/{AntJob,AntJob.Server,AntJob.Agent,AntJob.Data,AntJob.Web}`（MIT；`JobModes`/`Scheduler`/`Providers`） |
| **附件与对象存储现状** | `../NewLife.Cube/Entity/附件.cs`、[`SYS-文件存储.md`](SYS-文件存储.md)（`S3ObjectStorage`：SigV4 / 路径风格 / `UNSIGNED-PAYLOAD`） |
| **工作流现状** | `../NewLife.Cube/Workflow/*.cs`（29 文件：`WorkflowEngine`、`WorkflowWriteInterceptor`、`Jobs/WorkflowTimeoutJob`） |
| **XCode 分片/雪花语义** | `../../NewLife.XCode/XCode/Shards/{ShardModel,IShardPolicy,TimeShardPolicy}.cs`、`Entity/{EntitySplit,Entity_Operate}.cs`、`Configuration/FieldItem.cs`、`Code/EntityBuilder.cs` |
| **XCode 分片文档** | `../../NewLife.XCode/Doc/{分片路由模型（ShardModel）,Shards分配策略与路由,Shards跨分片查询与AutoShard,时间分片策略与范围裁剪（TimeShardPolicy）,分库分表临时切换（EntitySplit）,读写分离策略（ReadWriteStrategy）}.md` |
| **雪花实现（位宽/回拨）** | `../../X/NewLife.Core/Data/Snowflake.cs`（10 位 workerId / 12 位序列 / epoch 1970 / `JoinCluster` / 回拨容忍 1h+10s） |
| **零代码展现现状** | `../NewLife.Cube.ArcoVue/ArcoVue企业中后台迁移方案.md` §3.1 能力矩阵 / §7.4 多维视图完成度 / §8.5 工作台·仪表盘 / §10.3 里程碑 / §10.4 代码审查结论 |
| **零代码展现变更史** | `../NewLife.Cube.ArcoVue/openspec/changes/archive/`：OSC-0005/0006/0015/0016/0019、260815fa86（自动化）、26081903c0（填色）、2608280e9e（Widget）、26082815a1/260902ef43（工作台）、260830a1b2（筛选服务端化）、26092694a1/260926c2b8（分组/看板/日历）、261004d7f4（地图） |
| **零代码展现后端端点** | `../NewLife.Cube/Controllers/{CubeController.cs(ViewProfile),WorkbenchController.cs,WidgetController.cs,AutomationController.cs}` |
| **`ViewProfile` 实体字段** | `../NewLife.Cube/Entity/视图配置.cs`（15 业务列 + 审计；唯一索引 `IU_ViewProfile_UserId_TypePath`；**无 `Name`/`SortsJson`**） |
| **`ViewProfile` 前端 JSON 契约** | `../NewLife.Cube.ArcoVue/web/src/core/utils/viewProfile.ts`（`FILTER_OPS` 14 个 / `NamedView`/`ViewChrome`/`ViewFilter`/`ViewGroup`/`ViewFormatRule` ≤50 / `ViewInsight` 32KB / `SavedQuery`/`SavedQueriesWire` v2）、`stores/viewProfile.ts`、`filterBuilder.ts`（按字段类别的 op 集合） |
| **筛选记忆与排序白名单** | `../NewLife.Cube/Common/ReadOnlyEntityController2.cs`（`viewFilter` 下推：任一条件不可翻译则**整段放弃**，前端兜底）、`Common/SortWhitelist.cs`（`sorts` ≤3，非法 400） |
| **结构同步（反向工程）** | `../../NewLife.XCode/Doc/XCode数据模型与结构同步.md`（四档 `Migration` / 11 类 DDL / 表级只能收紧）、`XCode/DataAccessLayer/MetaData/DbMetaData_{Positive,Negative}.cs` |
| **初始化播种** | `../../NewLife.XCode/Doc/数据初始化（InitData）.md` |
| **结构差异 UI 参照** | `../NewLife.Cube/Areas/Admin/Controllers/DbController.cs`（`SchemaTables`/`SchemaEntities`/`SchemaDiff`/`SchemaCompact`/`Backup`） |
| **异步批写（`EntityQueue`）** | `../../NewLife.XCode/Doc/实体队列异步批写（EntityQueue）.md`（两级队列 / 周期 500~5000ms / 背压 15s / 批量 10000 / `Dispose` 等 3s）、`XCode/Entity/EntityQueue.cs` |
| **`Parameter` 现状** | `../../NewLife.XCode/XCode/Membership/字典参数.cs`、`Membership/Member.xml`、`Membership/ParameterKinds.cs`（`Normal0/Boolean3/Int9/Double14/DateTime16/String18/List21/Hash22`） |
| **认证插件拆分依据** | `../NewLife.Cube/Controllers/{SsoController.cs,MfaController.cs,AuthController.cs}`、`../NewLife.Cube/Services/{ISsoClientService,SsoClientService,ISsoServerService,SsoServerService,IOAuthAppService,OAuthAppService,IUserBindingService,UserBindingService,ITokenService,TokenService,IUserInfoProvider,ILoginCallback,ITokenCustomizer}.cs`、`Services/{TotpMfaService,VerifyCodeService,SmsService,MailService,DrawingCaptchaService}.cs` |
| **认证相关实体** | `../NewLife.Cube/Entity/{OAuth配置,OAuth日志,用户令牌,用户链接,委托代理,用户在线,用户统计,访问规则,短信配置,邮件配置}.cs`、`Areas/Admin` 27 个控制器 |
| **插件包现状（版本/启停）** | `../NewLife.Cube/Entity/应用插件.cs`（表 `AppModule`：`FilePath` zip + `Enable`）、`Modules/ModuleManager.cs` |
| **生成物覆盖策略** | `../../NewLife.XCode/XCode/Code/ClassBuilder.cs`（`Save`：`if (!File.Exists(p) \|\| overwrite)` 才写盘）、`XCodeTool/CubeBuilder.cs`（`BuildArea` 存在即返回 0；`BuildControllers` 调 `Save(null,false,false)`） |
| **平台/项目泛型基类参照** | `../NewLife.Cube/Common/{EntityController2.cs(EntityController<TEntity,TModel>),EntityTreeController.cs,ConfigController.cs,ReadOnlyEntityController2.cs}` |
| **Cube AI 现状实现** | `../NewLife.Cube/AI/*`（`AiController.cs`（`Route("Ai/[action]")` / `AiChat` SSE / `_sseJsonOptions`）、`AIService.cs`（`CubeSetting` 四配置 + `AiClientRegistry.CreateClient`）、`AIPlugin.cs`、`CubeTools.cs`、`BrowserToolService.cs`、`PageCheckpointService.cs`、`AILogSummaryJob.cs`、`AISecurityReportJob.cs`） |
| **Spring AI 官方组件** | `spring-projects/spring-ai`：`starters/`（`spring-ai-starter-mcp-server-webmvc` / `-mcp-client` / `-mcp-client-webflux` / `-model-openai|ollama|deepseek|anthropic|google-genai|mistral|bedrock` / `-model-chat-memory-repository-jdbc|redis` / `-vector-store-redis|pgvector` / `-tool-search-advisor`）、`mcp/` |
| **Spring AI Alibaba** | `alibaba/spring-ai-alibaba`：根 `pom.xml`（`revision=1.1.2.2` / `spring-ai.version=1.1.2` / `spring-boot.version=3.5.8`）、`spring-ai-alibaba-bom/pom.xml`（graph-core / agent-framework / studio / sandbox / 5 个 starter）、README 顶部 Apache-2.0 |
| 本方案技术篇 | [Java迁移-微内核插件化架构设计.md](Java迁移-微内核插件化架构设计.md) |

## 附录 B：P0 契约样本采集步骤

```powershell
# 1) 启动 .NET 参照实现（API 版 + ArcoVue + Swagger）
dotnet run --project .\CubeDemo\CubeDemo.csproj

# 2) 生成/校验 OpenAPI 基线（编译期产出 obj/openapi）
bash .\scripts\check-openapi.sh --build

# 3) 登录获取令牌（信封结构见 Api/认证接口设计.md §2.4）
$credential = Get-Credential -Message '输入测试环境专用账号'
$loginBody = @{ username = $credential.UserName; password = $credential.GetNetworkCredential().Password } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/Auth/Login' -ContentType 'application/json' -Body $loginBody

# 4) 采集各实体 /meta（中文 + 英文各一份，用于本地化等价性验证）
curl -s http://localhost:5000/api/Admin/User/meta -H "Authorization: <token>"
curl -s http://localhost:5000/api/Admin/User/meta -H "Authorization: <token>" -H "Accept-Language: en"

# 5) 采集列表/详情/导出响应头（含 Content-Type / Content-Disposition）
curl -s -D - "http://localhost:5000/api/Admin/User?pageIndex=1&pageSize=20" -H "Authorization: <token>"
curl -s -D - "http://localhost:5000/api/Admin/User/export?format=excel" -H "Authorization: <token>" -o out.xlsx

# 6) Playwright 基线（ArcoVue 6 个 E2E），结果入 cube-contract/runtime/e2e-baseline.json
cd .\NewLife.Cube.ArcoVue\web ; npx playwright test
```

> 产物目录：`cube-contract/{openapi-baseline,runtime,schema}`，纳入 CI 只读使用。以上 URL、参数及工作目录以实际启动配置和 OpenAPI 为准；先验证命令可执行，敏感样本应脱敏且限制访问。

## 15. 2026-11-13 实证复核与未闭环项

### 15.1 本轮范围和证据

本轮以当前工作区为基准，抽查了 Cube WebAPI/协议治理、ArcoVue 请求、XCode 实体队列与结构同步、Core 雪花实现、AI 能力和向量格式；不是对五个仓库每个文件或每个接口的全量审计。HEAD：Cube `b0ed746bd`、XCode `c5fc115ec`、Core（`X`）`3bcf1bc2b`、AI `bd51b7c4`；ArcoVue 位于 Cube 仓库，使用相同 HEAD。目标两份文档在本轮开始时为未跟踪文件，故仅在其现有内容上增量修订。

| 证据 | 实证结论 | 设计修订 |
|---|---|---|
| [Cube 接口规范](Api/WebAPI接口规范.md)、[ControllerBaseX](../NewLife.Cube/Common/ControllerBaseX.cs)、[限流过滤器](../NewLife.Cube/Attributes/RateLimitAttribute.cs) | `/Auth/Login` 不带 `/api`；普通业务码映射开关默认关闭，但限流可直接返回 429 | 采集与验收覆盖协议例外，不以“一律 200”替代真实行为 |
| [幂等过滤器](../NewLife.Cube/Attributes/IdempotentAttribute.cs)、[Cube 架构](架构设计.md) §4.22 | 仅显式带键的成功 JSON 缓存，键含用户和路径，默认 600 秒；现有代码不是并发互斥证明 | 指定请求重放和差异验收，增强行为不得假称原样复刻 |
| [XCode 实体队列](../../NewLife.XCode/XCode/Entity/EntityQueue.cs)、[队列文档](../../NewLife.XCode/Doc/实体队列异步批写（EntityQueue）.md) | 内存异步队列具去重、容量限制和关闭等待；返回 `false` 并不总能推断未入队 | 定义 Java 接收语义；关键事件采用同事务 outbox，不以 `afterCommit` 充当持久化 |
| [Core Snowflake](../../X/NewLife.Core/Data/Snowflake.cs) | 起点可配置；小幅回拨冻结逻辑时间，且有指定时间/业务 ID 重载 | 差分测试真实配置和调用；单凭位宽不能证明兼容 |
| [XCode 结构同步](../../NewLife.XCode/Doc/XCode数据模型与结构同步.md) | `IDataTable` 可由数据库、XML 或实体特性形成；这本身不证明 Java 六库 DDL 或跨节点回滚可用 | 明确 XML 是目标约束而非现状全貌；增加分步骤状态、并发互斥、恢复和六库故障注入门禁 |
| [Core 缓存文档](../../X/Doc/缓存系统ICache.md)、[ArcoVue 方案](../NewLife.Cube.ArcoVue/ArcoVue企业中后台迁移方案.md) | 有缓存抽象与元数据驱动页面的设计基线，前端文档也记录了各视图的演进和验收状态 | 把断连安全降级和各视图真实契约纳入运行验收，不将文档描述当作 Java 的执行证据 |
| [AI 架构](../../NewLife.AI/Doc/架构设计.md)、[向量格式](../../NewLife.AI/NewLife.AI/Embedding/VectorData.cs)、[ArcoVue AI 请求](../NewLife.Cube.ArcoVue/web/src/views/ai/useAiAssistant.ts) | 已有工具、MCP、向量等能力和页面侧认证/租户上下文；向量带模型、维度、二进制数据 | 逐项核对候选 Java 组件与 SSE、权限及模型格式；不宣称整库替代 |
| [OpenAPI 快照](../CubeDemo/contracts/openapi/) | 工作区存在 5 个 JSON 文件 | 静态文件存在不证明其覆盖运行时动态路由或样本已录制 |

### 15.2 结论边界

**可以进入 P0 做原型和取证，不能据此批准生产替换或宣称无设计缺口。** 本轮发现的主要问题及设计处理见[架构设计 §16](Java迁移-微内核插件化架构设计.md#16-实证复核补充可执行边界与收敛门禁)：插件可见性与流量排空、DDL/播种中断恢复、集群作业围栏、异步提交可靠性、缓存安全降级、雪花兼容和协议例外。目标方案和验收均尚未实现或执行。

仍需按冻结版本建立**每个端点/动态元数据/持久化实体/作业/插件**的双向清单；实际采集 ArcoVue 与 .NET 的成功、失败、边界及并发样本；验证六库及实际 JDBC、迁移故障注入、集群分区和插件卸载；核验依赖版本与许可；完成 AI 和工作流对照。成本 **93 人月、MVP 55 人月**仍是原有估算，尚未根据这些补充设计重新测算，不应作为承诺。

**收敛判据**：约定范围内清单完整、阻断问题清零、所有行为差异经确认、各项运行及故障注入验收有证据且通过；超出当前范围或没有运行环境的事项须明确标为未验证。设计评审不能逻辑上证明未来“再无任何缺口”。

---

（完）
