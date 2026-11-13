# Java 迁移架构设计 v4.3.4：微内核 + 插件化 + Model.xml 单一事实源

> **2026-11-13 实证复核状态**：本文件为目标设计，不是 Java 实现或验收报告。§16 的安全边界和门禁优先于历史章节中与之冲突的“原子”“自动回滚”“完全等价”“通过”等表述；历史验收表中的“通过”是**期望结果**，不是已执行结果。跨库、热升级、AI 替代及六库方言均未通过实测前，不得宣布完成。

> **定位**：本文是《可行性评估-Java后端迁移》（**v4.3.4**）的技术落地篇，回答"**怎么建**"。
> **v4.3.4 追加**（本次，11 项复核与修订）：①`EntityRegistry` → **`PluginRegistry`**（§3.4，注册单位是插件域而非实体）；②**插件安装/更新时由微内核按 Model.xml 自动结构同步**（§7.8.1，对齐 XCode 正/反向工程，四档 Migration，部署与开发人员零感知）；③生成物覆盖策略修正 + **三级泛型基类链**（§4.3/§4.4：`OrderController` 与 `OrderBiz` 一样**存在即跳过**，平台 `AbstractEntityController` → 项目基类 → 插件控制器）；④**复杂业务查询已由 ArcoVue「自定义查询 + 预定义查询」覆盖**（§4.6/§5.9.2/§5.9.5）；⑤**`Parameter` 升级为运行态参数中心**（§5.16：系统配置 / LOV 值集 / 自定义查询 / 自定义字典）；⑥**`ViewProfile` 实体与 JSON 子契约复核**（§5.9.5，逐字段对齐 `ViewProfile.cs` 与 `viewProfile.ts`）；⑦查询表达式**操作符 `== != > < >= <=` 双向映射**（§5.2）；⑧认证内核外置**`sso` / `auth-third` / `usercenter` 三个系统插件**（§8.5，依据 `SsoController`/`MfaController`/`OAuth配置` 实测）；⑨**系统升级在线（默认）/ 离线双模**（§7.12）；⑩**数据库默认 SQLite + 首次运行/切换库自动建库建表与初始化数据**（§5.11.5）；⑪**异步读写能力对照**（§5.17 + §15.5，`EntityQueue` 等价）。新增决策 D-37~D-41，工作量 90 → **93 人月**（MVP 53 → **55**）。
> **v4.3.3 追加**（历史）：**AI 就绪从迁移第一天起 + Spring AI Alibaba 替代评估并入方案**（D-36）——新增 §5.15（AI 就绪与 `ai` 插件：现状基线 / Spring AI 1.1.2 + Spring AI Alibaba 1.1.2.2 选型 / 三条硬约束 / 内核与插件切分 / 模型热切换 / 工具安全 / AI-1~AI-7 验收）、新增内核模块 `cube-kernel-ai`（K16）与 §15.6 对照；AI 3.0 → **4.0 人月**（内核 0.5 + 插件 3.5）；P1 切片前置"AI 就绪骨架"。
> **v4.3.2 追加**（历史）：**分库分表 / 雪花 ID / 读写分离按 XCode 语义同步迁移**（D-35）——重写 §5.7：ConnName 跨库、`TimeShardPolicy`（区间推导/条件裁剪/缺范围抛错）、`DataScale` 两种语义（`time` / `timeShard:fmt`）、AutoShard 分页语义、分片 DDL 与历史分片命名、`EntitySplit` 并发教训、雪花 ID（41/10/12 兼容布局 + workerId/时钟回拨）、`ReadWriteStrategy`；新增 SHARD-1~7 与 ID-1~4 验收。
> **v4.3.1 核实补记**（历史）：**§5.9 / §4.7 修订**——经核实，零代码展现 7 项（七视图 / 查询 / 条件填色 / 多级分组 / 洞察面板 / 工作台 / 自动化）在 .NET + ArcoVue **已全部交付**（OSC 归档见可行性篇 §9.6），因此 **取消"填色/分组需后端补齐"**：填色规则存 `ViewsJson` 由前端求值、表格分组为前端组头行、筛选已服务端化；`cube:Presentation` 文件化 DSL 与 `/meta` 扩展键**降级为可选增强（默认不做）**；K9 7.0 → 4.5。
> **v4.3 修订要点**（历史，9 项需求落地）：①前端**只保 ArcoVue**，其余 SPA 与 MVC 主题不迁移（§0.5 D-25、§1）；②调度改为**内核 K15 + AntJob 平台能力 + XXL-Job 协议插件**，取消外部第三方调度组件（§5.13、D-26/D-27）；③文件存储做成 `storage` 系统插件，支持 **MinIO / 云 OSS**（§5.14、D-28）；④工作流定为 **Flowable + flowgram.ai 设计器**，实体业务逻辑按 Flowable 升级（§7.15、D-29）；⑤以 **NewLife.Core** 为底层组件语义基准（§15.4、D-30）；⑥菜单**按插件控制器自动生成/更新**（§7.7、D-31）；⑦**CubeDemo 全插件化**作为示范集（§7.14、D-32）；⑧数据库收敛为 **6 种**、缓存定为 **L1 本地 + L2 Redis**（§5.5、§5.11、D-33）。
> **v4.2 修订要点**（历史）：①9 项决策收口（§0.5 D-16~D-24）；②MQ 收敛为 **RabbitMQ 4.4.x + RocketMQ 5.5.x**（§5.12）；③授权宽限 30 天（§7.9）；④审计保留期/尺寸/提供者全配置化（§13.2.2）；⑤dev/test/prod 三环境档案（§9.1）；⑥仅内嵌 Tomcat。
> **v4.0 修订要点**（历史）：①15 项未决问题决策落地（§0.5）；②数据库**配置式切换**（§5.11）；③MQ **可配置**（§5.12）；④L2 热升级**生产级硬化**（§7.5.1）；⑤Trace Provider 可插拔（SkyWalking/无）+ 日志**双落点**（§13.2.1/§13.2.2）；⑥升级路径 JDK 25 + Boot 4.x（§0.6）。
> **v2.0 修订要点**（历史）：
> 1. **热插拔颗粒度修正为「插件」** —— 不是实体类、不是控制器、不是元数据条目（§7.0）
> 2. **交付形态修正为非 SaaS（私有化/内部部署）** —— 由此重估许可证判定与部署架构（§0.4、§10）
> 3. 新增：插件依赖图与级联停用、停用语义、配置型插件、离线升级、授权插件
> **技术基线**：JDK 21 LTS + Spring Boot 3.5.x + Spring Cloud Alibaba 2025.0.0.0 + **Spring AI 1.1.2 / Spring AI Alibaba 1.1.2.2（AI 插件）**
> **日期**：2026-11-14

---

## 0. 设计目标与硬约束

### 0.1 四条硬要求

| # | 要求 | 架构落点 |
|---|---|---|
| G1 | **插件化**：系统插件 + 业务插件均可热插拔，**颗粒度为插件** | §7 插件体系 |
| G2 | **业务仅引用基础组件** | §9 Maven BOM + 唯一 starter + ArchUnit 门禁 |
| G3 | **只需定义 Model.xml，CRUD/常用功能自动生成** | §4 代码生成 + §5 通用 CRUD 引擎 |
| G4 | **借鉴 XCode 分部类：模型定义与业务代码分离** | §4.4 `Xxx.java` / `XxxBiz.java` 双文件契约 |
| **G5** | **保留并强化零代码展现能力**：多维视图、自定义查询、填色、分组、自动化、页面洞察面板、首页工作台/看板（**现状已全部实现**） | §5.9 展现层契约（复刻）+ §5.10 自动化引擎；§4.7 文件化 DSL 为**可选增强** |
| **G6** | **微内核从第一天就按水平扩展与微服务化设计**，同时支持小型项目单体简单部署、大型项目模块级拆分 | §1.2 三档部署形态 + §1.3 拆分就绪规则 |
| **G7** | **日志诊断与 APM 从第一天纳入设计** | §13 可观测与诊断（含内置诊断插件） |

> **G1 的精确含义**> **G1 的精确含义**（本次修正的核心）：一次热插拔操作的对象是**一个插件包**，它同时带走/带来 N 个实体、N 条路由、菜单、权限位、作业、缓存、前端资源、DB 迁移。
> 内核**不提供**"单独注册某个实体/字段/路由"的公开通道 —— 那会产生半加载状态、孤儿元数据、类加载器与元数据生命周期错配。

### 0.2 不可破坏的约束

| 约束 | 来源 | 说明 |
|---|---|---|
| C1 | Cube 契约冻结 | 前端零改动 ⇒ `/meta`、信封、分页、令牌、租户头逐条等价（§6） |
| C2 | 商用许可（**非 SaaS**） | 判定标准由"是否 SaaS"改为"**是否向客户分发二进制**"（§10） |
| C3 | 多副本一致 | 现有 15 项进程内状态必须外置（§5.8） |
| C4 | 信创 + 离线可用 | 数据库**只做六种**：SQLite / MySQL / PostgreSQL / 金仓 KingBase / 海量 VastBase / 达梦 DM；内网无外网可运行 |
| C5 | 运行基线（D-38 / D-41） | **默认 SQLite 单文件库**，首次运行自动建库/建表/播种；**结构变更由内核按 Model.xml 自动完成**，部署与开发人员不跑 DDL 脚本；升级默认**在线**、离线为备选（§7.12） |

### 0.3 明确不做（继承魔方理念边界）

- 不为少数复杂页面破坏通用模型 → 复杂页面走**插件自定义控制器**，不改内核
- 不把"运行期动态注册"当成插件体系 → 热插拔必须有 ClassLoader 隔离、依赖图、版本、回滚、资源回收（§7.10）
- 不让前端推断后端规则 → 语义一律经 `/meta` 下发
- **前端首期只保一套**：ArcoVue；其余 8 套 SPA 皮肤与 7 套 MVC 主题不迁移、不验收（内核仍只产 HTTP 契约，未来接新前端不需要改后端）
- **不引入外部第三方调度组件**（PowerJob / Quartz / Hangfire 等）→ 调度是内核能力 K15 + 可选调度插件（§5.13）
- **不做 R2DBC / 双访问栈** → 读侧异步用虚拟线程承接阻塞 JDBC，写侧异步用 `AsyncWriteQueue`（§5.17）
- **不做"有数据的库自动搬数据"** → 换库只自动建结构 + 播种；数据迁移必须显式声明或走人工（§5.11.5）
- **不改 `ViewProfile` / `QueriesJson` / `DashboardJson` 的结构** → 前端已保存的配置必须原样可读（§5.9.5）
- **布局类配置不进 `Parameter`** → 个人/模板布局归 `ViewProfile`、首页归 `UserProfile`；`Parameter` 只放全局共享的运行态数据（§5.16）

### 0.4 非 SaaS 交付形态对架构的影响（新增）

平台定位为**私有化部署 / 内部部署**（不对外提供 SaaS 服务），带来 7 项架构约束：

| # | 约束 | 架构含义 |
|---|---|---|
| P1 | **客户内网、常无外网** | 依赖全自托管；镜像离线导入；AI 必须支持本地模型（Ollama/vLLM）；插件升级**默认在线、无外网自动降级离线包**（§7.12） |
| P2 | **数据库是客户的**（达梦/金仓/海量/MySQL/PG 概率高） | 方言覆盖从"可选"升级为**硬需求**；DDL 兼容性风险最高 |
| P3 | **硬件规格不确定**（可能 4C8G） | 缓存规模必须可配且能降级为"关闭"；不能假设大内存；启动时间要短 |
| P4 | **升级窗口由客户给，且常要求不停机** | **这是热插拔诉求的真实动因** → 插件级热升级优先级最高（§7.5） |
| P5 | **可能 1~3 节点，不追求弹性伸缩** | 集群一致性可用最简方案（DB 轮询），不必强上 MQ/注册中心 |
| P6 | **需要授权控制**（到期/节点数/模块许可） | 新增 `cube-plugin-license` 系统插件（§7.9） |
| P7 | **可观测性不能依赖公网** | 日志/指标本地落盘或客户自建 Prometheus；链路采样率可关 |

> 结论：非 SaaS 使**热插拔从"锦上添花"变成"交付刚需"**，同时使集群复杂度下降、离线能力要求上升。

---

### 0.5 决策基线（41 项：15 首轮 + 9 二轮 + 9 v4.3 + 1 v4.3.1 + 1 v4.3.2 + 1 v4.3.3 + 5 v4.3.4）

| # | 决策 | 架构影响 | 落点 |
|---|---|---|---|
| D-01 | **私有化交付为主，同时大量自用系统** | 许可按"是否分发二进制"判定；交付物需 SBOM + 安装包 + 离线包；环境差异用 **dev/test/prod 三套 Profile**（不区分"交付态/自用态"，D-24） | §10、§9.1 |
| D-02 | 后期升级 **JDK 25 LTS + Boot 4.x** | 禁止使用 Boot 3.5 独有便利；CI 双目标编译提前验证 | §0.6 |
| D-03 | **全新项目，不涉及下游 .NET 系统** | 无下游兼容包袱；`cube-migrate` 用途转为**迁移平台自身**（39 控制器 + CubeDemo） | 可行性篇 §2.3 |
| D-04 | **不保留 .NET 版本，且冻结 .NET 侧功能变更** | 平台源码归档、不再发 .NET 新版本；P0 起只修 P0 级缺陷。契约基线是**长期回归资产**（防 Java 自身漂移）；爆炸半径 = 平台 + CubeDemo + AntJob 试点 | §11、§12 |
| D-05 | 信创中间件不验收；**仅内嵌 Tomcat** | 明确不做 war 外置容器部署（D-21），无 TongWeb/Apusic 适配工作 | §10 |
| D-06 | **Workflow / AI 纳入首期** | 不裁剪；AI 需 MCP + SSE + 工具回传 + 本地模型 | §12 |
| D-07 | **L2 热升级生产启用** | 需生产级硬化：双版本并行、快照回滚、节点灰度、泄漏哨兵 | §7.5.1 |
| D-08 | 数据库由项目交付；**配置式替换不同数据库** | `DbProvider` SPI + 驱动外置加载 + 方言能力矩阵 | §5.11 |
| D-09 | 授权到期**降级为只读** | 只读模式拒绝写操作、允许查询与导出 | §7.9 |
| D-10 | 客户集群用 MQ，**可配置不同 MQ 服务器** | `EventTransport` SPI：db/rocketmq/kafka/rabbitmq/activemq | §5.12 |
| D-11 | 零代码能力按现有 P2/P3 排期 | 切片不变 | §12 |
| D-12 | 自助可视化配置界面参考 ArcoVue 方案 | 后端实现 11 类对象与端点（UserProfile/ViewProfile/EntityComment/Workbench/Widget/Automation/Inbox/AI/Lov/Log/Attachment） | §12.2 |
| D-13 | （L 档拆分场景待明确） | K14 先做接口预留与门禁，**不实际拆分** | §1.3 |
| D-14 | 可观测数据（含审计）**落客户 DB 或硬盘** | 日志双落点：文件（Logback）+ 数据库（自研异步批量写入） | §13.2.2 |
| D-15 | APM 用 **SkyWalking**，可插拔，**未配置则不记 Trace** | Trace Provider SPI；`none` 时仍生成 `traceId`（信封契约不可破），但不建 Span 不上报 | §13.2.1 |
| **D-16** | 冻结 .NET 侧平台功能变更 | P0 起 .NET 仅修 P0 级缺陷；需预留少量兜底人力 | 可行性篇 §2.3 |
| **D-17** | **全新项目，不考虑下游 .NET 系统** | 无下游兼容目标；契约基线定位为"回归基线"而非"迁移差分" | 可行性篇 §2.3 |
| **D-18** | 选 **`NewLife.AntJob`** 做试点验证 | 真实业务系统验证（98 `.cs` / 12,469 行）；P4 阶段 +1.5 人月 | 可行性篇 §2.4 |
| **D-19** | **`cube-migrate` MVP 本次交付** | 用途 = 迁移平台自身 39 个控制器的声明式配置 | 可行性篇 §2.3.2 |
| **D-20** | **MQ 主用 RabbitMQ + RocketMQ 最新稳定版** | 实现 RabbitMQ **4.4.x** / RocketMQ **5.5.x**；Kafka/ActiveMQ 仅留 SPI 不实现 | §5.12 |
| **D-21** | 不做 war 外置容器部署 | 仅内嵌 Tomcat；删除 war profile | §10 |
| **D-22** | 授权到期**宽限期 30 天** | 30 天内全功能 + 每日告警；之后转只读 | §7.9 |
| **D-23** | 审计保留期/尺寸/提供者**全配置化** | `sink`/`retention-days`/`max-bytes`/`backups`/`table`/`datasource` 均可配 | §13.2.2 |
| **D-24** | 用 **dev/test/prod** 环境区分（不区分交付态/自用态） | Spring Profiles 三套；配置 Schema 校验 + 差异白名单 | §9.1 |
| **D-25** | **前端仅锁定 ArcoVue**（A11 落定） | 只验收 `NewLife.Cube.ArcoVue`；其余 8 套 SPA 皮肤与 7 套 MVC 主题不迁移、不验收，不进 L2/L3 基线 | §1、§11.1、§12 |
| **D-26** | **AntJob 迁移为平台能力 + 系统插件**（A1 落定） | 内核 K15 负责 Cron 语义/触发/抢占/执行历史；内置单机执行器；`job-ant` 插件承载 AntJob 的 Data/Time/Message 三模式与 Server/Agent；**不再引入任何外部第三方调度组件** | §5.13 |
| **D-27** | **XXL-Job 以"协议兼容插件"支持**，不内嵌 `xxl-job-core` | 自研 `job-xxl` 执行器（仅 HTTP/JSON 协议，无 GPL 代码），避免 GPL-3.0 传染；D1 内部自用场景可选用官方 executor | §5.13.5、§10.4 |
| **D-28** | **文件/附件存储做成系统插件 `storage`，支持 MinIO / 云 OSS**（A2 落定） | 统一 `ObjectStorage` SPI：local / NAS / S3 兼容（MinIO、阿里云 OSS、腾讯 COS、七牛 Kodo）；MinIO 采用 AGPL-3.0 独立进程方式合规使用 | §5.14、§7.1、§10.5 |
| **D-29** | **工作流 = Flowable + flowgram.ai**（A18 落定） | 引擎 Flowable 7.x（Apache-2.0）；前端画布 flowgram.ai（MIT）；现有 Workflow 实体与业务逻辑**按 Flowable 模型升级**（引擎表 + 业务扩展表） | §7.15 |
| **D-30** | **底层基础组件以 NewLife.Core 为语义基准** | 逐项对照 `ICacheProvider`/`TimerX`/`Cron`/`IPlugin`/`ITracer`/`EventBus`/`DeferredQueue`/`Snowflake` 等再定 Java 落点，避免"凭印象重设计" | §15.4 |
| **D-31** | **菜单按插件控制器自动生成/更新** | 插件描述符 + 控制器注解 → 差量生成菜单与权限位；管理员/用户的手工调整存覆盖层，**生成不覆盖人工修改** | §7.7 |
| **D-32** | **CubeDemo 非核心能力全部插件化** | CubeDemo 转为"插件示范集"（配置型/代码型/自定义控制器/配置控制器各一），删除所有 demo 插件后平台仍可运行 | §7.14、§11.5 |
| **D-33** | **数据库收敛为 6 种；缓存 = L1 本地 + L2 Redis** | 方言只实现 SQLite/MySQL/PG/金仓/海量/达梦；缓存对齐 `ICacheProvider` 两级模型，Redis 为唯一分布式实现（单机可只用 L1） | §5.5、§5.11、§11.5 |
| **D-34** | **零代码展现 = 契约复刻，不做后端补齐** | 7 项能力在 .NET + ArcoVue **已全部交付**；填色（规则存 `ViewsJson`）与表格分组均在**前端求值**，后端只提供配置容器、筛选下推与 Widget 聚合；`cube:Presentation` DSL 与 `/meta` 扩展键**默认不做** | §4.7、§5.9、可行性篇 §9.6 |
| **D-35** | **分库分表 / 雪花 ID / 读写分离按 XCode 语义同步迁移** | `ConnName` 跨库（无跨库事务）；`TimeShardPolicy` 语义逐条对齐（区间推导/条件裁剪/缺范围抛错/批量分组）；`DataScale=time` 与 `timeShard:fmt` 两种语义；雪花 ID **41/10/12 + epoch 1970** 与 .NET 兼容；`ReadWriteStrategy` 四条件；历史分片命名不可改 | §5.7、§15.5、可行性篇 §5.2 |
| **D-36** | **AI 就绪从第一天起；AI 层用 Spring AI + Spring AI Alibaba 替代 NewLife.AI** | 评估结论：**可行**（分层替代）——`ChatClient`/工具/MCP/ChatMemory/流式/多模态由 **Spring AI 1.1.2**（Apache-2.0）覆盖；多智能体与 Graph 编排由 **Spring AI Alibaba 1.1.2.2**（Apache-2.0）可选覆盖；**Cube 自研薄层**保留 `/Ai/AiChat` SSE 契约、动态工具注册、模型配置热切换、用量审计与权限裁剪；不复刻 Studio/Admin、IM 渠道与 46 家服务商元数据。内核 `cube-kernel-ai`（K16）从 P1 起提供 ToolRegistry / AiContext / MCP server 骨架 | §5.15、§15.6、可行性篇 §9.8 |
| **D-37** | **注册接口定名 `PluginRegistry`；生成物覆盖策略按 Cube 实测修正** | 注册原子单位是**插件域**（实体元数据只是一载荷），故不叫 `EntityRegistry`；生成物三分：数据类**每次覆盖**、`*Biz` 与 `*Controller` **存在即跳过**（后者含 `Search` 等业务代码，Cube 实测确认 `ClassBuilder` 仅在 `File.Exists==false` 时写盘）；并提供**三级泛型基类链**（平台 `AbstractEntityController<E,M>` → 项目基类 → 插件控制器），使每个子系统可在项目级基类集中放系统级扩展 | §3.4、§4.3、§4.4 |
| **D-38** | **插件安装/更新时自动结构同步（SchemaSync）** | 微内核按 `Model.xml` 推导 `IDataTable(model)` 与库中 `IDataTable(db)` 比对，自动执行建库/建表/加列/加索引（四档 Migration：`Off`/`ReadOnly`/`On`/`Full`，表级只能收紧），**对部署与开发人员透明**；脚本迁移仅保留给自动表达不了的场景（数据回填、破坏性改造）；默认**先备份点再改结构**并全程审计 | §7.8.1、§7.4 |
| **D-39** | **`Parameter` 升级为运行态参数中心** | 同一张表承载 4 类运行态数据：系统配置 / LOV 值集 / 自定义查询（预定义查询）/ 自定义字典；保留 `UserID=0` 系统级语义与 `Kind`、`Ex1~Ex6` 扩展位，新增作用域、域归属、格式、版本字段；不从 `ViewProfile` 抢职责（视图布局仍归 `ViewProfile`） | §5.16 |
| **D-40** | **系统升级在线（默认）/ 离线双模** | 默认**在线升级**：更新源清单 + 签名校验 + 灰度/暂停 + 断点续传 + 失败自动回滚；**离线升级**同一套校验与回滚路径，仅传输通道不同（内网/无外网客户）| §7.12 |
| **D-41** | **运行基线：默认 SQLite 自动初始化 + 异步批写** | 平台默认数据源 = **SQLite 文件库**；首次运行或切换数据库时自动**建库 → 建表 → 初始化数据**（对齐 XCode `CreateDatabase` + 反向工程 + `InitData`），无需手工建库脚本；写入侧提供 `EntityQueue` 等价物（异步批量 + 延迟队列 + 背压 + 自适应周期），仅用于日志/审计/统计等可容忍延迟场景 | §5.11.5、§5.17 |

### 0.6 版本升级路径（JDK 25 LTS + Boot 4.x）

| 约束 | 说明 |
|---|---|
| 只用 JDK 17+ 稳定 API | 避免使用会在 25 中改变语义的实验特性（`ScopedValue` 在 21 为预览，25 才正式 → 21 基线不用） |
| 命名空间 | 全程 `jakarta.*`（Boot 3 已强制），避免回退 `javax.*` |
| 自动配置注册 | 统一 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`，不用旧 `spring.factories` |
| HTTP 客户端 | 优先 `RestClient`，不新引入 `RestTemplate` 用法 |
| 配置绑定 | 构造器绑定 `@ConfigurationProperties`（Boot 3/4 均推荐） |
| 序列化 | 序列化定制集中在 `JacksonConfig`，降低 Boot 4 换 Jackson 3 的改动面 |
| 安全 | 使用组件化的 `SecurityFilterChain` Bean，不继承已移除的 `WebSecurityConfigurerAdapter` |

**双目标门禁**：从 P2 起 CI 增加 `-Pboot4` profile（编译 + 单测，不部署），确保升级不是"到时候再改"。
**JDK 25 关注点**：虚拟线程默认开启后的 ThreadLocal 行为（`TransmittableThreadLocal` 需实测）；`ScopedValue` 可替代部分显式传参；GC（G1→分代 ZGC 可选）。

## 1. 总体架构

```
┌──────────────────────────────────────────────────────────────────────┐
│  前端（首期唯一）：NewLife.Cube.ArcoVue（Vue3 + Arco Design Vue）     │
│  其余 8 套 SPA 皮肤 / 7 套 MVC 主题：不迁移、不验收（D-25）            │
│  契约：统一信封 + /meta + 通用 CRUD + 令牌 + X-Tenant                │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ HTTP / SSE
┌──────────────────────────────────▼───────────────────────────────────┐
│                    cube-kernel（微内核，稳定，不可热插拔）             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │ K1 meta    │ │ K2 dsl     │ │ K3 codegen │ │ K4 data          │  │
│  │ 元数据模型  │ │ Model.xml  │ │ 生成引擎    │ │ 通用数据访问引擎  │  │
│  │ Registry   │ │ 解析/校验   │ │ 模板/增量   │ │ 表达式/方言/缓存  │  │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌────────────────────────────────┐   │
│  │ K5 web     │ │ K6 security│ │ K7 plugin（PF4J 封装）          │   │
│  │ 通用控制器  │ │ 认证/权限   │ │ 插件域/依赖图/生命周期/回滚      │   │
│  │ /meta 生成 │ │ 租户/菜单   │ │ 类加载隔离/资源回收/离线包       │   │
│  └────────────┘ └────────────┘ └────────────────────────────────┘   │
│  ┌──────────────────────────────┐ ┌──────────────────────────────┐  │
│  │ K15 job：Cron 语义/触发/抢占   │ │ K8 spi：ExtensionPoint 声明   │  │
│  │ 单机执行器/执行历史/管理 API   │ │ KernelBus（事件）+ i18n       │  │
│  └──────────────────────────────┘ └──────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ K16 ai-ready：ToolRegistry + AiContext（权限/租户）+ MCP server │  │
│  │ + SSE 契约基座（/Ai/AiChat 事件与序列化口径，D-36）              │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬───────────────────────────────────┘
        ┌──────────────┬──────────┴────────┬──────────────┐
        ▼              ▼                   ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 基础系统插件  │ │ 可选系统插件  │ │ 业务插件 A    │ │ 业务插件 B    │
│ admin/perm   │ │ storage/file │ │ 代码型        │ │ 配置型        │
│ （强制）      │ │ job-ant/job- │ │ Model.xml+代码│ │ 仅 Model.xml  │
│              │ │ xxl/workflow │ │              │ │              │
│              │ │ ai（P2/P4）  │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
        │              │                   │              │
        └──────────────┴───────────────────┴──────────────┘
                              ▼
   DB（SQLite / MySQL / PostgreSQL / 金仓 KingBase / 海量 VastBase / 达梦 DM）
   缓存（L1 Caffeine 进程内 + L2 Redis 跨进程；单机可只开 L1）
   文件（本地 / NAS / S3 兼容：MinIO、阿里云 OSS、腾讯 COS、七牛 Kodo）
   调度（内核 K15 内置，零外部组件） · 工作流（Flowable 引擎 + flowgram.ai 画布）
   AI 模型（默认 Ollama / vLLM（OpenAI 兼容），可选 DashScope·Anthropic·Gemini；离线可跑）
   Nacos（可选） · OpenTelemetry / SkyWalking（可选）
```

### 1.1 依赖规则（ArchUnit 强制）

| 规则 | 说明 |
|---|---|
| R1 | 插件 → 内核：**只允许**依赖 `cube-kernel-api`（运行时由 starter 传递） |
| R2 | 插件 → 插件：**禁止**直接依赖；跨插件协作只经 `KernelBus`（事件）或 `ExtensionPoint`（版本化接口） |
| R3 | 内核 → 插件：**禁止**。内核不得 import 任何插件包 |
| R4 | 插件 → ORM/框架具体类型：**禁止**（MyBatis/Caffeine/Jackson 只在核内） |
| R5 | **系统插件不得依赖业务插件**（单向：业务 → 系统） |
| R6 | 内核内部 `.internal.` 包对插件不可见（JPMS + ArchUnit 双约束） |

---

### 1.2 三档部署形态（同一份二进制，只改配置与拓扑）

| 形态 | 适用规模 | 进程拓扑 | 必须组件 | 可选组件 | 配置 |
|---|---|---|---|---|---|
| **S 单机** | 小项目 / 试点 / ≤200 并发 | 1 进程（内核 + 全部插件 in-process） | DB（SQLite/PG/MySQL 等）+ 本地磁盘 | 无 | `cube.deploy.mode=monolith` |
| **M 集群** | 中型 / 2~5 节点 | N 个同构进程（插件全量） | DB + **Redis（L2 缓存/锁/队列）** + **内核 K15 调度（DB 抢占）** | `job-ant` 插件集群、Nacos、网关 | `cube.deploy.mode=cluster` |
| **L 微服务** | 大型 / 需按模块伸缩 | 内核（对称）+ 卫星服务（按插件组拆分） | 注册配置中心（Nacos）+ 网关（Spring Cloud Gateway）+ 消息（RocketMQ / 或 DB 事件表）+ 每服务独立 schema | `job-ant` 独立部署（调度卫星服务） | `cube.deploy.mode=distributed` |

> **关键**：S/M/L 不是三套代码，而是**同一套内核 + 插件**在不同拓扑下的装配结果。所有跨域交互在内核层已抽象为 `Dispatcher`（本地实现 / 远程实现），切换部署形态只换 Bean 与配置。

### 1.3 拆分就绪规则（从第一天就遵守，否则后期拆不动）

| # | 规则 | 说明 | 门禁 |
|---|---|---|---|
| S1 | 跨插件只经 `ExtensionPoint` / `KernelBus` | 禁止直接调用其他插件的类 | ArchUnit A1 |
| S2 | **禁止跨域 JOIN** | 域内可 JOIN；跨域必须经 API 组装（单体里也坚持） | SQL 静态检查（解析 `Filters`/XML 的 join 目标是否同域） |
| S3 | 无共享内存假设 | 缓存/锁/会话/事件全经 Provider | ArchUnit 禁 `static` 非 final、禁直用 `ConcurrentHashMap` |
| S4 | 每个 ExtensionPoint 有本地/远程双实现 | `LocalDispatcher` 与 `RemoteDispatcher` | 接口契约测试（同一套用例跑双实现） |
| S5 | 进程无状态 | 不写本地文件（除日志/临时）、不做节点亲和 | 检查 + 代码评审 |
| S6 | 跨域事件消费必须幂等 | 事件 SDK 强制携带 `eventId` + 消费位点 | 事件 SDK |
| S7 | 分布式 ID | 雪花 ID（与现状一致） | 内置 |
| S8 | 事务边界 | 单域本地事务；跨域"最终一致 + 补偿"，**不引入 Seata** | 设计评审 |
| S9 | 全链路上下文 | `traceparent` 在 S/M/L 一律传播 | 拦截器（§13） |
| S10 | 配置外置 | 不硬编码；统一 `CubeConfig` | 检查 |

#### 卫星服务拆分优先级（L 档）

| 插件 | 拆分建议 | 理由 |
|---|---|---|
| `ai` | ✅ 优先 | 重 IO、慢调用、需独立伸缩与限流 |
| `job-ant` | ✅ 优先 | 切片调度天然独立、可单点/独立部署 |
| `file` / `storage` | ✅ 优先 | 存储 IO 密集、可直接对接对象存储 |
| `workflow` | ✅ 可拆 | 长流程状态机，与主链路弱耦合 |
| `notify` | ✅ 可拆 | 外部通道不稳定，需独立熔断 |
| `admin` / `perm` | ❌ 不拆 | 权限是每请求热路径；拆了需"权限快照下发 + 本地缓存"（可选优化，非必需） |
| 内核（meta/web/data/plugin） | ❌ 不拆 | 对称部署，每节点都有完整内核 |

## 2. 内核模块划分

| 模块 | 职责 | 关键抽象 | 可替换性 |
|---|---|---|---|
| `cube-kernel-api` | 唯一对插件暴露的稳定 SPI | `EntityMeta`/`DataField`、`Filters`、`EntityHook`、`ExtensionPoint`、`KernelBus`、`RouteDefinition`、`PluginContext`、`ApiResponse` | 稳定，SemVer 管理 |
| `cube-kernel-meta` | 元数据模型 + Registry（按插件域组织）+ 多版本 + 失效广播 | `PluginRegistry`、`MetaVersion` | 不可替换 |
| `cube-kernel-dsl` | Model.xml 解析（含 `cube:` 展现扩展节点）、校验、规范化 | `ModelParser`、`ModelNormalizer` | 不可替换 |
| `cube-kernel-codegen` | 生成引擎（模板 + JavaPoet + 增量/覆盖规则 + 插件打包） | `GeneratorBuilder` SPI | 可扩展 |
| `cube-kernel-data` | 通用数据访问 + **数据库配置式切换**（方言/驱动外置加载/DDL）+ **分库分表路由与雪花 ID** + **自动结构同步（SchemaSync）/ 建库 / 播种初始化** + 异步批写 | `MetaSqlBuilder`、`DbProvider`、`DriverLoader`、`EntityInterceptor`、`ShardPolicy`、`SnowflakeId`、`SchemaSync`、`SeedInitializer`、`AsyncWriteQueue` | 方言/分片策略可插拔 |
| `cube-kernel-web` | 通用控制器、`/meta` 生成、信封、绑定、导入导出、文件、插件资源托管 | `EntityHandlerMapping`、`PageMetaBuilder` | 不可替换 |
| `cube-kernel-security` | 认证/令牌/权限/菜单/租户 | `TokenService`、`PermissionService`、`TenantContext` | 策略可替换 |
| `cube-kernel-plugin` | **插件域运行时**（分类/依赖图/生命周期/隔离/回收/离线包） | `PluginManager`、`PluginDomain`、`PluginDescriptor` | 不可替换 |
| `cube-kernel-i18n` | 消息 + 字段本地化 | `MessageSource` 扩展、`FieldLocalizer` | 词表可替换 |
| **`cube-kernel-view`** | **零代码展现契约**：配置容器（视图/查询/仪表盘/工作台）+ 筛选下推 + Widget 聚合（填色与分组在前端，无后端引擎） | `ViewConfigStore`、`QueryStore`、`WidgetQueryService`、`WorkbenchStore` | 配置存储可替换（库为权威） |
| **`cube-kernel-automation`** | **自动化引擎**：触发器/条件/动作/队列/重试/幂等/审计 | `TriggerRegistry`、`ActionRegistry`、`AutomationQueue` | 动作可插拔 |
| **`cube-kernel-obs`** | **可观测与诊断**：上下文/日志/指标/慢 SQL/诊断端点 | `TraceContext`、`DiagService`、`SlowSqlRecorder` | 导出器可插拔 |
| **`cube-kernel-cluster`** | **拆分就绪**：本地/远程双派发、配置、分布式锁、**可配置 MQ** | `Dispatcher`、`CubeLock`、`EventTransport`（db/rocketmq/kafka/rabbitmq/activemq） | Provider 可替换 |
| **`cube-kernel-ai`** | **AI 就绪骨架**（K16，D-36）：工具注册表、AI 上下文（用户/租户/权限/页面）、MCP server、SSE 契约基座 | `ToolProvider`、`AiContext`、`AiToolGuard`、`AiSseWriter` | 工具来源可插拔；模型与编排在插件层 |

---

## 3. 元数据内核（K1）

### 3.1 第一级元数据：`FieldMeta`（物理层，源自 Model.xml）

`FieldMeta` 必须承载以下属性，**一个都不能少**（否则 `/meta` 无法等价）：

| 属性 | 类型 | 默认 | 用途 |
|---|---|---|---|
| `name` | String | — | 属性名 |
| `columnName` | String | = name | 物理列名 |
| `type` | `FieldType` | — | 映射 Java 类型 + SQL 类型 |
| `rawType` | String | "" | 原生 DB 类型（`decimal(18,2)`） |
| `length` | int | 0 | 字符串长度 / 大文本 -1 |
| `precision` / `scale` | Integer | null | 数值精度 |
| `nullable` | boolean | false | 可空 |
| `primaryKey` | boolean | false | 主键 |
| `identity` | boolean | false | 自增 |
| `master` | boolean | false | 主显示字段 |
| `readOnly` | boolean | 由 setter 推导 | 只读 |
| `description` | String | — | 说明 |
| `displayName` | String | 由 description/name 推导 | 显示名（本地化入口） |
| `category` | String | null | 表单分组 |
| `itemType` | String | "" | **开放字符串**（§3.3） |
| `showIn` | String | Auto | 展示控制（§3.2） |
| `map` | `MapMeta` | null | 外键（表@主键@显示字段@属性名） |
| `dataScale` | String | "" | `time` / `timeShard:yyMMdd` |
| `defaultValue` | String | null | DB 默认值 |
| `enumType` | String | null | 枚举类全名 |
| `attribute` | List\<String> | [] | 额外特性 |
| `model` | boolean | true | 是否进 DTO |

### 3.1.1 第二级元数据：`DataField`（契约层，31 个属性）

XCode `FieldItem` 只描述"数据库列"，而 `/meta` 实际下发的是 Cube 侧 `DataField`（`NewLife.Cube/ViewModels/DataField.cs`）。**Java 侧必须建两个对象层次，不可合并**：

```
Model.xml ──(K2)──► FieldMeta（物理层）
                        │ + 控制器声明（ListFields/FormFields/SearchFields）
                        │ + 权限/租户上下文
                        ▼
                    DataField（契约层，31 属性）
                        │ + 场景（list/form/search/detail/toolbar）
                        ▼
                    /meta JSON
```

`DataField` 全属性（逐项必须实现）：

| 分组 | 属性 |
|---|---|
| 标识 | `Name`、`DisplayName`、`Description`、`SourceDescription`、`IsDefaultDisplayName` |
| 分类 | `Category` |
| 类型 | `TypeName`、`ItemType` |
| 约束 | `Length`、`Precision`、`Scale`、`Nullable`、`Required`、`ReadOnly`、`Visible`、`PrimaryKey`、`Indexed` |
| 显示 | `Column`、`DataVisible`、`Authority`、`Sensitive` |
| 关联 | `Field`（物理列，`null` ⇒ 虚拟字段）、`MapField`、`ValueField`、`MapProvider` |
| 字典 | `LovCode`、`DataSource`、`DataSourceMap` |
| 扩展 | `Extended1`、`Extended2`、`Extended3` |

> `IsDefaultDisplayName=true` 表示显示名由系统推导（本地化时可覆盖）；`SourceDescription` 是未本地化的原始说明。

### 3.2 ShowIn 三种语法（必须全支持）

| 语法 | 样例 | 解析规则 |
|---|---|---|
| 具名列表 | `List,Search`、`All,-Detail`、`None,Search,Add`、`+Search`、`!Search` | 五位置：List/Detail/AddForm/EditForm/Search；`All`=全集，`None`=空集，`-`/`!`=移除，`+`=追加 |
| 管道五段 | `Y|Y|N||A` | `Y`=显示 `N`=隐藏 `A`=自动 空=未指定 |
| 五字符掩码 | `10A?-` | 每字符一位置：`1`/`0`/`A`/`?`/`-` |

解析为 `ShowInOption { boolean list, detail, add, edit, search }` + `auto` 标记。**把 XCode `ShowInOptionTests` 用例集原样移植为 Java 参数化测试**。

### 3.3 `itemType` 标准常量（开放集合）

```
input, textarea, number, money, percent, switch, date, datetime, time, TimeSpan,
singleSelect, multipleSelect, lov, cascader, area1..area4, upload, image, file,
richHtml, html, code, json, url, mail, mobile, GMK
```

- 常量集中定义在 `ItemTypes`，运行期**允许任意字符串透传**（未知值原样下发）
- Java 侧只负责转发，**不得做白名单裁剪**（前端 `useFieldInput`/`FieldInput.vue` 决定控件）

### 3.4 Registry：**以插件域为原子单位**（G1 修正点；v4.3.4 定名 `PluginRegistry`）

> **为什么叫 `PluginRegistry` 而不是 `EntityRegistry`（D-37）**：
> ① **注册的原子单位是插件域**——`registerDomain` / `unregisterDomain` / `version(pluginId)` 全部以 `pluginId` 为键，实体元数据只是这个域里的一项载荷；
> ② **载荷不止实体**——同一个事务里还要注册路由、菜单、权限位、作业、扩展点（见 §7.4 `register` 阶段），叫 `Entity*` 会误导后来者以为"注册实体就算注册完插件"；
> ③ **与术语体系一致**——§7.0 定"热插拔颗粒度 = 插件包"，Cube 侧对应 `AppModule`（应用插件）与 `cube_plugin_domain` 表，命名必须跟这条主线走；实体的**元数据存储**另有其名：`MetaStore`（按 `pluginId + entityKey` 检索）。
> 若只想要"实体清单"，那是 `PluginRegistry.all()` 的一个视图，不构成独立抽象。

```java
public interface PluginRegistry {
    /** 整包注册：一个插件域的全部实体/路由/菜单/权限/作业，原子生效 */
    void registerDomain(PluginDomain domain, List<EntityMeta> metas);

    /** 整包注销：按插件域移除，原子生效 */
    void unregisterDomain(String pluginId);

    /** 按路由查找（area/controller → meta，内含所属 domain） */
    Optional<EntityMeta> get(String area, String controller);

    Collection<EntityMeta> all();
    MetaVersion version(String pluginId);       // 版本 = 插件版本 ★
}
```

| 能力 | 要求 |
|---|---|
| 原子性 | `registerDomain` 全成功或全失败（失败回滚整包，不留半加载） |
| 归属 | 每个 `EntityMeta` 必须带 `pluginId`；无归属的元数据一律拒绝注册 |
| 隔离 | 注销某域只影响该域的实体；跨域引用（项目内 Map 到别域实体）在**注册时校验**，注销时校验引用完整性 |
| 版本 | `MetaVersion = 插件版本 + model 内容 hash`；同域多版本共存支持灰度 |
| 并发 | 读路径无锁（写时复制快照）；写路径按域加锁 |
| 失效广播 | 域级事件 `PluginDomainChanged(pluginId, version, action)` → 各节点整域重载 |
| 持久化 | `cube_plugin_domain`（pluginId/version/hash/state）供节点重启快速装配与回滚 |

> **为什么不做单实体热注册**：(1) 类加载隔离要求"类 + 元数据 + 路由 + 资源"同生共死；(2) 单条注册失败会产生不一致状态，整包才能事务回滚；(3) 与 XCode/Cube 心智一致（业务模块 = 一个程序集含多个实体）。
> 代价：新增 1 个实体也要重装插件（秒级，可接受）——这正是"插件为颗粒度"的自觉取舍。

---

## 4. Model.xml 单一事实源（K2 + K3）

### 4.1 两种插件形态共用一条解析流水线

```
插件包（.cube 文件 = zip）
 ├─ Model.xml（可选，多个）
 ├─ lib/*.jar（代码型插件：含生成的实体/Biz/Controller）
 ├─ frontend/*（可选，前端资源）
 ├─ db/migration/*（DDL 脚本）
 └─ cube-plugin.json（描述符）
        │
        ├─ 代码型插件：编译期已由 codegen 生成 Java 源码 → 此处只有 JAR + model.json 快照
        └─ 配置型插件：只有 Model.xml → 加载时用同一解析器现场解析
                            │
                            ▼
                  cube-kernel-dsl（同一解析器）
                            │
                            ▼
           PluginRegistry.registerDomain(pluginId, metas)   ← 原子整包
```

| 形态 | 适用 | 是否需要编译 | 承载方式 |
|---|---|---|---|
| **代码型插件** | 有 Biz 业务逻辑、自定义控制器/服务 | 是（`mvn cube:generate` + 编译） | 插件 ClassLoader 加载 JAR |
| **配置型插件** | 纯 CRUD、字典类模块（约 30~40% 业务场景） | 否（只写 Model.xml） | 通用引擎承载，无插件类 |

> 两种形态**对内核完全等价**：都是"一个插件域 + 一组实体 + 一组路由 + 菜单权限"，生命周期与热插拔路径一致。这保证了"插件为颗粒度"不为代码型/配置型分裂出两套机制。

### 4.2 解析器实现

| 项 | 选型 | 说明 |
|---|---|---|
| XML 绑定 | Jakarta XML Binding 4.x | 直接绑定 `XCode/ModelSchema.xsd`（命名空间 `Model202604`） |
| 校验 | XSD 校验 + 业务规则（主键存在、Map 目标存在、DataScale 合法） | 错误定位到行号 |
| 规范化 | `FixTables`（补默认）→ `FixModelFile`（字段迁移/命名） | 与 XCode 一致 |

### 4.3 生成物清单（与 XCode / Cube 实测对齐，D-37）

> **v4.3.4 复核修正**：原表把 `OrderController.java` 标为"每次覆盖（纯声明）"是**错的**。Cube 生成器 `ClassBuilder.Save(String? ext = null, Boolean overwrite = true, Boolean chineseFileName = true)` 的实现是 `if (!File.Exists(p) || overwrite) File.WriteAllText(...)`，而 `CubeBuilder.BuildControllers` 调用的是 `builder.Save(null, false, false)`（`overwrite=false`）——即**控制器文件已存在就完全不写**。原因很实在：生成的控制器模板里带 `Search(Pager p)` 高级搜索骨架（真业务代码），覆盖即等于删掉客户的查询逻辑。区域类 `{Name}Area.cs` 同样是"存在即跳过"（`BuildArea` 里 `if (File.Exists(file)) return 0;`）。

| # | 生成物 | 覆盖策略 | 对应 XCode / Cube | 备注 |
|---|---|---|---|---|
| 1 | `Order.java`（数据类） | **每次覆盖** | `订单.cs` | 禁止手改，改 Model.xml |
| 2 | `OrderBiz.java`（业务类） | **存在即跳过** | `订单.Biz.cs` | 钩子 + 高级查询 |
| 3 | `OrderModel.java`（DTO） | 每次覆盖 | `订单Model.cs` | |
| 4 | `OrderApi.java`（接口） | 每次覆盖 | `I订单.cs` | |
| 5 | `OrderController.java` | **存在即跳过** | Cube 控制器（实测 `Save(..., overwrite:false)`） | 含 `Search` 骨架，**业务可在其中写处理逻辑** |
| 6 | `OrderMetaProvider.java` | 每次覆盖 | —（Java 新增） | 元数据装配 |
| 7 | `META-INF/cube/model/*.json` | 每次覆盖 | 数据字典 HTML（升级版） | 运行期快照 |
| 8 | `docs/*.md` | 每次覆盖 | `*.htm` | |
| 9 | `V{ts}__{table}.sql` | 写入 `target/cube-ddl/`，**不写 src** | Migration DDL | **仅作差异留档**：结构变更默认由 §7.8.1 自动完成 |
| 10 | `OrderSeed.java` / `db/seed/*.sql` | 存在即跳过 | `InitData` 播种 | 首次安装与升级共用（幂等） |

> **覆盖策略的判定原则**：**"人会不会往里写业务代码"** —— 会写的（Biz、Controller、Seed、自定义配置）一律"存在即跳过"；纯映射/纯契约（数据类、DTO、接口、元数据快照、文档）一律"每次覆盖"。这条原则比"是不是生成文件"更重要，也是 §4.4 三级基类设计的前提。

### 4.4 分部类语义的 Java 等价（G4）

Java 无 `partial class`，采用**约定 + 自动装配**：

```java
// ===== 生成，每次覆盖：entity/Order.java =====
@BindTable(name = "Order", conn = "Order", description = "订单。电商订单主表")
public class Order implements Persistable {
    public static final EntityKey KEY = EntityKey.of("Order", "Order");

    @BindColumn(primaryKey = true, dataScale = "time", description = "编号")
    private Long id;
    @BindColumn(master = true, length = 50, nullable = false, description = "订单号")
    private String orderNo;
    @BindColumn(map = "User@Id@Name", description = "用户")
    private Integer userId;
    // ... 全部字段 + getter/setter（显式生成，不用 Lombok，利于 AOT 与调试）
}
```

```java
// ===== 仅首次生成，之后由开发者自由修改：entity/OrderBiz.java =====
@BizOf(Order.class)                      // 插件域注册时自动装配
public class OrderBiz implements EntityHook<Order> {
    @Override public void validate(Order e, HookContext ctx) { /* 校验 */ }
    @Override public void beforeInsert(Order e, HookContext ctx) { /* 加工 */ }
    @Override public void afterInsert(Order e, HookContext ctx) { /* 联动 */ }

    // 高级查询：外部只传语义参数（对应 XCode Biz 的 Search/FindByXxx 约定）
    public PageResult<Order> search(Integer userId, LocalDateRange range, String key, Pager p) {
        return Filters.of(Order.KEY)
            .eq("UserId", userId)
            .between("CreateTime", range)
            .containsIf("OrderNo", key)
            .page(p).select();
    }
}
```

```java
// ===== 生成一次，之后由开发者自由修改：controller/OrderController.java =====
public class OrderController extends PlatformBaseController<Order, OrderModel> {
    @Override
    protected PageResult<Order> search(OrderQuery q, Pager p) {
        return OrderBiz.search(q, p);           // 业务逻辑写在这里（对应 Cube 原 Search 重写）
    }

    @PostMapping("/Order/Approve")
    @EntityAuthorize(PermissionFlags.Approve)
    public ApiResponse approve(@RequestParam Long id) { /* 自定义动作 */ }
}
```

**三级泛型基类链（D-37，平台 → 项目 → 插件）**

| 层级 | 类 / 接口 | 所在模块 | 谁维护 | 承载什么 |
|---|---|---|---|---|
| 平台级 | `AbstractEntityController<E extends Persistable, M>` | `cube-kernel-web` | 平台 | 通用 CRUD、`/meta`、分页排序、导入导出、文件、权限位与审计（**不可覆盖，随内核升级**） |
| 平台级 | `AbstractEntityBiz<E>` / `EntityHook<E>` | `cube-kernel-api` | 平台 | 钩子默认空实现 + `Filters` 便捷方法 + `PageResult` 封装 |
| **项目级** | `PlatformBaseController<E, M> extends AbstractEntityController<E, M>` | 业务项目 `src/main/java/{proj}/base/` | **项目/子系统自己** | **系统级横切**：统一响应包装、统一数据权限补丁、统一租户校验、统一审计字段、统一异常翻译 |
| **项目级** | `PlatformBaseBiz<E> implements EntityHook<E>` | 同上 | 项目 | 系统级钩子：全表软删、全表编码生成、全表变更留痕 |
| 插件级 | `OrderController extends PlatformBaseController<Order, OrderModel>` | 插件包 | 生成器 + 业务 | 实体特有的查询、自定义 Action、列表/表单微调 |

- **每个子系统允许自定义自己的泛型基类**（如 `MesBaseController<E,M>` / `CrmBaseController<E,M>` 再继承 `PlatformBaseController`），系统级差异不必污染平台内核，也不必逐个实体重复写。
- 生成器通过 **`cube-codegen.yaml`**（而不是塞进 `Model.xml`，避免污染 XSD）决定生成物的基类名与包名：`entityBase` / `bizBase` / `controllerBase` / `packageBase`；缺省取平台默认值，因此**同一套 Model.xml 在不同子系统可生成不同基类**。
- 实体数据类的基类仍由 `Model.xml` 的 `<Option><BaseClass>` 指定（与 XCode 一致），默认 `EntityBase`。

业务方**永远不修改生成的数据类/ DTO / 接口文件**（等效于 `.Biz.cs` 与控制器不被覆盖的现状）；`*Biz` 与 `*Controller` 属于"只生成一次"的资产，写入即归业务方所有。

### 4.5 生成器实现与扩展点

| 项 | 方案 |
|---|---|
| 宿主 | Maven Plugin（`generate-sources`）+ Gradle 任务；`mvn cube:generate` |
| 模板 | FreeMarker（骨架）+ JavaPoet（成员级语法安全） |
| 增量 | "存在性 + 覆盖策略表"；生成前写 `target/cube-codegen/manifest.json`（内容 hash），无变化不写盘 |
| Builder SPI | `GeneratorBuilder` + `ServiceLoader`，允许自定义文件生成（对应 XCode `CustomBuilder`） |
| 配置 | `Model.xml` `<Option>` 全量支持（Namespace/ConnName/Output/BaseClass/ChineseFileName/Nullable/HasIModel/ModelClass/ModelsOutput/ModelInterface/InterfacesOutput/ClassNameTemplate/DisplayNameTemplate/ExtendNameSpace/NameFormat/DisplayName/CubeOutput） |
| 插件打包 | `mvn cube:package` 产出 `.cube` 插件包（含描述符/资源/迁移脚本），供离线导入 |

### 4.6 "常用功能自动生成"覆盖矩阵

| 功能 | 是否需要业务代码 | 实现位置 |
|---|---|---|
| 列表/详情/新增/编辑/删除/恢复 | ❌ | 通用引擎 |
| 分页/排序/关键字/时间范围/条件过滤 | ❌ | 通用引擎 |
| 批量删除/批量改字段/全选启停 | ❌ | 通用引擎 |
| `PATCH` 局部 / `PUT` 全量 | ❌ | 通用引擎 |
| `/meta`（list/form/search/detail/toolbar） | ❌ | `PageMetaBuilder` |
| 导入/导出（Excel/CSV/JSON/XML/ZIP）/模板 | ❌ | 通用引擎 |
| 附件上传/文件下载 | ❌ | 通用引擎 |
| 数据字典文档 | ❌ | 代码生成器 |
| 审计字段自动填充 | ❌ | 内置拦截器 |
| 租户隔离 / 数据权限 | ❌ | 内置拦截器 |
| 树形实体 | ⚠️ `@BindTable(tree="ParentId")` | `TreeSupport` |
| 枚举/字典下拉 | ⚠️ Model.xml 声明 `Type`/`ItemType` | 引擎 + LOV |
| 外键联想（LOV 远程搜索） | ⚠️ Model.xml 声明 `Map` | 引擎 + LOV |
| 列表自定义链接列/工具栏按钮 | ⚠️ 在 `XxxBiz` 或 `XxxController` 声明 | 钩子 |
| **自定义查询 / 预定义查询** | ❌ **已由 ArcoVue 前端能力覆盖**（可视化条件构建 + 保存查询 + 快照恢复） | 通用引擎（`QueryStore` + 筛选下推） |
| **复杂业务查询（跨表/聚合/游标）** | ✅ `XxxBiz.search(...)`（**仅真正复杂的部分**；通用条件组合与保存查询已零代码） | 业务代码 |
| **数据库结构同步（建库/建表/加列/加索引）** | ❌ | 内核 `SchemaSync`（§7.8.1） |
| 审批流/状态机 | ✅ workflow 插件 | 业务代码 |
| 第三方集成 | ✅ 插件 | 业务代码 |

> 目标：**80~90% 场景只需 Model.xml**，10~20% 经 `XxxBiz`、`XxxController` 或插件扩展。
> **v4.3.4 更正**：原先把"复杂业务查询"整体划给业务代码是过度保守——ArcoVue 的「自定义查询（条件构建器）+ 预定义查询（保存/共享/恢复）」已把**条件组合类**查询零代码化（详见可行性篇 §9.6）。业务代码只需承接**跨表关联、聚合窗口、存储过程式逻辑**这类前端表达不了的部分。

---

### 4.7 零代码展现 DSL（**可选增强，不在对齐范围**）

> **v4.3.1 核实修订（D-34）**：现状（2026-11）七项零代码能力已在 .NET + ArcoVue **全部交付**，且配置权威源是**库**（`UserProfile` / `ViewProfile` / `Parameter`），前端已内置可视化编辑器。因此本节的文件化 DSL **降级为可选增强、默认不做**；对齐目标是**复刻现有契约**（可行性篇 §9.6）。
> 保留本节内容仅作为"未来把展现配置也纳入 Model.xml"的设计储备，以及 `cube:migrate-strip` 双向迁移（D4）的依据；**不得据此新增后端引擎**。

物理模型沿用 XCode 格式（保证既有模型可机械迁移）；若启用本增强，展现层配置通过**独立命名空间的扩展节点**声明在同一文件内：

```xml
<EntityModel xmlns="https://newlifex.com/Model202604.xsd"
             xmlns:cube="https://newlifex.com/cube/2026">
  <Option>...</Option>
  <Tables>
    <Table Name="Order" Description="订单">
      <Columns>...</Columns>
      <Indexes>...</Indexes>

      <cube:Presentation>                      <!-- ★ 零代码展现配置 -->
        <cube:Views default="grid">
          <cube:View name="默认表格" type="grid" shared="true">
            <cube:Columns order="OrderNo,Amount,Status,CreateTime" frozen="OrderNo"/>
            <cube:Colors>                      <!-- 填色 -->
              <cube:Color when="Status==2" target="row" token="warning"/>
              <cube:Color when="Amount>=10000 and Status==0" target="cell"
                          field="Amount" token="danger" bold="true"/>
            </cube:Colors>
            <cube:Groups>                      <!-- 分组 + 聚合 -->
              <cube:Group field="Status" order="asc" aggs="count,sum(Amount)"/>
            </cube:Groups>
          </cube:View>
          <cube:View name="看板" type="kanban">
            <cube:Kanban groupField="Status" titleField="OrderNo" cardFields="Amount,CreateTime"/>
          </cube:View>
          <cube:View name="甘特" type="gantt" start="PlanStart" end="PlanEnd" progress="Percent"/>
          <cube:View name="卡片" type="card"  title="OrderNo" fields="Amount,Status"/>
          <cube:View name="日历" type="calendar" dateField="CreateTime"/>
        </cube:Views>

        <cube:Queries>                         <!-- 自定义查询（保存的筛选方案） -->
          <cube:Query name="本月未付款" shared="true" sort="-CreateTime"
                      filter="CreateTime>=@monthStart and Status==0"/>
        </cube:Queries>

        <cube:Insights>                        <!-- 页面洞察面板 -->
          <cube:Widget kind="metric" title="本月订单数" agg="count" filter="CreateTime>=@monthStart"/>
          <cube:Widget kind="chart" chart="line" title="近30天金额" x="CreateTime:day" y="sum(Amount)"/>
        </cube:Insights>

        <cube:Automations>                     <!-- 自动化 -->
          <cube:Automation name="大额订单提醒" trigger="onCreate" when="Amount>=10000"
                           actions="notify(role=manager,tpl=BigOrder)"/>
        </cube:Automations>
      </cube:Presentation>
    </Table>
  </Tables>

  <cube:Workbench>                             <!-- 首页工作台 / 看板 -->
    <cube:Board name="运营首页" scope="shared" roles="admin,manager">
      <cube:Layout cols="12">
        <cube:Item kind="metric" span="3" title="今日订单" source="Order" agg="count" filter="CreateTime>=@today"/>
        <cube:Item kind="chart"  span="6" chart="bar" source="Order" x="Status" y="count" title="订单状态分布"/>
        <cube:Item kind="list"   span="3" source="Order" filter="Status==0" fields="OrderNo,Amount" limit="5"/>
      </cube:Layout>
    </cube:Board>
  </cube:Workbench>
</EntityModel>
```

#### DSL 规则

| # | 规则 | 说明 |
|---|---|---|
| D1 | **单一入口** | 业务方只写 Model.xml；`cube:Presentation` / `cube:Workbench` 全部可选（不写则用系统默认） |
| D2 | 命名空间隔离 | 展现配置位于 `cube:` 命名空间；解析器**宽容模式**忽略未知命名空间节点 |
| D3 | 严格校验 | `cube:lint --strict` 用 XCode XSD 只校验物理部分；`cube:lint` 额外校验 DSL 语法与字段白名单 |
| D4 | 回迁兼容 | `cube:migrate-strip` 剥离 `cube:*` 节点，产出纯 XCode `Model.xml`（保留双向迁移能力） |
| D5 | **三层覆盖** | 系统默认（Model.xml）< 管理员模板（`shared=true` 落库）< 个人偏好（Profile） |
| D6 | 生成物 | ①`META-INF/cube/model/*.json`（含 views/insights/automations）②`shared` 配置的**种子数据 SQL**（首次安装写入）③后台可视化编辑器可直接改库（改库不改文件，文件为初始值） |
| D7 | 前端零改动 | 全部经 `/meta`（扩展键）+ Profile 下发；不新增前端必需端点 |
| D8 | 安全 | 字段白名单、函数白名单、聚合白名单、颜色 token 白名单（禁任意 CSS/脚本） |

> **与现状的关系（v4.3.1 必读）**：现状的权威源是**库**——视图三层为「全局模板（`ViewProfile.UserId=0`）< 个人（`UserId=me`）」，工作台为「用户 > 主角色 > 系统」，均由前端可视化编辑器维护。若启用本 DSL，它只承担 `shared` 模板的**初始种子**（D6），**运行期一律以库为准**；禁止出现"文件改了但库没改 / 库改了文件覆盖"的双源漂移。

#### 关键取舍：为什么不做"每种视图一个后端端点"

视图配置是**纯声明**，与 CRUD 数据同源：`GET /api/{type}` 加上查询参数即可满足全部视图的数据需求（差异只在"取多少列/怎么聚合/怎么排序"）。因此：
- **数据面**：始终复用通用 CRUD 端点（零新增）
- **配置面**：全部走 `/meta` 的扩展键 + Profile
- **渲染面**：前端已有 `grid/tree/card/kanban/gantt/calendar` 渲染器，Java 只需产出配置

> 这使 7 项能力**不引入任何新端点**，最大程度保住"前端零改动"。

## 5. 通用 CRUD 引擎（K4）

### 5.1 路由与分派（可随插件域增删）

```java
// 单一 HandlerMapping 服务全部实体；路由表由插件域注册/注销
// /api/{area}/{controller}[/{id}][/{action}]
public class EntityHandlerMapping implements HandlerMapping {
    public HandlerExecutionChain getHandler(HttpServletRequest req) {
        RouteDefinition r = routes.lookup(req);   // 前缀树 + 域标记
        return r == null ? null : new HandlerExecutionChain(r.handler());
    }
}
```

**为什么不用组件扫描的 `@RestController`**：Controller 在启动期固定，插件卸载时无法移除映射。改为"内核持有一个 HandlerMapping + 可增删的 RouteRegistry（按 pluginId 分组）" —— 热插拔的基石。

### 5.2 查询表达式（`WhereExpression` 的 Java 等价）

XCode 支持：`== != > < >= <=`、`Equal/NotEqual`、`StartsWith/EndsWith/Contains/NotContains`、`In/NotIn`（含子查询）、`IsNull/NotIsNull`、`IsNullOrEmpty/NotIsNullOrEmpty`、`IsTrue/IsFalse`、`Between`、`&`(AND)/`|`(OR，自动括号)、空表达式动态累积。

```java
public interface Filters {
    static Filters of(EntityKey key);
    Filters eq(String f, Object v);   Filters ne(String f, Object v);
    Filters gt/ge/lt/le(String f, Object v);
    Filters like/contains/startsWith/endsWith(String f, String v);
    Filters in(String f, Collection<?> vs);
    Filters inSubQuery(String f, SubQuery q);
    Filters isNull(String f);         Filters isNotNull(String f);
    Filters isEmpty(String f);        Filters notEmpty(String f);   // 仅 String
    Filters isTrue(String f, boolean expect);                       // 含 NULL 语义
    Filters between(String f, Object lo, Object hi);
    Filters and(Filters other);       Filters or(Filters other);
    Filters containsIf(String f, String v);                         // 值空则跳过
    PageResult<Order> page(Pager p);
}
```

- 树结构 + 参数化绑定（`PreparedStatement`），**禁止字符串拼接**
- `Expression("...")` 等价物保留但标注 `@TrustedSql`（仅可信静态片段）

#### 5.2.1 操作符 `== != > < >= <=` 的三种等价形态

Java **没有运算符重载**，因此"`==`/`!=` 重载"要在**三处**分别落实，语义必须逐字对齐（任一处放宽都会造成前后端行为不一致）：

| XCode 写法 | Java 类型安全写法（推荐） | 线缆 JSON（**前端权威**，ArcoVue `ViewFilterOp`） | SQL 片段 |
|---|---|---|---|
| `_.OrderNo == "A"` | `Order.F.orderNo.eq("A")` | `{"field":"OrderNo","op":"eq","value":"A"}` | `OrderNo = ?` |
| `_.OrderNo != "A"` | `Order.F.orderNo.ne("A")` | `op:"neq"` | `OrderNo <> ?` |
| `_.Amount > 10` | `Order.F.amount.gt(10)` | `op:"gt"` | `Amount > ?` |
| `_.Amount >= 10` | `Order.F.amount.ge(10)` | `op:"gte"` | `Amount >= ?` |
| `_.Amount < 10` | `Order.F.amount.lt(10)` | `op:"lt"` | `Amount < ?` |
| `_.Amount <= 10` | `Order.F.amount.le(10)` | `op:"lte"` | `Amount <= ?` |
| `_.CreateTime > dt` | `Order.F.createTime.after(dt)` | `op:"after"` | `CreateTime > ?` |
| `_.CreateTime < dt` | `Order.F.createTime.before(dt)` | `op:"before"` | `CreateTime < ?` |

```java
// ① 生成的字段句柄：编译期校验字段名（拼错即编译失败），运行期无反射
var f = Order.F;                                  // 生成物，随 Order.java 一起覆盖
exp &= f.orderNo.eq("A") & f.amount.gt(10);       // & == AND，| == OR（自动加括号）

// ② 动态字段（字段名来自请求）：走白名单 + 归一化，不允许拼 SQL
exp &= Filters.on(Order.KEY, req.field()).eq(req.value());
```

- **符号别名归一**：DSL/JSON 层同时接受 `== != > >= < <=` 与 `eq/neq/gt/gte/lt/lte`，解析器只做**别名归一**（`==`→`eq`、`!=`→`neq`、`>=`→`gte`、`<=`→`lte`），不引入第二套语义；`after/before` 是前端日期类的专用 op，落到 SQL 仍为 `>`/`<`。
- **前端已实现的 14 个 op 是唯一权威集合**（`eq/neq/contains/notContains/startsWith/endsWith/isNull/notNull/gt/gte/lt/lte/after/before`，见 `web/src/core/utils/viewProfile.ts` 的 `FILTER_OPS`）；Java 侧**不得新增前端不认识的 op**，否则保存的查询会在某些端上渲染为空。
- 空值语义仍按 XCode：`IsNull`/`NotIsNull`、`IsTrue(expected)` 含 NULL 分支；`==` 与 `eq` 对 `null` 的处理**一律走显式 `isNull()`**，禁止隐式转换（隐式转换是"查询条件悄悄变化"的常见来源）。

### 5.3 分页方言（非 SaaS 场景为硬需求）

| 数据库 | 策略 | 备注 |
|---|---|---|
| SQLite / MySQL / PostgreSQL | `LIMIT ? OFFSET ?` | 基线实现，P2 内必须实测 |
| 金仓 KingBase / 海量 VastBase | `LIMIT ? OFFSET ?` | PG 系语法；驱动与方言差异由厂商确认后微调 |
| 达梦 DM | `LIMIT ? OFFSET ?`，兜底 `ROWNUM` 子查询 | **必须实测**（不同 DM 版本 `LIMIT` 支持不一致） |

> **数据库范围已收敛（D-33）**：只实现上述 6 种。SQL Server / Oracle / DB2 / 瀚高**不实现、不验收**；`PageDialect` SPI 保留扩展位，未来接入只需新增一个实现。

实现：`PageDialect` SPI（每库一个）+ MyBatis-Plus `PaginationInnerInterceptor` 承载通用路径；**自持方言 SPI** 避免被框架绑死。

### 5.4 拦截器链（`IEntityInterceptor` 等价）

| 阶段 | 钩子 | 内置实现 |
|---|---|---|
| 查询前 | `beforeQuery(Filters, ctx)` | `DataScopeInterceptor`、`TenantQueryInterceptor` |
| 查询后 | `afterQuery(rows, ctx)` | `SensitiveFieldMasker`、`EnumLocalizer` |
| 加载 | `afterLoad(entity)` | 关联填充、字典翻译 |
| 保存前 | `beforeSave(entity, op)` | `TimeInterceptor`、`UserInterceptor`、`IPInterceptor`、`TraceInterceptor`、`TenantWriteInterceptor` |
| 保存后 | `afterSave(entity, op)` | 审计日志、缓存失效、`EntityQueue`（异步批写） |
| 校验 | `validate(entity)` → `false` 短路 | 业务 `XxxBiz` |

执行顺序：**实体级 → 全局级**（与 XCode 一致）。
注册：拦截器归属插件域，随域加载/卸载；内核可全局注册（如 DataScope）。

### 5.5 缓存（L1 本地 + L2 Redis，对齐 `ICacheProvider`）

**语义基准来自 NewLife.Core**（`NewLife.Core/Caching/ICacheProvider.cs` + `Doc/缓存系统ICache.md`）：该接口把缓存分成两级，并顺带提供队列与分布式锁——这正是 Cube 现状的用法，Java 侧必须保持同样分层，不能压成一层：

| 层 | NewLife.Core 现状 | Java 落点 | 使用约束 |
|---|---|---|---|
| **L1 进程内** | `ICacheProvider.InnerCache`（默认 `MemoryCache`，无序列化成本） | Caffeine（Apache-2.0），每插件一个实例（由 `DisposableRegistry` 管理） | 可缓存实体对象；**不得**承载跨节点必须一致的状态 |
| **L2 跨进程** | `ICacheProvider.Cache`（分布式部署配 Redis，需序列化） | **Redis**（唯一分布式实现；Spring Data Redis + Lettuce） | 只放可序列化值；键必须带 `cube:` 前缀与插件域 |
| 队列 | `GetQueue<T>(topic, group)` / `GetInnerQueue<T>` | L2：Redis Stream（有消费组）/ Redis List（无消费组）；L1：`BlockingQueue` | 事件/自动化默认走 DB 表，Redis 队列为可选提速 |
| 分布式锁 | `AcquireLock(key, msTimeout)` | Redis `SET NX PX` + 续期；单机退化为进程内锁 | 作业抢占、插件升级、元数据广播互斥统一用它 |

**三件套等价（语义不变，只是 L1/L2 分工）**

| XCode / Cube | Java 实现 | 语义 |
|---|---|---|
| `EntityCache`（整表） | L1 Caffeine（`expireAfterWrite` + `refreshAfterWrite`：过期先返旧值再异步刷新）+ 事务提交后失效 | 单表容量上限保护；跨节点靠 L2 失效广播 |
| `SingleCache` | L1 `Cache<Key, Entity>` + 未命中回源 + 删除即移除 + LRU | 按主键 |
| `FieldCache` | L1 + 可选落库（冷启动可恢复） | 元数据版本号参与键 |
| 跨节点失效 | `KernelBus` → DB 事件表（默认）/ Nacos / MQ；Redis pub/sub 作为快速通道（可选） | 至少一次 + 版本号幂等（旧失效消息不得覆盖新版本） |

**配置与降级（非 SaaS 场景硬要求）**

```yaml
cube:
  cache:
    inner: { enabled: true, max-size: 10000, expire: 300s }     # L1
    shared:
      provider: redis            # redis | none（none = 仅 L1，仅允许单机）
      url: redis://10.0.0.6:6379/0
      key-prefix: cube
      default-ttl: 600s
    fallback: degrade            # degrade（降级告警）| fail-fast
```

| 场景 | 行为 |
|---|---|
| S 单机 | `shared.provider=none`，只开 L1，**无 Redis 依赖**（"一个 jar + 一个 DB"） |
| M/L 集群 | `shared.provider=redis`；启动自检 `PING` 失败即按 `fallback` 处理 |
| Redis 不可用 | `degrade`：L1 短 TTL（≤30s）+ 关广播 + 告警 + `/Cube/Site` 标记 `cacheDegraded=true`；**禁止带着长 TTL 的令牌/权限状态静默继续跑** |
| 4C8G 客户机 | `inner.max-size` 可下调，`enabled=false` 可全关（功能退化但不报错） |
| Redis 版本 | 平台只依赖 **RESP 协议**（客户端 Lettuce，Apache-2.0）；服务端可为 Redis 8.x（RSALv2/SSPLv1/AGPLv3 三选一）、Redis ≤7.2（BSD-3）或 Valkey（BSD-3）——见 §10.5 |

> **为什么必须保留两级**：实体缓存走 L1 是"性能 + 对象语义"问题（XCode 返回实体对象引用），分布式状态走 L2 是"多副本一致性"问题。压成一层要么牺牲性能，要么改变业务语义。

### 5.6 事务

- 边界：`KernelTx`（包装 `TransactionTemplate`），插件不得自行开连接
- 最外层提交/回滚后统一触发 `DataChange` 事件（对齐 XCode `EntitySession` 事务联动）
- 批量：按 `BatchSize`（默认 5000）分片
- 跨库：`ConnName` 多数据源；跨库事务**不支持**（与现状一致，明确声明）

### 5.7 分库分表、雪花 ID 与读写分离（K4 核心子能力，D-35）

> **语义基准（必须逐条对齐）**：`NewLife.XCode/XCode/Shards/{ShardModel,IShardPolicy,TimeShardPolicy}.cs` 与 `Doc/{分片路由模型,Shards分配策略与路由,Shards跨分片查询与AutoShard,时间分片策略与范围裁剪,分库分表临时切换,读写分离策略}.md`。
> 这不是"加分项"：Cube 的**日志表**、**物联网监测表**以及**跨库业务实体**直接依赖这三件事。

#### 5.7.1 三类要求对应三套机制

| 要求 | 机制 | 对齐要点 |
|---|---|---|
| **业务实体跨库** | 每实体绑定 `ConnName`（`Model.xml` 的 `Table/@ConnName`） | 多数据源按 ConnName 路由；**不做跨库事务 / 跨库 JOIN** |
| **大表分库分表** | `DataScale="timeShard:{fmt}"` + `TimeShardPolicy(ConnPolicy/TablePolicy/Step/Level)` | 表名/连接名模板**必须沿用现有命名**，否则查不到历史分片 |
| **日志/监测表雪花 ID** | `Int64` 主键 + `Identity=false` → 自动 `DataScale="time"`，插入自动填充 | **41/10/12 位 + epoch 1970**，与 .NET 生成值完全兼容；大表**禁用实体缓存** |

#### 5.7.2 连接名与多库（业务实体跨库）

| 项 | 实现 |
|---|---|
| 绑定 | `Model.xml` 的 `Table/@ConnName` → 元数据 `EntityMeta.connName` |
| 路由 | `DataSourceRegistry`（ConnName → `DataSource`）；仓储取 `connName` 再取连接；**同一进程可同时访问多个库（甚至不同库种）**，互不影响 |
| 事务 | **仅单库本地事务**；跨 ConnName 写走"事件 + 补偿"（S8），**禁止** XA / Seata |
| 配置 | 连接串来自 `spring.datasource`/`cube.datasource.*` 或客户配置中心；新增数据源**重启生效**（不做在线热加连接池） |
| 只读 | 每个 ConnName 可选 `{name}Readonly` 从库（见 5.7.9） |
| 校验 | 启动打印「数据源清单 + 方言 + 服务端版本」；缺失 ConnName → **延迟失败**（仅该实体报错，§5.11.3） |

#### 5.7.3 分片模型（等价 `ShardModel` + `IShardPolicy`）

```java
record ShardModel(String connName, String tableName) {}

interface ShardPolicy {
    ShardModel shard(Object value);                          // IModel / LocalDateTime / Long(雪花)
    List<ShardModel> shards(LocalDateTime start, LocalDateTime end);
    List<ShardModel> shards(Filters conditions);             // 条件不足 → 抛错（禁止盲扫）
}

class TimeShardPolicy implements ShardPolicy {
    String field;                  // DateTime 或 Int64(雪花)
    String connPolicy;             // "{0}_{1:yyyy}"
    String tablePolicy;            // "{0}_{1:yyyyMMdd}" / "{0}_{1:yyyyMM}"
    Duration step = Duration.ofDays(1);
    Level level;                   // YEAR/MONTH/DAY/HOUR，未显式设置时由 step 推断
}
```

| 规则 | 说明（逐条对齐 XCode） |
|---|---|
| 分片键类型 | **只支持 `DateTime` 与 `Int64`（雪花）**，其它类型直接报错 |
| 无效时间 | `year <= 1970` 或雪花解析失败 → **抛错**（不静默落到某分片） |
| 区间推导 | step → level；`start` 对齐到粒度边界；逐级 `next()`；`conn#table` 去重；倒序区间反转 |
| 条件分片 | 从 `Filters` 提取 `= / >= / > / <= / <` 的时间或雪花范围；**提取不到 → 抛错** |
| 条件裁剪 | 命中**单分片且完整覆盖**时，移除冗余时间条件（SQL 更短、索引可用） |
| 批量写入 | 有 `ShardPolicy` 时**先按分片分组再批量插入**（保留批量能力） |
| 代码生成 | `DataScale="timeShard:yyMMdd"` → 生成策略与 `Step`（时/天/月/年）；**手写策略不得与生成器漂移** |

#### 5.7.4 `DataScale` 的两种语义（不要混用）

| 值 | 语义 | 生成行为 | 运行行为 |
|---|---|---|---|
| `time` | **大表单表**标记（雪花 ID / 时间列） | `Int64` 主键且非自增 → 自动置 `time`；`InsertOnly` 日志表 → 首个时间索引列自动置 `time` | **不启用实体缓存**（等价 `MaxCacheCount=0`）；雪花 ID 插入自动填充 |
| `timeShard:{fmt}` | **按时间分表**（可只分表，也可库表同分） | 生成 `TimeShardPolicy`（Field/ConnPolicy/TablePolicy/Step） | 所有读写经策略路由；跨分片查询走 AutoShard |

#### 5.7.5 跨分片查询（等价 `AutoShard`）

| 项 | 设计（与现状一致） |
|---|---|
| 触发 | ①显式 `ShardService.autoShard(start, end, callback)`；②常规查询在**未处于分片上下文**、策略存在、且条件可提取范围时**自动分片** |
| 执行 | 顺序遍历分片 → 跳过不存在的表 → 切换上下文执行 → **调用方聚合** |
| 分页语义 | **保持现状：各分片各自分页，不做全局重排**（`PageParameter` 原样传下去）；需要全局 Top-N 的报表走 `Widget/Query` 或显式归并端点，**不得偷偷改变通用 CRUD 的分页语义** |
| 缺范围 | 策略抛错（"分表策略因条件不足无法执行分表查询"），**不允许盲扫全部历史分片** |
| 前端 | 分片实体的列表查询**必须带时间范围**（否则策略抛错）——这是现状约束，不是本次新增限制 |

#### 5.7.6 分片 DDL 与历史分片（最易出事故）

| 项 | 规则 |
|---|---|
| 命名 | **沿用现有模板**（如 `Log_202603`、`Db_2026.Log_202603`）；迁移后**不得改模板**，否则历史数据"消失" |
| 建表 | 新分片**懒创建**（首次写入前按 6 库方言建表）+ 支持运维预建 |
| 迁移 | `cube:ddl-diff` / Liquibase 只作用于**当前分片**；批量变更历史分片需显式脚本且可回滚（先加列） |
| 清理 | 按 `retention` 整片删除（先归档再 DROP/TRUNCATE），全程审计 |
| 存量 | 迁移前必须盘点**分片集合基线**（连接名 + 表名 + 行数 + 时间范围），作为验收比对 |

#### 5.7.7 并发安全（`EntitySplit` 的教训）

| 现状 | Java 方案 |
|---|---|
| `EntitySplit` 临时改工厂上的 `ConnName/TableName`，**并发会串库串表**（XCode 文档明确不建议用于 Web 主链路） | **禁止**改共享元数据。只允许：①`ShardPolicy` 自动路由 ②显式 `ShardScope`（ThreadLocal 或参数）③按目标库表创建独立 `EntitySession`（回调式） |
| 批量方法可传 session | `repository.batch(session, ...)`；禁止依赖隐式全局切换 |

#### 5.7.8 雪花 ID（与 .NET 生成值兼容）

| 项 | 必须对齐 |
|---|---|
| 布局 | **41 位时间戳（ms，epoch 1970-01-01 UTC）+ 10 位 workerId + 12 位序列**；位宽与 epoch **不得改动**（否则与存量 ID、分片解析不兼容） |
| workerId | 0~1023；优先级：显式配置 > **Redis 自增**（L2 可用时）> DB 序列 > IP+进程派生（**仅 dev**）；启动校验唯一，冲突**拒绝启动** |
| 时钟回拨 | .NET 在 `1h+10s` 内使用上次逻辑时间戳，超过阈值抛错；序列耗尽时推进逻辑毫秒。Java 若默认立即失败是有意的行为变化，须通过差分测试并确认，不得称完全等价（§16.5） |
| 并发 | 单例 + 序列原子递增；同一 workerId 只允许一个进程持有 |
| 使用 | `Int64` 主键 + `Identity=false` 的实体，`insert` 前自动填充（等价 `IEntityOperate.Snow`）；DDL **不生成自增** |
| 观测 | 启动打印 `workerId` 与来源；`GET /api/Cube/Diag/Id` 查看当前值与序列水位 |

#### 5.7.9 读写分离（等价 `ReadWriteStrategy`）

| 项 | 设计 |
|---|---|
| 连接 | 主名 + `{主名}Readonly` **自动关联**（沿用现状命名） |
| 走从库条件 | **SELECT + 无事务 + 不在忽略时段 + 不在忽略表**（逐条对齐 `ReadWriteStrategy.Validate`） |
| 配置 | `cube.datasource.{name}.readonly-url`、`ignore-times: "00:30-00:50"`、`ignore-tables: [...]` |
| 组合 | 分片 + 读写分离：先算 `ShardModel.connName`，再套 Readonly；强一致读显式读主 |

#### 5.7.10 验收

| # | 用例 | 判定 |
|---|---|---|
| SHARD-1 | 单库按天分表：3 天数据落 3 张表；`shard(model)` 与 `shards(start,end)` 逐分片与 .NET 一致 | 通过 |
| SHARD-2 | 库表同分（`{0}_{1:yyyy}` / `{0}_{1:yyyyMM}`）：跨库跨表路由正确，**无跨库事务** | 通过 |
| SHARD-3 | 条件分片：缺时间范围 → 抛错（不盲扫）；单分片完整覆盖 → 时间条件被裁剪（SQL 比对） | 通过 |
| SHARD-4 | AutoShard 跨分片统计 = 逐表求和；分页为"每分片分页"（显式断言，不静默合并） | 通过 |
| SHARD-5 | 批量插入跨 2 个分片：自动分组，两组均成功 | 通过 |
| SHARD-6 | 历史分片：按**原命名模板**可直接查询既有表，基线行数一致 | 通过 |
| SHARD-7 | 新分片懒建表：6 库方言均创建成功 | 通过 |
| **ID-1** | 连发 100 万次 ID 无重复、单调递增；解析出的时间戳与 .NET 一致 | 通过 |
| **ID-2** | 两节点经 Redis 分配 workerId 不冲突；手动制造冲突 → 启动失败并提示 | 通过 |
| **ID-3** | 时钟回拨 ±10 分钟：`fail/wait` 行为正确，不产生重复 ID | 通过 |
| **ID-4** | `DataScale=time` 大表**不启用实体缓存**，插入自动填充 ID | 通过 |

### 5.8 多副本阻塞点（15 项，必须外置）

| # | 进程内状态 | Java 方案 |
|---|---|---|
| 1 | 实体全表缓存 | L1 Caffeine + L2 域级失效广播（Redis/DB 事件表） |
| 2 | 单对象缓存 | 同上 |
| 3 | 查询缓存 | 同上（或关闭） |
| 4 | 扩展属性缓存 | 同上 |
| 5 | 字典/枚举静态缓存 | 元数据版本 + 广播 |
| 6 | `IMemoryCache` | 显式 Caffeine + 失效策略 |
| 7 | `PageMeta`/字段元数据 | Registry + `MetaVersion` + 域级广播 |
| 8 | `ModuleManager.Modules` | 插件清单存 DB，节点按清单加载 |
| 9 | Application Parts | 不适用（动态 RouteRegistry） |
| 10 | Razor 视图 | 不适用（SPA） |
| 11 | `TenantContext` | `ThreadLocal` + `TransmittableThreadLocal` |
| 12 | refresh-token 黑名单 | **Redis**（L2，TTL 对齐）；单机无 Redis 时落 DB 表 |
| 13 | 登录/验证码/Challenge | 同上（一次性 + TTL 300s） |
| 14 | Cookie/Session | 无状态 JWT + 共享密钥环 |
| 15 | 预热缓存 | 启动预热 + 版本校验 |

---

### 5.9 展现层契约与配置（K9 / G5）

> **v4.3.1（D-34）**：本节只负责**配置容器 + 筛选下推 + Widget 聚合**。填色与表格分组是**前端能力**（规则存 `ViewsJson`、前端求值），后端不建引擎；七视图渲染同理。目标是"复刻现有契约"，不是"补齐后端"。

#### 5.9.1 共享筛选 schema（一处定义，四处复用：列表筛选 / 保存查询 / 自动化条件 / Widget 过滤）

列表筛选、保存查询、自动化条件、Widget 过滤**共用同一个筛选表达式语言**，避免多套实现漂移：

```
condition := orExpr
orExpr    := andExpr ( 'or' andExpr )*
andExpr   := unary ( 'and' unary )*
unary     := ['not'] primary
primary   := '(' condition ')'
           | field op value
           | func '(' args ')'
op        := == != > >= < <= like in isnull notnull between
value     := 常量 | @参数名 | 函数结果
func      := today() now() monthStart() monthEnd() currentUser() currentTenant()
             daysAgo(n) hoursAgo(n) lower(x) upper(x) len(x)
```

**双向编译**：

| 目标 | 用途 |
|---|---|
| → `Filters`（SQL，参数化） | 保存查询、自动化数据取数、Widget 过滤、列表筛选下推 |
| → `Predicate<Row>`（内存） | 自动化条件的离线判定、自动化/查询的测试断言（**填色与表格分组不在此列**：由前端求值，见 D-34） |

**安全约束**：无脚本引擎、无方法调用、无任意函数；函数与操作符均为白名单表；字段必须属于当前实体域。**下推语义分两种（与 .NET 对齐，不得擅自收紧）**：①列表筛选——白名单内尽力下推，任一条件不可翻译则**整段放弃下推**（前端 `matchesViewFilter` 兜底，不报 500）；②Widget 聚合——不可翻译直接 **400**，禁止"取回前端再算"的假聚合；排序 `sorts` ≤3 列、字段白名单、非法 **400**。

#### 5.9.2 七项能力的实现归属（复刻清单）

| 能力 | 引擎 | 配置存储 | 覆盖层级 | 关键实现点 |
|---|---|---|---|---|
| 多维视图 | `ViewConfigStore` | **库**（`ViewProfile`，现状） | 全局模板 < 个人 | 只做配置存取与版本；七视图渲染在前端（table/tree/card/kanban/calendar/gantt/map） |
| 自定义查询 | `QueryStore` + `Filters` | 库（`ViewProfile.QueriesJson`） | 个人优先 | **已交付**（OSC-0015 条件构建器 + OSC-260830a1b2 v2 预定义查询）：查询簇为唯一入口；筛选经 `page.State` 下推；字段白名单 |
| **条件填色** | **无后端引擎**（D-34） | 库（`ViewsJson.colors`） | — | **前端求值**（≤50 条单条件，单元格/行侧边/整行/整列）；后端只做 JSON 透传 |
| **多级分组** | **无后端引擎**（D-34） | 库（`ViewsJson`） | — | **前端组头行**（≤3 级、可折叠）；后端只保证筛选/排序正确下推 |
| 页面洞察面板 | `WidgetQueryService` | 库（`ViewProfile.DashboardJson`） | 实体级：个人 > 模板 | `POST /Cube/Widget/Query`：count/sum/avg/min/max/**group** + 数据权限 + 租户 Where + 时间分桶；不可翻译 → 400 |
| 首页 / 命名工作台 | `WorkbenchStore` | 库（`UserProfile.HomeJson` + `Parameter`） | 用户 > 主角色 > 系统 | 命名工作台发布时 upsert 槽 + 菜单（`Sort` 顶置）；**不做租户层** |
| 自动化 | `AutomationEngine`（§5.10） | 库（`EntityAutomation.GraphJson`） | — | 见下节 |

> **现状差距（v4.3.1 更正）**：**没有差距**。原"填色/分组需后端补齐"的判断基于 2026-08 之前的状态，已被 OSC-26081903c0（条件填色，规则存 `ViewsJson`、前端求值）、OSC-0015 + OSC-26092694a1（多级分组/甘特分组，前端组头行）、OSC-260830a1b2（筛选服务端化）覆盖。Java 侧的工作是**复刻契约**，不是新建引擎。
> **唯一需要后端计算的展现能力是 Widget 聚合**（`count/sum/avg/min/max/group`），且 .NET 已有实现（`WidgetController.Query`），照抄语义即可。

#### 5.9.3 覆盖解析顺序（**与现状一致，禁止改语义**）

```
effective(view)      = 个人（ViewProfile, UserId=me）整份覆盖 全局模板（UserId=0）; 都无 → 前端默认
effective(workbench) = 用户 UserProfile.HomeJson > 主角色 Parameter(Workbench.Role) > 系统种子
```

- **整份采用，不做逐字段深合并**（现状语义；深合并会改变前端行为，属于破坏性变更）
- 工作台"附加角色"（`RoleIds`）**不参与、不合并**
- 个人层 `baseVersion` 与下发 `configVersion` 属**可选增强**（现状没有，前端不依赖）

#### 5.9.4 `/meta` 扩展键（**默认不做**）

> **v4.3.1**：前端**不从 `/meta` 读** views/queries/insights/automations——这些一律走 `/Cube/ViewProfile`、`/Cube/UserProfile`、`/Cube/Workbench`、`/Cube/Automation`、`/Cube/Widget/*`。因此**不新增 `/meta` 扩展键**（避免发明前端不消费的契约面）。下面的形态仅作"若将来要做单请求下发"的设计参考，不进入实现范围：

```json
{
  "entity": {...}, "setting": {...}, "list": [...], "form": [...], "search": [...],
  "views":     [ {"name":"默认表格","type":"grid","columns":[...],"colors":[...],"groups":[...]} ],
  "queries":   [ {"name":"本月未付款","shared":true,"filter":"..."} ],
  "insights":  [ {"kind":"metric","title":"本月订单数","dataset":{...}} ],
  "automations":[ {"name":"大额订单提醒","trigger":"onCreate","when":"...","actions":[...]} ],
  "configVersion": "3f2a…"
}
```
> 现有 `/meta` 形状**保持不变**（这是硬契约）；本节内容为**未启用**的可选方案。

#### 5.9.5 `ViewProfile` 实体与 JSON 子契约（v4.3.4 逐字段复核）

> 依据：`NewLife.Cube/Entity/视图配置.cs`（34 个文件的实体层之一，`ConnName=Cube`）+ `NewLife.Cube.ArcoVue/web/src/core/utils/viewProfile.ts`（1296 行，前端权威 schema）+ `stores/viewProfile.ts`。**结论：实体与 JSON 结构都必须 1:1 复刻**，任何"顺手简化"都会让前端已保存的配置失效。

**表结构（6 库通用，`DbType=None` 走方言映射）**

| 字段 | 类型 | 说明 | Java 落点 |
|---|---|---|---|
| `Id` | Int32 PK 自增 | 编号 | `Long`/`Integer` 自增 |
| `UserId` | Int32 | 用户；**0 = 共享模板** | 同 |
| `TypePath` | String(200) | 实体路径，如 `Admin/User` | 同（**唯一索引 `IU_ViewProfile_UserId_TypePath`**） |
| `View` | String(50) | `table`/`tree`/`card`/`gantt` | 同 |
| `ColumnsJson` | text | 列布局（与活跃命名视图同步） | `TEXT`/`LONGTEXT`/`CLOB` |
| `ViewsJson` | text | **命名视图集合**（含填色/分组/筛选/洞察/样式） | 同 |
| `ActiveViewId` | String(50) | 当前激活命名视图 | 同 |
| `ActiveQueryId` | String(50) | 当前预定义查询（服务端持久化，跨设备恢复） | 同 |
| `GanttJson` / `CardJson` | text | 甘特/卡片映射 | 同 |
| `FiltersJson` | text | 筛选记忆 | 同 |
| `QueriesJson` | text | **预定义查询集合** | 同 |
| `PageSize` | Int32 | 每页条数（0 = 未配置） | 同 |
| `FormJson` | text | add/edit/detail 的表单布局 | 同 |
| `DashboardJson` | text | 页面仪表盘（**实体级，不跟命名视图走**） | 同 |
| `Version` | Int32 | 配置契约版本 | 同 |
| 审计 8 项 + `Remark` | — | `CreateUserId/CreateTime/CreateIP/UpdateUserId/UpdateTime/UpdateIP` 等 | 由拦截器自动填充 |

**JSON 子契约（必须逐键兼容）**

| JSON | 顶层结构 | 关键约束（来自前端 `normalize*` 的实际行为） |
|---|---|---|
| `ColumnsJson` | `ColumnPref[]`：`{key, visible, width?, frozen?: 'left'\|'right'\|false, title?}` | `title` 空则回落元数据 `displayName` |
| `ViewsJson` | `NamedView[]`：`{id, name, view, columns, sort?, sorts?, chrome?, mapping?, insight?, filter?, group?, format?, _raw?}` | **`_raw` 必须保留未知顶层属性**（round-trip 不丢后续 OSC 新增字段）——Jackson 侧用 `@JsonAnySetter/@JsonAnyGetter`，禁 `FAIL_ON_UNKNOWN_PROPERTIES` |
| `sort` / `sorts` | `{field, desc}` / 数组 | `sorts` **≤3 列**；有值时 `sort` 恒等于 `sorts[0]` |
| `chrome` | `ViewChrome`：`bgPreset/bgColor/bgOpacity/bgBlur/widthMode/heightMode/showFilter/showGroup/showSort/showSearch/showColor/showShare/allowAdd/addButtonText/customButton/showPager/expandRow` | `allowViewDetail`/`allowDelete` 已 `@deprecated`（改由菜单/角色权限控制），但**仍要归一化保留**、运行时忽略 |
| `filter` | `ViewFilter`：`{logic:'all'\|'any', conditions:[{field, op, value?, value2?}]}` | `op` ∈ **14 个**（§5.2.1）；`value2` 为历史 between 残留，保留但不使用 |
| `group` | `string[]` | **≤3 级**，纯前端组头行 |
| `format` | `ViewFormatRule[]`：`{id, apply:'cell'\|'side'\|'row'\|'column', color:'#RRGGBB', field, op, value?, bold?}` | **≤50 条**；`color` 必须 `^#[0-9A-Fa-f]{6}$`；空/缺省 = 无填色 |
| `insight` | `{showStat, showChart, chartOption?}` | `chartOption` 为 ECharts option 模板，保存前剔除 `dataset.source`/`series[].data`，**≤32KB** |
| `QueriesJson` | `{version: 2, queries: SavedQuery[]}`，`SavedQuery={id:'q_'+base36, name(≤50), q?, filter?}` | 兼容 **v1**；`name` 空或（`q` 空且条件数 0）即丢弃；`id` 重复则重生成 |
| `DashboardJson` | `{version, widgets[]}` | `version + widgets`，实体级 |
| `GanttJson` / `CardJson` | `ViewMapping`（`normalizeMapping`/`seedMapping`） | 类型专属映射，**不写进 `ViewsJson`**（历史双写会漂移） |
| `FormJson` | `{add, edit, detail}` 字段顺序/显隐/分组折叠 | 结构由前端 `viewProfile` 定义 |

**Java 侧实现纪律**

1. 存储层：`ViewProfileEntity` 原样 1:1（字段名/长度/唯一索引不改）；JSON 列用 `TEXT`，不做数据库 JSON 类型（6 库中只有 3 库好用，反而制造方言分支）。
2. 序列化：Jackson **宽容模式** + `_raw` 保留未知键；**归一化逻辑照抄前端 `normalize*`**（丢弃非法而非报错），并在服务端**再校验一次**（`field` 必须属于该实体 meta、`op` 必须在 14 个之内、`group` ≤3、`format` ≤50、`color` 正则），因为服务端是最后一道关。
3. 版本：`Version` 字段与 `QueriesJson.version`、`DashboardJson.version` 是**三套独立版本号**，不要合并。
4. 验收：用真实导出的 `ViewsJson`/`QueriesJson` 样本做 round-trip —— **`parse → 存储 → 读取 → serialize` 必须字节级稳定**（除空白），否则视为契约破坏；样本进 `cube-contract` 基线。

### 5.10 自动化引擎（K10 / G5）

| 维度 | 设计 |
|---|---|
| 触发器 | `onCreate` / `onUpdate` / `onDelete` / `fieldChange(f1,f2)` / `schedule(cron)` / `webhook` / `manual` |
| 条件 | §5.9.1 同一 DSL；支持 `@currentUser`、`@oldValue`、`@newValue` |
| 动作（内置） | `notify`（站内/邮件/短信/Webhook）、`update`、`create`、`assign`、`comment`、`http`、`ai`（走 AI 插件） |
| 动作（可插拔） | 插件通过 `ActionRegistry.register(kind, handler)` 扩展；**不提供脚本动作** |
| 执行 | 异步队列：`cube_automation_run`（DB 表）+ 抢占式消费（`FOR UPDATE SKIP LOCKED`），**不依赖内存队列或 MQ** |
| 可靠性 | 重试（指数退避，默认 3 次）+ 超时（默认 30s）+ 幂等键（`automationId+entityKey+pk+triggerHash`）+ 死信状态 |
| 隔离 | 租户维度隔离；优先级队列；单规则并发上限；节点数不限（DB 抢占天然多副本安全） |
| 可观测 | 运行历史（状态/耗时/错误）、失败率指标、死信列表；接入 §13 诊断面板 |
| 安全 | `http` 动作需域名白名单 + 凭证托管（不落明文）；动作权限按目标实体校验 |

> 与 Workflow 的边界：**自动化 = 轻量规则（无人工节点）**；**Workflow = 有人工审批节点的长流程**。两者共用 DSL 与动作注册表，但引擎独立，避免把简单场景拖进 BPMN。

### 5.11 数据库配置式切换（D-08 / K4 子能力）

**目标**：改配置 + 放驱动 jar = 换数据库，**不改一行代码**（验收项 DB-1）。

#### 5.11.1 配置形态

```yaml
cube:
  datasource:
    cube:                                   # 平台自身库。**默认 SQLite 单文件**（D-41）
      url: jdbc:sqlite:./data/cube.db       # 未配置任何 datasource 时即取此项：零安装即可跑起来
      dialect: sqlite                       # sqlite|mysql|pg|kingbase|vastbase|dm
    order:                                  # ConnName，与 Model.xml 的 ConnName 对应
      url: jdbc:dm://10.0.0.5:5236/CUBE
      dialect: dm                           # dm|kingbase|vastbase|mysql|pg|sqlite（只此 6 种）
      driver-class: dm.jdbc.driver.DmDriver
      # 驱动 jar 放在 plugins/drivers/ 或由项目 pom 引入，见 5.11.3
      pool: { max-size: 20, min-idle: 2 }
    log:                                    # 审计库可独立数据源
      url: jdbc:postgresql://...
      dialect: pg
```

- **默认即 SQLite**：新客户/新开发者 clone 后 `java -jar` 就能起（文件库落在 `./data/cube.db`），不需要先装数据库；生产按需改 `dialect + url` 即可（§5.11.5 描述切换时的自动迁移与初始化）
- `dialect` 决定分页 / DDL / 类型映射 / 自增 / 标识符引用
- 未显式配 `dialect` 时按 `url` 前缀推断，并打印推断结果（不静默）
- 支持多数据源（`ConnName` 机制等价于 XCode）

#### 5.11.2 方言能力矩阵（`DbProvider` SPI 必须覆盖）

| 库 | 分页 | 自增/序列 | 布尔 | 大文本 | 标识符 | 备注 |
|---|---|---|---|---|---|---|
| SQLite | `LIMIT ? OFFSET ?` | `AUTOINCREMENT` | `INTEGER` | `TEXT` | `""` | 单机/演示/契约测试默认 |
| MySQL | `LIMIT ? OFFSET ?` | `AUTO_INCREMENT` | `TINYINT(1)` | `LONGTEXT` | 反引号 | 驱动用 MariaDB Connector/J（LGPL-2.1） |
| PostgreSQL | `LIMIT ? OFFSET ?` | `SERIAL` / `IDENTITY` | `BOOLEAN` | `TEXT` | 双引号 | pgjdbc（BSD-2） |
| 金仓 KingBase | `LIMIT ? OFFSET ?` | `SERIAL`/`IDENTITY`（兼容模式另议） | `BOOLEAN` | `TEXT` | 双引号 | PG 系；**须用厂商驱动**，Oracle/PG 兼容模式需实测 |
| 海量 VastBase | `LIMIT ? OFFSET ?` | `SERIAL` | `BOOLEAN` | `TEXT` | 双引号 | PG 系；厂商驱动或 pgjdbc（需厂商确认） |
| 达梦 DM | `LIMIT ? OFFSET ?`，兜底 `ROWNUM` | `IDENTITY` | `BIT` | `CLOB`/`TEXT` | 双引号 | **必做实测** |

> 已移除 SQL Server / Oracle / DB2 / 瀚高（D-33）。`DbProvider` SPI 保留扩展位，但**不实现、不验收**。

每个 `DbProvider` 实现同一组接口：`pagingSql` / `ddlCreate` / `typeMap` / `identityStrategy` / `quoteIdentifier` / `batchInsert` / `upsert` / `countOptimization`。

#### 5.11.3 驱动外置加载（等价 XCode `DriverLoader`）

| 项 | 设计 |
|---|---|
| 位置 | `plugins/drivers/*.jar`（推荐）或项目 pom 依赖（由具体项目决定） |
| 加载 | 启动扫描 → 独立 `URLClassLoader`（parent = 平台类加载器）→ `DriverManager.registerDriver` |
| **不打包** | 主包**不内置**第三方驱动（许可 + 体积 + 版本由项目决定）；缺失时**延迟失败**：仅访问该数据源报错，其他数据源正常，错误信息给出"请放入 `plugins/drivers/xxx.jar`" |
| 版本自检 | 启动打印 `dialect / driver 版本 / 服务端版本`，不匹配时告警（不阻断） |
| 许可 | 达梦 / 金仓 / 海量等厂商驱动随项目商业许可交付（见 §10.6） |

#### 5.11.4 方言自检与验收

- 启动输出「方言能力报告」；`GET /api/Cube/Diag/Dialect` 可随时查看
- **验收 DB-1a（P2 必过）**：同一套 Model.xml + 业务代码，在 **SQLite / MySQL / PostgreSQL** 三库跑通 CRUD + 分页 + 导入导出
- **验收 DB-1b（交付前）**：金仓 / 海量 / 达梦 按项目实测（研发期不采购，见 R28）
- **验收 DB-2**：驱动缺失时启动成功（仅该数据源不可用），错误信息可读
- **验收 DB-3**：DDL 差异（`cube:ddl-diff`）在各库均能正确生成
- **验收 DB-4**：分页边界（total=0、最后一页、深分页）行为一致

#### 5.11.5 首次运行 / 切换数据库：自动建库、建表与初始化数据（D-41）

> 对齐 XCode 的三件事：`CreateDatabase`（建库）→ 反向工程（建表/加列，§7.8.1）→ `InitData`（播种）。目标是**部署与开发人员都不用跑 SQL 脚本**：配置里写清连接串，启动即完成。

```
启动
 ├─ 读配置（缺省 = SQLite 文件库 ./data/cube.db）
 ├─ 建库探测  DbProvider.databaseExists()  ──否──► createDatabase()（SQLite=建文件；其余=CURRENT DATABASE）
 │                                               └─ 无建库权限 → 可读错误："请先创建库 X 或授予建库权限"
 ├─ 结构同步  SchemaSync.sync(conn)  ← §7.8.1（四档 Migration；默认 On）
 ├─ 播种初始化 SeedInitializer.seed(conn)：
 │    ① 内核种子：菜单树 / 权限位 / 内置角色 / 初始管理员
 │    ② 系统参数：`Parameter` 四类默认值（系统配置 / LOV 值集 / 预定义查询 / 自定义字典，§5.16）
 │    ③ 系统插件种子（admin/perm/storage/…）
 │    ④ 业务插件种子（依赖拓扑序，插件包 `db/seed/*.sql` 或生成物 `XxxSeed.java`）
 ├─ 写 `cube_schema_history`（conn / pluginId / version / checksum / applied_at）
 └─ ready（`/health` 暴露 schema 版本与最后一次同步结果）
```

| 规则 | 说明 |
|---|---|
| **幂等** | 以 `cube_schema_history.checksum` 判定：同版本同内容不重复执行；seed 用 `MERGE/ON CONFLICT` 或"存在即跳过"双保险 |
| **顺序** | 内核种子 → 系统插件 → 业务插件（按插件依赖拓扑，与 §7.4 `migrate` 同序） |
| **失败处置** | 播种在单事务内（失败全回滚）；DDL 失败按 §7.8.1 回滚到备份点并标记插件 `migrate` 失败 |
| **空库切换** | 换到新库 = 同一流程再跑一遍（结构 + 种子），无需手工脚本 |
| **有数据的库切换** | **不自动搬数据**：必须显式声明 `cube.datasource.migrate-from=<conn>` 或走离线数据迁移；禁止"半自动建表覆盖"（会静默改结构） |
| **生产护栏** | `cube.schema.migration=readonly` → 只出 SQL 与差异报告；`cube.schema.backup-before-alter=true`（默认开）→ 改结构前先备份（SQLite 用 `VACUUM INTO`，其余走 DAL 备份或厂商工具） |
| **初始口令** | 首启生成 `admin` + **随机强口令**，日志打印一次并**强制首登改密**（杜绝出厂默认口令） |
| **可关闭** | `cube.bootstrap.seed=false`（客户已有数据/由 DBA 统一初始化时） |

**验收**

| # | 用例 | 判定 |
|---|---|---|
| INIT-1 | 空环境 `java -jar`（零配置）→ 自动生成 SQLite 文件、全部表、管理员与菜单 | 通过，且 `/health` 显示 schema 版本 |
| INIT-2 | 新库（MySQL/PG）配连接串启动 → 自动建表 + 播种；重启第二次不重复插入 | 通过（行数与 checksum 不变） |
| INIT-3 | 从 SQLite 切到 PostgreSQL（空库）→ 同一套 Model.xml 建出等价结构 | 通过；`cube:ddl-diff` 无差异 |
| INIT-4 | 播种中途失败 → 事务回滚 + 错误可读；修复后重跑成功 | 通过 |

### 5.12 消息中间件可配置（D-10 / K14 子能力）

**目标**：客户用哪种 MQ 就配哪种，未配置则零中间件依赖运行。

```yaml
cube:
  mq:
    provider: db        # db（默认）| rocketmq | kafka | rabbitmq | activemq
    topic-prefix: cube
    # provider 专属参数见下
```

| Provider | 状态 | 版本基线 | 说明 | 许可 |
|---|---|---|---|---|
| `db`（默认） | ✅ 实现 | — | 事件表 + 轮询/推送；**小项目零额外组件** | — |
| **`rabbitmq`** | ✅ **实现（主要）** | 服务端 **4.4.x** / Java client 按锁定版本 | 路由灵活、运维简单；**无全局顺序消息**（见下） | 服务端 MPL-2.0；客户端 MPL-2.0 / Apache-2.0 双许可（需按锁定版本核验 LICENSE） |
| **`rocketmq`** | ✅ **实现（主要）** | 服务端 **5.5.1** | 顺序消息、事务消息 | Apache-2.0 |
| `kafka` | ⛔ 仅留 SPI | — | 接口已定义，暂不实现 | Apache-2.0 |
| `activemq` | ⛔ 仅留 SPI | — | 接口已定义，暂不实现 | Apache-2.0 |

**双实现的关键差异与统一约束**

| 差异 | RabbitMQ | RocketMQ | 平台统一策略 |
|---|---|---|---|
| 顺序性 | 仅保证单队列内 FIFO | 队列内严格顺序 | 事件设计**不依赖全局顺序**；按 `key`（pluginId/entityKey）分区；RabbitMQ 用单队列 + 单消费者模拟 key 序 |
| 重试/死信 | DLX + TTL | 消费重试 + 死信 Topic | 统一 `RetryPolicy(max=3, backoff=exponential)` + `DeadLetterHandler` |
| 事务消息 | 无原生事务消息 | 支持 | **不使用**事务消息；用"本地事务 + 事件表（outbox）+ 幂等消费" |
| 版本 pin | 4.4.x | 5.5.1 | BOM 锁定；升级需跑 conformance 测试 |

> **不实现 Kafka/ActiveMQ 的理由**：决策 20 明确主用 RabbitMQ + RocketMQ；保留 SPI 是为了不打脸未来的客户环境，但不在本次投入。

**承载的事件**（统一 `EventEnvelope{eventId, type, key, version, payload, traceparent}`）：

| 事件 | 用途 |
|---|---|
| `MetaChanged` | 元数据版本变更 → 各节点重载 |
| `PluginDomainChanged` | 插件启停/升级 → 各节点对齐 |
| `EntityChanged` | 缓存失效 |
| `AuditEvent`（可选） | 审计异步落库（默认走本地队列，不依赖 MQ） |
| `AutomationEvent`（可选） | 自动化触发（默认走 DB 队列） |

**一致性要求**：至少一次投递 + 幂等消费（S6）+ 按 `key` 保序；重复事件必须无副作用。
**验收 MQ-1~MQ-3**：`db` 与至少一种真实 MQ 均能驱动元数据广播；断连后恢复不丢事件；重复投递不产生重复副作用。

### 5.13 作业调度内核与调度插件（K15 / D-26、D-27）

#### 5.13.1 为什么不再选外部调度组件

| 理由 | 说明 |
|---|---|
| 语义是 Cube 自己的 | 现状 = `CronJob` 实体 + `ICubeJob` + `[CronJob]` 特性 + `JobService`（`NewLife.CubeNC/Services/JobService.cs`、`Jobs/ICubeJob.cs`）。换 PowerJob/Quartz 都要"翻译语义 + 维护两套配置" |
| 存量数据要无损延续 | `CronJob` 表里有用户手工调整过的 Cron 与启用状态，不能被框架的注册流程覆盖 |
| 许可 | XXL-Job GPL-3.0 内嵌即传染；PowerJob 虽 Apache-2.0，但引入后作业模型需整体重构 |
| 部署 | 私有化现场"能少一个中间件就少一个"（P1/P3/P5） |

> 结论：调度做成**内核能力 K15**；外部调度系统只以**可选协议插件**接入。

#### 5.13.2 三层结构

| 层 | 归属 | 职责 | 可停 |
|---|---|---|---|
| **K15 内核** | `cube-kernel-job` | Cron 解析与下次触发计算、触发派发、节点抢占、错过补偿、执行历史、`CronJob` 管理端点 | ❌ |
| **内置执行器** | `cube-kernel-job` | 在平台进程内执行（单机或集群 DB 抢占），等价 `JobService` + `TimerX` | ❌ |
| **调度插件** | `job-ant` / `job-xxl` | 切片式大数据作业 / 对接外部调度系统 | ✅（停用后作业回落到内置执行器） |

#### 5.13.3 作业模型（等价现有实体，表名与字段不变）

| 现状（.NET） | Java 落点 | 说明 |
|---|---|---|
| `CronJob` 实体（`Name`/`DisplayName`/`Cron`/`Method`/`Argument`/`Data`/`Enable`/`EnableLog`/`Remark`/`LastTime`/`NextTime`） | `CronJob` 表（**保持原表名**，方言差异由标识符引用处理）+ `CronJob` 实体 | 字段一一对应，便于迁移 |
| `ICubeJob.Execute(String argument)` | `interface CubeJob { String execute(String argument); }` | 单参数签名保留 |
| `[CronJob(name, cron, enable)]` | `@CubeJob(name="...", cron="...", enable=false)` | 注解等价 |
| `JobService.ScanJobs()` | 插件启动扫描域内 `CubeJob` Bean / `@CubeJob` 方法 → `CronJobRegistrar.add(...)` | **只创建不覆盖**：已存在的作业保留用户改过的 Cron/启用状态 |
| `JobService.Wake()` | `CronJobRegistrar.wake()` | 配置变更立即重排，不用等下一轮扫描 |
| `Method = "Type.Method"` 静态方法全名 | 仅允许插件内 `Class#method` | 插件卸载后拒绝执行，避免类加载器无法回收 |

#### 5.13.4 Cron 语义必须等价（高风险点）

现状实现 `NewLife.Threading.Cron`（`NewLife.Core/Threading/Cron.cs` + `Doc/Cron表达式.md`）：**6 段：秒 分 时 日 月 星期**，**0 = 周日**，支持 `?`、`d#k`（每月第 k 个星期 d）、`d#Lk`（每月倒数第 k 个星期 d），**无年份段**。

| 语法 | NewLife.Cron | Spring `CronExpression` | Quartz | 处理方式 |
|---|---|---|---|---|
| 段数 | 6 | 6 | 6~7（含年） | 一致 |
| 周日 | **0** | 0 或 7 | 1~7（1=SUN） | **必须换算，不能直接透传** |
| `?` | 支持 | 支持 | 支持 | 一致 |
| `L` / `W` | 不支持 | 支持 | 支持 | **不接受**（前端与存量数据都不产这两种） |
| `d#k` | 支持 | 支持 | 支持 | 一致 |
| `d#Lk`（倒数第 k 个星期） | **支持** | **不支持** | 不支持（Quartz 只有 `dL`） | **必须自研** |
| 年份段 | 无 | 无 | 有 | 忽略 |

**结论**：不得直接把 `Spring CronExpression` 当作实现。做法：自研 `CubeCron`（移植 `Cron.cs` 的算法并移植其单测用例）；Spring `CronExpression` 仅用于不暴露给用户的内部定时器。

#### 5.13.5 AntJob 迁移为平台能力（MIT，自有代码）

现状（仓库 `../../AntJob`，MIT）：`AntJob`（`Scheduler`/`Handler`/`JobContext`/`AntJobWorker`/`Data`/`Providers`）+ `AntJob.Server` + `AntJob.Agent` + `AntJob.Web` + `AntJob.Data` + `AntJob.Extensions`，98 `.cs` / 12,469 行；模式 `JobModes.Data / Time / Message`；任务按时间片/数据区间切片、失败重试、结果回传；Provider：`File`/`Http`/`Network`。

| 现状 | Java 落点（`job-ant` 插件） | 说明 |
|---|---|---|
| `IJob` / `Handler` / `JobContext` | `AntJob` / `AntHandler` / `AntContext` | 保留 `OnAdvance`/`OnProcess`/`OnError` 语义 |
| `Scheduler`（切片/分配/回收/心跳） | `AntScheduler` + 任务表（对应 `TaskModel`） | 抢占与心跳用 DB 或 Redis 锁 |
| `JobModes` | `enum JobMode { DATA, TIME, MESSAGE }` | **保持三种，不新增** |
| `Providers`（File/Http/Network） | `JobProvider` SPI：`file`/`http`/`net` | 默认 `http` |
| `AntJob.Server`（管理端） | 插件内管理端点 + ArcoVue 页面（走通用控制器） | 不引入外部 admin |
| `AntJob.Agent`（执行端） | 插件内 Agent（注册/心跳/领任务/回传） | 可独立部署为卫星服务（L 档） |
| `AntJob.Web` | 插件前端资源（`frontend/`） | 复用平台菜单与权限位 |

**关键约束**

| 约束 | 说明 |
|---|---|
| 分层 | K15 管"到点触发"，AntJob 管"大任务切片并行"；K15 触发一个 AntJob 作业 = 生成一批切片任务 |
| 归属插件域 | 插件停用 → 其作业自动暂停（配置保留）；切片未完成任务按 `block/readonly/drain` 策略处理（§7.6） |
| 幂等 | 切片键 = `(jobId, sliceStart, sliceEnd)`；重复领取不重复执行 |
| 可观测 | 每次切片执行带 `traceId`，与 §13 同一链路 |

#### 5.13.6 XXL-Job 兼容插件（协议实现，不内嵌 GPL）

`xxl-job-core` 是 **GPL-3.0**，内嵌进分发物即构成衍生作品 → **不引入该依赖**。

| 方向 | 实现 |
|---|---|
| 平台作为**执行器**（被 XXL-Job Admin 调度） | 自研免依赖执行器：**出站**注册 `registry` / 心跳 `beat` / 结果回调 `callback`；**入站**提供 `/run`、`/kill`、`/log` 供 Admin 触发与取日志。作业注册表来自插件内 `@CubeJob`；**仅依赖 HTTP/JSON** |
| 平台作为**调度方**（调 XXL 的 GLUE/Bean 任务） | 不实现（对方自带执行器，属外部系统） |
| 交付形态 | 独立插件包 `job-xxl`，**不进核心 BOM、不进默认安装包**，客户需要才装 |
| D1 内部自用放宽 | 若确认只在组织内自用（不分发），可切到官方 `xxl-job-core` 实现（配置开关，两个实现共用同一 SPI） |
| 表结构 | 不建 XXL 表；平台侧只存映射（`CronJob.ExternalRef` 新增列） |
| 版本跟随 | Admin 2.4 / 3.x 字段差异用 conformance 测试兜底（JOB-5） |

#### 5.13.7 集群语义

| 问题 | 方案 |
|---|---|
| 谁执行 | 单机：本进程；集群：DB 原子抢占并附 owner、租约与单调递增 fencing token；到期接管可能与暂停的旧执行者重叠，外部副作用须幂等或由目标系统校验 fencing token（§16.4） |
| 节点宕机 | 锁带 `LockedUntil`，到期自动可被其他节点接管 |
| 错过触发 | `misfire`：`catch-up`（补跑 1 次，默认）/ `skip` / `catch-up-all`（带上限） |
| 并发 | 同一作业默认 `disallow`（上次未完成不重入），可配 `allow` |
| 历史 | `CronJobLog`（JobId/Start/End/Success/Result/Error/TraceId/NodeId），按保留期清理 |
| 插件停用 | 作业暂停（不删配置），恢复即续跑 |

#### 5.13.8 验收

| # | 用例 | 判定 |
|---|---|---|
| JOB-1 | Cron 语义迁移比对（含 `?`/`#`/`#L`/0=周日），与 .NET 逐条比"下 N 次触发时间" | 完全一致 |
| JOB-2 | 迁移现有 `CronJob` 数据后，`ScanJobs` 不覆盖用户改过的 Cron/启用状态 | 通过 |
| JOB-3 | 两节点断网、进程暂停与租约过期接管：旧 owner 不得提交受围栏保护的结果；外部副作用按幂等契约去重 | 预期通过 |
| JOB-4 | 插件停用 → 作业暂停不触发；启用 → 恢复；卸载 → 记录保留 | 通过 |
| JOB-5 | 与真实 XXL-Job Admin 联调：注册/心跳/触发/回调成功（未引入 `xxl-job-core`） | 通过 |
| JOB-6 | AntJob：三模式 + 切片并行 + 失败重试 + 幂等领取 | 通过 |

### 5.14 文件与对象存储（K5 子能力 + `storage` 插件，D-28）

#### 5.14.1 现状（必须原样保留的能力）

`NewLife.Cube` 已有完整抽象（见 `Doc/SYS-文件存储.md`）：

- `Attachment` 实体（`NewLife.Cube/Entity/附件.cs`）：`Title`/`FileName`/`Extension`/`Size`/`FilePath`/`ContentType`/`Enable` + `Storage`/`Hash`/`Key`/`Url`/`Source`/`Downloads`/`UploadTime`；
- 存储实现：本地磁盘、NAS、**S3 兼容对象存储**（`S3ObjectStorage`：AWS SigV4 签名、**路径风格**访问、流式上传 `UNSIGNED-PAYLOAD`，已对接阿里云 OSS / 腾讯 COS / 七牛 Kodo，**不引厂商 SDK**）；
- 分布式文件同步（P2P 扫描缺失文件 + 同步）、缺失扫描、清理作业；
- 配置：`ObjectStorageServer`/`Region`/`Bucket`/`AccessKey`/`SecretKey` 等。

#### 5.14.2 Java 侧设计

| 层 | 设计 |
|---|---|
| SPI | `ObjectStorage { put / get / delete / head / presign }`，由 `storage` 插件提供实现，`file` 系统插件消费 |
| Provider | `local`（默认）/ `nas`（挂载路径）/ `s3`（**MinIO、阿里云 OSS、腾讯 COS、七牛 Kodo、华为 OBS** 统一走 S3 兼容 + 路径风格） |
| 契约 | `/Attachment/*` 端点、下载 URL、`Content-Type` / `Content-Disposition`、附件实体字段**逐条等价**（L2 样本覆盖） |
| 大文件 | 流式转发（不落临时文件）+ Range 下载；大小上限可配 |
| 一致性 | 先写对象再写 `Attachment` 记录；`Hash` 去重可选；删除走"软删 + 异步清理" |
| 对账 | `local/nas` 走目录扫描；`s3` 走对象列表扫描，输出缺失/孤儿清单 |

```yaml
cube:
  storage:
    provider: s3                 # local | nas | s3
    s3:
      endpoint: http://minio.internal:9000
      bucket: cube
      region: us-east-1          # MinIO 可任意；OSS/COS 用真实 region
      access-key: ${CUBE_S3_AK}
      secret-key: ${CUBE_S3_SK}
      path-style: true           # MinIO 必须 true；OSS/COS 需实测
      presign-expire: 3600s
```

#### 5.14.3 MinIO 的定位与许可（D-28 落定）

| 项 | 结论 |
|---|---|
| 定位 | **外部独立进程**（客户自建或随交付包提供），平台只经 S3 协议访问 |
| 许可 | MinIO = **AGPL-3.0**；独立进程 + 不修改源码 ⇒ 义务仅覆盖其自身 → 随包提供"组件清单 + 源码获取指引"（§10.5） |
| 不做什么 | 不把 MinIO 代码链接进平台 jar；不做 MinIO 二次开发；不宣称"内嵌存储" |
| 备选 | 纯 Apache-2.0 诉求用 SeaweedFS；云上直接对接 OSS/COS/Kodo（同一 `s3` 实现） |

#### 5.14.4 验收

| # | 用例 | 判定 |
|---|---|---|
| FILE-1 | `local` / `nas` / `s3(MinIO)` 三 provider 上传→下载→删除全通，响应头与 .NET 一致 | 通过 |
| FILE-2 | ≥1GB 大文件流式上传/下载，内存不随文件大小增长 | 通过 |
| FILE-3 | `storage` 插件停用：上传入口隐藏，已有附件仍可读（不 404） | 通过 |
| FILE-4 | 对账：手工删除对象后，扫描任务能报出缺失清单 | 通过 |

### 5.15 AI 就绪与 AI 插件（K16 / `ai` 插件，D-36）

> **结论先行**：**Spring AI Alibaba 可替代 NewLife.AI**——但只能是"**分层替代**"，不能整体照搬。三层分工：
> **①Spring AI 1.1.2（核心：对话/工具/MCP/记忆/多模态）→ ②Spring AI Alibaba 1.1.2.2（可选：Graph 与多智能体编排）→ ③Cube 自研薄层（SSE 契约 / 动态工具 / 权限裁剪 / 模型热切换 / 用量审计）**。
> 完整能力对照与缺口清单见可行性篇 §9.8，模块级对照见 §15.6。

#### 5.15.1 现状基线（.NET 侧，必须逐项对齐）

| 面 | 现状实现 | 关键约束 |
|---|---|---|
| 模型接入 | `AIService : IAIService` 按 `CubeSetting`（`AISwitch`/`AIProvider`/`AIModel`/`AIEndpoint`/`AIApiKey`）**惰性创建并复用** `Microsoft.Extensions.AI.IChatClient`；四项配置任一变化即重建客户端 | **改配置即时生效，不重启** |
| 服务商来源 | `NewLife.AI` 的 `AiClientRegistry.Default.CreateClient(provider, apiKey, model, endpoint)`（46 家注册发现）；未注册服务商**直接抛错**，不静默回退 OpenAI 兼容 | 不静默降级 |
| 插件装配 | `AIPlugin : IModule` → `AddCubeAI()` | 插件化形态 |
| 唯一端点 | `POST /Ai/AiChat`（`[Route("Ai/[action]")]`）；SSE 流式；JSON 口径 = **camelCase + 忽略 null + 中文直出 + Int64 转字符串** | 前端零改动 |
| 请求体 | `CubeAiChatRequest { Page, Mode, Id, Query, Area, Controller, Url, CheckpointId }`（继承 `AiChatRequest`），`_query` 解码 | 页面上下文是核心 |
| 工具面 | `CubeTools`（`GetPageDataContext` / `GetFormSchema` / `FillForm` / 数据洞察取样 / 当前记录定位…，`[Description]` 供模型选择）+ `BrowserToolService`（浏览器操作 + 检查点）+ `ConfigFormToolService` + `SystemInfoToolService` | **有页面才有工具** |
| 工具可见性 | 按目标控制器实现的 `IPageDataContext` / `IFormAiContext` / `IEntityAiContext` **动态注册**；数据只取"安全字段" | 权限与脱敏 |
| 上下文装配 | `AiDataHelper` / `AiFormHelper` / `AiInsightHelper` / `PageCheckpointService`（页面快照与回放） | — |
| 后台用法 | `AILogSummaryJob` / `AISecurityReportJob` 走 `ChatAsync`（非流式，保留模型默认推理） | 作业内调用 |

> **形态判定**：它是"**页面上下文 + 动态工具 + 单端点 SSE**"，不是通用聊天机器人。Java 侧必须复刻这三件；其余（服务商数量、控制台、渠道集成）可按需裁剪。

#### 5.15.2 选型与映射（版本 pin）

| 组件 | 版本 | 许可 | 定位 |
|---|---|---|---|
| **Spring AI** | **1.1.2** | Apache-2.0 | 核心：`ChatClient`/`ChatModel`、`@Tool` 工具调用、MCP client/server、ChatMemory、多模态、Embedding/向量 |
| **Spring AI Alibaba** | **1.1.2.2**（`revision`；依赖 Spring AI 1.1.2，`spring-boot.version=3.5.8`，JDK 17+） | Apache-2.0 | 可选：`graph-core`（图编排/持久化/流式）、`agent-framework`（Sequential/Parallel/Routing/Loop 多智能体）、`starter-graph-observation`（Micrometer/OTel） |
| DashScope 原生 starter | 1.1.2.1（`com.alibaba.cloud.ai:spring-ai-alibaba-starter-dashscope`，**不在主仓 BOM**） | Apache-2.0 | 可选：千问原生（含 rerank/视频）；**默认不引入** |
| **不采用** | — | — | `spring-ai-alibaba-studio` / `-admin`（开发期调试台，非投产件）、`starter-a2a-nacos` / `-agentscope` / `-config-nacos`（引入 Nacos + A2A 依赖，平台无此诉求） |

**.NET → Java 组件映射**

| 能力 | .NET 侧 | Java 侧 |
|---|---|---|
| 统一对话抽象 | `IChatClient`（Microsoft.Extensions.AI） | `ChatClient` + `ChatModel` |
| 服务商接入 | `AiClientRegistry` 46 家 | `spring-ai-starter-model-openai` / `-ollama` / `-deepseek` / `-anthropic` / `-google-genai` / `-mistral` / `-bedrock`（按需，**不做 46 家**） |
| 工具声明 | `[Description]` 标注的方法 | `@Tool` + `ToolCallbackProvider` |
| 工具循环 | `ToolChatClient` | Spring AI 内置工具执行循环 + `ToolCallAdvisor`（工具多时用 `spring-ai-starter-tool-search-advisor`） |
| MCP 服务端（关键） | NewLife.AI MCP 实现 | `spring-ai-starter-mcp-server-webmvc`（把 Cube 实体/工具暴露为 MCP 工具） |
| MCP 客户端 | 同上 | `spring-ai-starter-mcp-client`（stdio）/ `-webflux`（HTTP） |
| 会话记忆 | 会话表 + 注入策略 | `ChatMemory` + `spring-ai-starter-model-chat-memory-repository-jdbc` / `-redis` |
| 过滤器链 | `IChatFilter` 链 | Advisor 链（call / stream Advisor） |
| 多智能体 / 编排 | Planner + 多 Agent + 反思 | **Spring AI Alibaba** `graph-core` / `agent-framework`（可选） |
| 向量 / 知识库 | `HashTextEmbedder` + `InMemoryVectorStore` | `EmbeddingModel` + `spring-ai-starter-vector-store-redis` / `-pgvector`（P5 可选） |
| 流式端点 | `/Ai/AiChat` SSE | **自研 `AiSseWriter`（`SseEmitter`）**，事件与序列化口径逐字节对齐 |

#### 5.15.3 「AI 就绪」三条硬约束（P1 起生效）

| # | 约束 | 落地方式 | 门禁 |
|---|---|---|---|
| **AIR-1** | **元数据即工具** | 工具清单由 K1 元数据 + K5 路由表**生成**，不写死；新增实体/控制器插件 → 工具自动出现（与 §7.7 菜单同一生成源） | AI-2：新装插件后工具清单自动 +N |
| **AIR-2** | **权限即工具边界** | 工具调用与 HTTP 走**同一套判定**（`Permission` + `DataScope` + `Tenant`）；`AiContext` 由令牌解析填充；**无权限的工具根本不下发给模型**；禁止"服务端直连 DAO 绕过权限"的工具实现 | AI-2：越权调用必须被拒并留审计 |
| **AIR-3** | **契约即基线** | `/Ai/AiChat` 的事件类型、字段、顺序、序列化口径（camelCase / 忽略 null / 中文直出 / Int64→String）进契约基线；前端 ArcoVue 零改动 | AI-1：SSE 逐字段 diff = 0 |

#### 5.15.4 内核与插件的切分

| 层 | 归属 | 起用阶段 | 内容 |
|---|---|---|---|
| 内核 `cube-kernel-ai`（K16） | 不可热插拔 | **P1** | `ToolRegistry`（ExtensionPoint）、`AiContext`（用户/租户/权限/页面）、`AiToolGuard`（权限判定钩子）、MCP server 端点（`/mcp`，Streamable HTTP）、`AiSseWriter`（契约基座） |
| 插件 `ai` | 系统插件 | P2 骨架 / P4 完整 | `ChatClient` 装配与模型配置中心、会话/消息实体（`AiSession` / `AiMessage` / `AiChatLog`）、`POST /Ai/AiChat`、内置工具实现（页面上下文/表单/洞察/浏览器/检查点）、用量与成本审计、配额限流 |
| 插件（可选） | 系统插件 | P5+ | `ai-graph`（Spring AI Alibaba 编排）、`ai-kb`（向量知识库）、`ai-gateway`（OpenAI 兼容入站 + AppKey） |
| **不复刻** | — | — | NewLife.AI 的 IM 渠道（钉钉/企微/飞书/Slack/Telegram）、Studio/Admin 控制台、46 家服务商元数据与报价体系 |

> **插件停用语义**：`ai` 停用 → `/Ai/AiChat` 返回 `503 + code=-4`（与其它插件一致）、AI 浮窗前端隐藏、`/mcp` 端点下线；**已有会话数据保留可读**（不 404）。内核 K16 不随插件停用，保证 MCP 与工具注册表始终可用（供其它插件声明工具）。

#### 5.15.5 模型配置与热切换

| 项 | 设计 | 与现状一致性 |
|---|---|---|
| 配置项 | `cube.ai.switch` / `provider` / `model` / `endpoint` / `api-key`（对应 `AISwitch`/`AIProvider`/`AIModel`/`AIEndpoint`/`AIApiKey`） | 同名同义 |
| 生效方式 | **不使用 Spring AI 的全局自动配置 Bean**；按配置构造 `ChatModel`/`ChatClient` 实例，缓存键 = 配置指纹（provider+model+endpoint+apiKey 摘要），配置变更即重建 | 与 `AIService.GetClient()` 完全一致 |
| 服务商白名单 | `openai-compatible`（含 vLLM / DeepSeek / 千问兼容模式）、`ollama`；可选 `anthropic`、`google-genai`、`dashscope` | 收敛到 3~6 家 |
| 离线优先 | 默认 `ollama` 或 vLLM（OpenAI 兼容端点）；**无外网可完成全流程演示** | 私有化交付硬要求 |
| 未注册服务商 | 抛配置错误 + 管理员提示，**不静默回退** | 同现状 |
| 后台调用 | `AiJobExecutor` 提供非流式 `chat(prompt, data)`，供 `AILogSummaryJob` / `AISecurityReportJob` 等价作业使用 | 同 `ChatAsync` |

#### 5.15.6 工具与安全

| 风险 | 对策 |
|---|---|
| 工具越权 | 工具注册即绑定 `Permission + DataScope`；执行前 `AiToolGuard` 二次校验；每次调用写 `AiChatLog` |
| 数据外泄 | 上下文只取"当前页可见字段"（沿用 `CubeTools` 的仅安全字段策略 + 字段级脱敏）；`ShowIn` 隐藏字段**永不进上下文** |
| Prompt 注入 | 系统提示固定 + 用户输入与页面数据分区（数据进 user 段并标注来源标记）；工具参数只接受**结构化 JSON**并校验 |
| 写操作 | 与现状一致：AI 只"**回填前端表单**"（`FillForm`），**不直接落库**；落库由用户确认后走正常 CRUD，权限照旧 |
| 成本失控 | 单会话 token 预算 + 单用户 QPS + 日配额 + 超时（默认 60s）；超限返回明确错误事件 |
| 审计 | `AiChatLog`：用户/租户/模型/提示摘要/工具调用序列/token/耗时/结果码/`traceId` |
| MCP 暴露面 | `/mcp` 端点独立权限位（默认关闭），只暴露**已授权实体**的只读工具；写工具默认不注册到 MCP |

#### 5.15.7 验收（AI-1~AI-7）

| # | 用例 | 判定 |
|---|---|---|
| **AI-1** | `/Ai/AiChat` SSE 契约回归：事件类型、字段、顺序、序列化（camelCase/忽略 null/中文直出/Int64→String）与基线逐字段 diff | diff = 0 |
| **AI-2** | 动态工具：按当前控制器 + 权限裁剪工具清单；**越权工具不下发**，手工构造越权调用被拒并写审计 | 通过 |
| **AI-3** | MCP：外部 MCP client 能 `list_tools` 出当前用户可见的实体工具并成功调用只读工具 | 通过 |
| **AI-4** | 模型热切换：改 `provider/model/endpoint/api-key` 任一后**不重启**即生效；未注册服务商报明确错误 | 通过 |
| **AI-5** | 离线模式：仅 Ollama/vLLM（无外网）完成"页面上下文 → 表单回填 → 洞察分析"全流程 | 通过 |
| **AI-6** | 用量与配额：`AiChatLog` 记录完整；超配额返回明确错误事件，不 500、不静默截断 | 通过 |
| **AI-7** | 失败降级：模型不可用/密钥错/超时 → 前端收到可读错误事件，页面其余功能不受影响；`ai` 停用后 `/Ai/AiChat` 返回 `503 + code=-4` | 通过 |

#### 5.15.8 工程量与切片

| 项 | 人月 | 阶段 | 说明 |
|---|---:|---|---|
| 内核 `cube-kernel-ai`（工具注册表 / AiContext / MCP server / SSE 基座 / 权限钩子） | **0.5** | P1 | 保证"从第一天就 AI 就绪" |
| `ai` 插件（ChatClient 装配 + 配置热切换 + 会话实体 + 内置工具 + 审计配额） | **3.5** | P2 骨架 / P4 完整 | v4.3.3 由 3.0 上调（MCP server/client + 契约回归 + 工具权限） |
| 合计 | **4.0** | — | 可行性篇 §8.2 |

**P1 出口**：`/mcp` 能 `list_tools` 出 1 个实体的工具、`AiContext` 能解析令牌与租户、`AiSseWriter` 骨架可返回固定事件。
**P4 出口**：AI-1~AI-7 全绿 + 灰度期错误率/P99 达标。

### 5.16 `Parameter`：运行态参数中心（D-39）

> 依据：`NewLife.XCode/XCode/Membership/字典参数.cs`（实体 `Parameter`，`ConnName=Membership`）+ `Member.xml` + `ParameterKinds.cs`。**它不是"配置表"，而是平台唯一的运行态名值仓库**——现有 Cube 已经用它装工作台 `Workbench.Role`、系统开关、LOV 种子等，但**缺作用域/域归属/格式/版本**，多插件共用后无法治理。

#### 5.16.1 现状（必须兼容的既有契约）

| 字段 | 类型 | 语义 |
|---|---|---|
| `ID` | Int32 PK 自增 | 编号 |
| `UserID` | Int32 | **0 = 系统级**；>0 为用户私有 |
| `Category` | String | 类别（点分命名，如 `System.Site`、`Lov.Sex`） |
| `Name` | String（Master） | 名称 |
| `Value` | String(200) | 短值 |
| `LongValue` | String(-1) | 长值（JSON/XML 落这里） |
| `Kind` | Int32（`ParameterKinds`） | `Normal=0 / Boolean=3 / Int=9 / Double=14 / DateTime=16 / String=18 / List=21 / Hash=22` |
| `Enable` | Boolean | 启用 |
| `Ex1~Ex6` | Int32/Decimal/Double/String… | 扩展位（现被业务零散使用） |
| 唯一索引 | `IU_Parameter_UserID_Category_Name` | 同一用户同一类别下名称唯一 |

#### 5.16.2 增强字段（**只加列，不改既有列语义**）

| 新列 | 类型 | 默认 | 用途 |
|---|---|---|---|
| `Scope` | String(20) | `Global` | `Global` / `Tenant` / `Role` / `User`——解决"用户 0 就是系统级"表达不了租户/角色级的问题 |
| `TenantId` | Int32 | 0 | 租户级参数（非 SaaS 场景可为 0） |
| `Domain` | String(100) | `""` | 归属：`pluginId` 或 `core`；插件卸载时可精确清理（§7.10） |
| `Format` | String(20) | `text` | `text` / `json` / `xml` / `yaml`——决定读取时的解析与校验 |
| `Version` | Int32 | 1 | 参数契约版本（前端可据此做兼容分支） |
| `IsSystem` | Boolean | false | 系统配置：业务侧**只读**，仅平台/管理员可改 |
| `Expire` | DateTime | null | 缓存过期时间（空=永久，随广播失效） |

`Kind` **只追加不重排**：保留 `0/3/9/14/16/18/21/22` 原值，新增 `30 = Config`、`31 = Lov`、`32 = Query`、`33 = Dict`（存量数据零处理）。

#### 5.16.3 四类用途（同一张表，靠 `Category + Kind` 分区）

| 用途 | `Category` 约定 | `Kind` | `LongValue` 结构 | 谁写 | 谁读 |
|---|---|---|---|---|---|
| **系统配置** | `System.<模块>` 如 `System.Site`、`System.Mail` | 30 | 标量或小 JSON | 管理员（`ParameterController`） | 全平台（启动/请求期带缓存） |
| **LOV 值集** | `Lov.<code>` | 31 | `[{"value":"1","label":"男","sort":0,"enable":true,"parent":null}]` | 管理员 / `LovController` | 前端下拉 + 后端校验（`LovRegistry`/`LovStore` 等价物） |
| **预定义查询（共享）** | `Query.<entityKey>` | 32 | `{"version":2,"queries":[{id,name,q,filter}]}`（与 `ViewProfile.QueriesJson` **同结构**） | 管理员/团队管理员 | 列表页查询簇（团队共享；**个人级仍存 `ViewProfile`**） |
| **自定义字典** | `Dict.<code>` | 33 | `{"items":[{value,label,parent,sort,enable,ext}]}` | 管理员 / 插件种子 | 元数据 `Type` 解析、`/meta` 下发 |

**边界纪律（避免与 `ViewProfile`/`UserProfile` 打架）**

- **布局与个人偏好**（列顺序、宽度、命名视图、填色、分组、甘特/卡片映射、仪表盘、个人查询）→ **`ViewProfile`**（§5.9.5），不进 `Parameter`。
- **全局/团队共享的运行态数据**（系统配置、LOV、共享查询、字典）→ **`Parameter`**。
- **首页/命名工作台** → `UserProfile.HomeJson`；**角色级工作台** → `Parameter(Scope=Role, Category=Workbench.Role)`（现状语义，保留）。
- 同一条数据**不允许两处存**：写入口唯一，读侧只读一份。

#### 5.16.4 读取与缓存

- 批量接口 `GET /Cube/Parameter/Batch?category=...&scope=...`（**必须批量**：`/meta` 与列表初始化一次取回，避免 N 次往返）。
- 缓存：`L1 Caffeine + L2 Redis`，key = `Parameter:{Scope}:{TenantId}:{UserID}:{Category}:{Name}`；TTL 取 `Expire`，无则按 §5.5 默认；写操作发布 `ParameterChanged(domain, category)` 域级失效（与 §3.4 失效广播同一通道）。
- 解析失败策略：`Format=json` 但内容非法 → **保留原文 + 记 ERROR 日志 + 返回默认值**，不抛 500（配置坏了不该把系统带崩）。
- 审计：`IsSystem=true` 的变更必须记审计（谁改、旧值、新值）。

**验收**

| # | 用例 | 判定 |
|---|---|---|
| PARAM-1 | 存量 `Parameter` 数据（无新列）在升级后仍可读写，`Kind` 原值含义不变 | 通过 |
| PARAM-2 | 同一 `Category+Name` 在 `Global/Tenant/Role/User` 四层各存一份，读取按 `User > Role > Tenant > Global` 取到最specific | 通过 |
| PARAM-3 | 管理员改 LOV/字典 → 两节点在广播后 1s 内取到新值；业务侧改 `IsSystem=true` 项被拒（403） | 通过 |

### 5.17 异步读写（`EntityQueue` 等价，D-41）

> 依据：`NewLife.XCode/Doc/实体队列异步批写（EntityQueue）.md` + `XCode/Entity/EntityQueue.cs` 语义。它解决的是"**高频、可容忍延迟、可容忍极少丢失**"的写入放大问题（审计日志、在线心跳、统计计数、物联网采样），**不是**事务替代品。

#### 5.17.1 .NET 语义（必须理解的四点）

| 点 | 语义 |
|---|---|
| 两级队列 | 近实时 `Entities`（下次 tick 全量刷出）+ 延迟 `DelayEntities`（`Add(entity, ms)` 到期才参与） |
| 自适应周期 | 初始 **1000ms**，按上次处理量在 **500~5000ms** 间调节（>1000 条缩短，<1000 条延长） |
| 背压与上限 | 深度上限 `MaxEntity`（默认 100 万）；达到上限时写线程 `sleep(100)` 间歇等待**最多 15s**，仍失败返回 `false` 由调用方决定丢弃/重试 |
| 批次与关闭 | 每次刷出 ≤**10000** 条自动分批；`Dispose` 会等最多 **3s** 刷完，超时记 Tracer 错误；单批异常走 `OnError` 不影响其余批次 |

#### 5.17.2 Java 落点（`AsyncWriteQueue`）

```java
public interface AsyncWriteQueue<E extends Persistable> extends AutoCloseable {
    boolean add(E entity, long delayMs);     // false = 背压拒绝（调用方决定丢弃/重试）
    void flush();                            // 强制刷出（测试与优雅停机用）
    Stats stats();                           // queued / flushed / failed / periodMs
    void close();                            // 语义等价 Dispose：最多等 3s
}
```

| 维度 | 设计 | 与 .NET 差异 |
|---|---|---|
| 载体 | `ConcurrentHashMap<E>` + `DelayQueue` + **单个虚拟线程刷写器**（JDK 21 虚拟线程 / 25 亦可用） | 取代 `TimerX`；周期自适应算法照抄（500~5000ms） |
| 批量 | 每次 ≤10000；`insert-batch` / `upsert-batch` 走 `DbProvider.batchInsert` | 同 |
| 背压 | `Semaphore(maxEntity)`，获取超时 15s 后返回 `false` | 同语义 |
| **事务边界** | 可丢失数据可在 `afterCommit` 入队；业务关键事件须在业务事务内写持久化 outbox，提交后异步投递 | `afterCommit` 仅避免回滚后的脏写，不能保证提交后进程崩溃不丢消息；详见 §16.3 |
| 关闭 | `@PreDestroy` → `close()`（等 3s）→ 超时告警 | 同 |
| 观测 | `cube_async_write_queue{entity,state}` 指标 + 慢/丢弃计数 + `/Diag/AsyncQueue` 端点 | 新增（.NET 侧只有 `Speed` 属性） |

**适用范围（必须写进插件开发规范）**

| 可以异步 | 禁止异步 |
|---|---|
| 明确允许丢失的访问日志、在线心跳、统计采样等；有完整性要求的审计和 AI 会话日志须用持久化路径 | 业务主单据、需要同步返回自增 ID 的插入、有唯一约束且需要立即报错的写入、审批流转记录、库存/账务类金额变更 |

#### 5.17.3 异步查询（读侧）

- **不引入 R2DBC**：6 个目标库中只有 3 个驱动成熟，且与 MyBatis-Plus/JPA 生态冲突，收益不足以抵消两套访问栈的成本（D-41 只做写侧异步）。
- 读侧异步 = **虚拟线程 + `CompletableFuture`**：`repository.findAllAsync(...)` 提交到专用 `ExecutorService`（虚拟线程，带超时与并发上限），JDBC 阻塞被虚拟线程吸收；**禁止在事件循环/Servlet 线程内 `future.get()` 无限等待**，统一超时（默认 30s）+ 可配。
- 分页导出/大报表走"提交任务 → 轮询/SSE 推进度"（复用 §13 的作业与 SSE 通道），不在请求线程里同步跑。

**验收**

| # | 用例 | 判定 |
|---|---|---|
| ASYNC-1 | 事务内 `insert` 后 `rollback`：队列里**没有**该条记录（afterCommit 生效） | 通过 |
| ASYNC-2 | 灌入 100 万条心跳，深度达上限后 `add` 返回 `false` 且**不阻塞 >16s**；`close()` 3s 内刷完或告警 | 通过 |
| ASYNC-3 | 单批写入抛异常：其余批次正常落库，`failed` 计数 +1，无数据丢失掩盖（错误可见） | 通过 |

## 6. `/meta` 生成规格（K5，最高风险项）

### 6.1 链路

```
EntityMeta（K1，域归属） + Controller 声明（K3 生成） + 权限/租户上下文（K6）
        ↓
PageMetaBuilder.buildEntity() / buildFields() / buildSearch() / buildToolbar()
        ↓
ApiResponse{code:0, data:{entity,setting,list,addForm,editForm,detail,search,toolbar}}
```

### 6.2 键级规格（**必须逐键等价**）

| JSON 键 | 取值规则 |
|---|---|
| `entity.name` | 实体名（= Controller 名） |
| `entity.displayName` | `DisplayName` 特性 → 表 `Description` → 类名 |
| `entity.primaryKey` | 唯一键名，否则表主键 |
| `setting.enableAdd/enableSelect/enableToolbar/isReadOnly/doubleDelete/develop/isSystem` | 控制器声明 + 全局配置 + 权限 |
| `setting.menuId` | 当前菜单 ID（前端据此对齐权限） |
| `setting.requiredPermissions` | `{add:2, update:4, delete:8, export:16, import:32}`（位值，前端按位与） |
| `list[].name/displayName/typeName/length/nullable/default` | 字段元数据；`displayName` 经 `Accept-Language` 本地化 |
| `list[].visible` | 不可见时输出 `visible=false`（**不可省略该键**） |
| `list[].virtual` | 无物理列（链接列）时强制 `true` |
| `list[].url/target/text` | 控制器声明；`TraceId` 可自动补 URL |
| `list[].width/align/format` | 字段元数据 + 控制器覆盖 |
| `form[]` / `addForm[]` / `editForm[]` | 相同可只输出 `form` |
| `form[].required/readOnly/editor/options/dataSource` | 字段元数据 + 表单配置 + 枚举/字典 |
| `search[].kind` | 关键字 `keyword`；范围 `range`；其余精确匹配 |
| `Q` → `q` | **原字段名 `Q` 统一改名 `q` 并置 `kind=keyword`** |
| `dtStart`/`dtEnd` | 主时间字段转范围搜索，原字段从搜索项移除；附 `field`（真实列名）+ `range.typeName=DateTime` |
| `search[].dataSource` | 小表 → `{id: name}`；大表 → `lovCode = Entity.{实体全名}` |
| `search[].itemType` | 字段元数据；布尔按 `typeName=Boolean` 渲染，不依赖 `dataSource` |
| `toolbar[].kind/action/method/include/requiresSelection/confirm` | 工具栏声明（`kind=request`/`kind=js`） |
| `sensitive` | 无字段权限时 `true`，服务端值脱敏 `***` |
| 匿名请求 | **不下发权限表达式** |

### 6.3 本地化（必须补齐）

- 后端有 **32 份 Locale 词表**（`NewLife.Cube/Locales/*.yml`），字段译文由 `DataField.Localize()` 提供
- Java 要求：
  1. 解析 `Accept-Language`（含 `?lang=` / Cookie 兜底，顺序对齐现状）
  2. `/meta` 的 `displayName`/`description`/`category`/枚举显示值本地化
  3. 错误消息、`fieldErrors[].message` 本地化
  4. 词表迁移：`*.yml` 保留 YAML 格式（SnakeYAML 加载）以减少改造
- 验收：同一 `/meta` 在 `zh-CN` 与 `en` 下 diff，除文案外结构完全一致

### 6.4 `X-Cube-Field-Validation` 语义

源码确认（`EntityController.cs:356-364`）：写请求携带 `X-Cube-Field-Validation: 1|true|yes`（忽略大小写）启用字段级校验；读请求/`GetPage`/`GetList` 不带头；不带头则行为不变。

Java 侧：仅对 `POST`/`PUT`/`PATCH` 生效；启用时校验失败 → `fieldErrors[{field,message,error}]` + `code=-2`；未启用时**不得**因具备能力就默认拒绝。

---

## 7. 插件体系（K7）—— 热插拔的唯一单位

### 7.0 颗粒度定义（本次核心修正）

| 项 | 是否可热插拔 | 说明 |
|---|---|---|
| **插件（pluginPackage）** | ✅ **唯一可热插拔单位** | 部署、版本、回滚、生命周期的最小单元 |
| 插件内的实体 | ⭕ 随插件 | 不单独注册/注销 |
| 插件内的控制器/路由 | ⭕ 随插件 | 不单独注册 |
| 插件内的菜单/权限位 | ⭕ 随插件 | 停用时隐藏、恢复时还原 |
| 插件内的作业/定时器 | ⭕ 随插件 | 停用时取消 |
| 内核模块（K1~K8） | ❌ | 只能整体滚动升级 |
| 单个字段/单条元数据 | ❌ | 禁止运行期改动（改字段 ⇒ 发新版插件） |

**三条理由**

1. **类加载隔离要求同生共死**：插件里的 `Order.class`、`OrderBiz.class`、`Filters` 调用链都在插件 ClassLoader 中；若只卸载元数据而类还在，会残留引用并阻止 ClassLoader 回收。
2. **事务性**：整包注册失败可整包回滚；单条注册一旦中途失败会留下"有元数据无路由/有路由无权限"的不一致状态。
3. **心智一致**：XCode/Cube 中业务模块 = 一个程序集（含多个实体），迁移后保持"一个插件包 = 一个业务模块"。

**代价与取舍**：新增一个实体需重装插件（L1 热启用场景下为秒级）。这是"以包为颗粒度"的自觉取舍，换取可靠性与可维护性。

### 7.1 插件分类

| 类型 | 举例 | 依赖方向 | 停用语义 | 版本节奏 |
|---|---|---|---|---|
| 内核（K1~K8） | meta/dsl/codegen/data/web/security/plugin/i18n | — | 不可停 | 随内核滚动 |
| **系统插件** | `admin`、`perm`、`file`、`storage`、`notify`、`workflow`、`ai`、`widget`、`license`、`sso`、`auth-third`、`usercenter`、`job-ant`、`job-xxl`（后两个可选） | **不得依赖业务插件**（R5） | 可停用；依赖它的业务插件**级联停用** | 与内核同版本（BOM 锁定） |
| **业务插件（代码型）** | 订单、客户、设备… | 可依赖系统插件暴露的 ExtensionPoint | 独立停用 | 独立版本 |
| **业务插件（配置型）** | 仅 Model.xml 的字典/台账模块 | 同上 | 独立停用 | 独立版本 |

#### 系统插件清单与启停边界

| 插件 | 提供能力 | 停用后的影响 | 是否允许停用 |
|---|---|---|---|
| `admin` | 用户/角色/部门/菜单/日志/参数/字典 | 前端壳无法工作 | ❌ 强制启用（基础） |
| `perm` | 权限位计算、数据权限、访问规则 | 授权失效 | ❌ 强制启用 |
| `file` | 附件上传/下载 + `Attachment` 契约 | 上传控件失效；已存附件按 `storage` 可解析路径仍可读 | ✅ 可停 |
| `storage` | 存储实现（local / nas / s3：MinIO、OSS、COS、Kodo、OBS） | 新上传失败；已有对象仍可按记录读取 | ✅ 可停（默认 `local`） |
| `notify` | 站内信/邮件/短信 | 通知能力缺失 | ✅ |
| `workflow` | 审批流（Flowable 引擎，§7.15） | 审批入口消失；在途实例按 `drain` 处理（§7.6） | ✅（需处理在途） |
| `ai` | AI 对话/诊断 | 助手入口消失 | ✅ |
| `job-ant` | AntJob 切片调度（可选，§5.13.5） | 切片作业不可用；到点触发仍由 K15 内核承担 | ✅ |
| `job-xxl` | XXL-Job 协议对接（可选，§5.13.6） | 外部调度不再可用 | ✅ |
| `widget` | 工作台部件 | 工作台空 | ✅ |
| `license` | 授权校验（到期/节点数/模块许可） | 按授权策略降级/阻断 | ✅ 但默认强制 |
| `sso` | OAuth2.0 客户端（微信/钉钉/企微/OIDC）+ 服务端（四种授权模式）+ 账号绑定（§8.5） | 只剩本地登录；已签发令牌有效至过期 | ✅ |
| `auth-third` | 短信/邮件/图形验证码 + TOTP MFA + 登录风控（§8.5） | 仅密码登录；已绑 MFA 用户按策略降级或拒绝 | ✅ |
| `usercenter` | 用户中心：用户/角色/部门/租户关系/用户链接/在线/统计/委托代理（§8.5） | 组织与角色接口 404，内核管理员账号仍可登录 | ✅（默认启用） |

> `admin`/`perm` 是"基础系统插件"：不可停用，但仍以插件方式部署（便于版本管理与模块化），只是把 `mandatory=true` 写进描述符。

### 7.2 插件包规范

```
myapp-order.cube  (zip)
├── cube-plugin.json           # 描述符
├── lib/
│   ├── myapp-order.jar        # 代码型：实体/Biz/Controller/Service
│   └── deps/*.jar             # 插件私有依赖（隔离加载）
├── model/
│   ├── Order.xml              # 配置型：源模型（可选，代码型也建议保留）
│   └── Order.json             # 编译期生成的元数据快照（代码型必有）
├── frontend/                  # 可选前端资源（懒加载 chunk / 图标 / 静态页）
│   └── assets/…
├── db/migration/
│   └── 1.0.0/*.sql            # 版本化 DDL
├── i18n/
│   └── messages_zh_CN.yml     # 插件自有词表
├── META-INF/
│   ├── MANIFEST.MF
│   └── SIGNATURE              # 签名（§7.11）
└── README.md
```

#### 描述符 `cube-plugin.json`

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | 全局唯一，如 `myapp-order` |
| `version` | ✅ | SemVer |
| `name` / `description` | ✅ | 显示名/描述（后台插件管理展示） |
| `type` | ✅ | `system` / `business-code` / `business-config` |
| `kernelApi` | ✅ | 内核 API 区间，如 `[1.0,2.0)` |
| `depends` | ✅ | `[{id, version}]`，可空数组 |
| `provides` | ⭕ | 提供的 ExtensionPoint 实现，如 `["workflow.approver"]` |
| `requires` | ⭕ | 依赖的 SPI，如 `["entity.registry","route.registry"]` |
| `mandatory` | ⭕ | 不可停用（`admin`/`perm`） |
| `models` | ⭕ | 模型清单（配置型必填） |
| `menus` | ⭕ | 声明式菜单（避免手工建菜单） |
| `permissions` | ⭕ | `[{code, bits}]` 权限位声明 |
| `assets` | ⭕ | 前端资源入口（`frontend/index.js`） |
| `migrations` | ⭕ | DDL 目录 + 目标版本 |
| `settings` | ⭕ | 插件配置项 Schema（后台可渲染表单） |
| `minPlatformVersion` | ⭕ | 平台版本要求 |

### 7.3 依赖与版本解析

```
resolve(pluginId)
  → 读全部描述符 → 构有向图
  → 拓扑排序（同层按 id 字典序，保证可复现）
  → 环检测（有环 ⇒ 拒绝并列出环路径）
  → 版本区间求交（交集为空 ⇒ 拒绝并提示冲突链）
  → 校验 R5：系统插件不得依赖 business-* 类型
  → 校验 kernelApi 与当前内核区间相交
  → 校验 requires ⊆ 内核已提供 SPI 集合
  → 输出启动顺序 + 停用逆序
```

| 场景 | 处置 |
|---|---|
| 依赖缺失 | 拒绝安装，提示缺失 id/版本区间 |
| 版本冲突（同一插件被两个父要求不同主版本） | 拒绝，提示冲突链；不自动升级 |
| 依赖被停用 | **级联停用**依赖方（先停父后停子？——按逆拓扑：先停最上层依赖者） |
| 依赖升级 | 需先停依赖方 → 升被依赖方 → 再启依赖方（或整组原子升级） |

### 7.4 生命周期（分阶段发布与补偿，非跨资源原子事务）

| 阶段 | 动作 | 失败处置 |
|---|---|---|
| `resolve` | 解析描述符 + 依赖图 + 拓扑排序 | 拒绝加载，记录原因 |
| `validate` | kernelApi / depends / requires / R5 / 签名 | 拒绝加载 |
| `load` | 建 `PluginClassLoader`（child-first：插件包优先；parent-first：`cube-kernel-api`、`jakarta.*`、`java.*`） | 关闭加载器 |
| `register` | **单事务**注册：Route + EntityMeta(域) + 菜单 + 权限位 + 作业 + ExtensionPoint | 逆序回滚全部注册 |
| `migrate` | 自动结构同步 → 脚本迁移 → 播种；按 §16.2 执行、记录与恢复 | 停止发布、逆序清理未发布的注册；数据库按恢复计划处理，不自动覆盖并发写入 |
| `start` | 创建插件专用 `AnnotationConfigApplicationContext`（parent = 主 ctx） | 销毁 ctx → unregister |
| `ready` | 健康检查（SPI 就位、路由可达、元数据版本一致） | 标记 degraded，告警 |
| `stop` | 停作业 → 关 SSE → 停路由（返回 503） | — |
| `unregister` | 逆序注销（作业→权限→菜单→元数据→路由） | — |
| `unload` | 关 ctx → `DisposableRegistry.releaseAll(pluginId)` → `ClassLoader.close()` | 记录泄漏告警 |

> **原子性边界**：内存注册表可通过快照切换实现单节点原子发布；DDL、种子、文件和多个节点不构成同一数据库事务。执行失败记录实际阶段与状态，按 §16.2 补偿或人工介入。

### 7.5 三级热更新（面向插件）

| 级别 | 能力 | 耗时 | 适用 | 默认 |
|---|---|---|---|---|
| **L1 热启用/停用** | 不重启，开关插件（路由/菜单/权限/作业全部生效/失效） | 秒级 | **系统插件启停、业务插件启停** | ✅ 生产默认 |
| **L2 热升级** | 同插件 in-place：`stop → unload → load(new) → start` | 秒~十秒 | 客户现场不停机修 bug / 加字段 | ✅ 生产可选（需开启 `plugin.hot-upgrade=true`） |
| **L3 滚动替换** | 集群逐节点替换插件版本 | 分钟级 | 大版本、有类库冲突、需回滚演练 | ✅ 生产兜底 |

**升级决策树**

```
需要变更插件？
 ├─ 仅启用/停用            → L1
 ├─ 同主版本内升级（1.2.0→1.2.1，加字段/修 bug）
 │     ├─ 单节点且能接受秒级中断 → L2
 │     └─ 多节点或需零中断       → L3
 └─ 跨主版本 / 依赖变更 / 内核 API 变更 → L3（强制）
```

**L2 的安全约束（必须满足才允许）**

- 插件无 `static` 非 final 字段（ArchUnit 已强制）
- 插件全部资源经 `DisposableRegistry` 创建
- 升级前 Kernel 记录快照（元数据 + 路由 + 菜单），失败自动回滚到上一版本
- 连续 L2 升级次数 > N（默认 20）时强制建议 L3（防 Metaspace 累积）

#### 7.5.1 生产级 L2 的硬性要求（D-07）

L2 要在生产启用，必须同时满足以下 8 条，缺一不可：

| # | 要求 | 说明 |
|---|---|---|
| H1 | **双版本并行装载** | new 先加载到独立 ClassLoader 并 `ready`，**成功后**才切流，old 再 unload；失败路径对业务零影响 |
| H2 | **快照与自动回滚** | 升级前快照（元数据/路由/菜单/权限/配置/插件包版本）；任一步失败自动回到旧 ClassLoader 与旧元数据 |
| H3 | **节点灰度** | 先 1 节点 → 观察 N 分钟（默认 5）→ 全量；观察期内可一键停止 |
| H4 | **泄漏哨兵** | 卸载后 60s 弱引用检测 ClassLoader 是否回收；未回收 → 告警 + 记录持有者栈 |
| H5 | **Metaspace 水位** | 超过阈值（默认 70%）拒绝新的 L2 升级，强制建议 L3 |
| H6 | **升级自检** | 前后各跑 `PluginSelfCheck`：元数据完整性、路由可达、权限位、迁移状态、依赖满足性 |
| H7 | **串行与互斥** | 同一插件升级加分布式锁（DB 行锁/Redis）；升级事件进审计 + 指标（次数/耗时/失败率） |
| H8 | **数据迁移约束** | L2 只允许**可回滚 DDL**（加列/加索引/加表）；破坏性变更（删列/改类型）**禁止走 L2**，强制 L3 + 人工窗口 |

**连续升级上限**：默认 20 次/进程；达到后 UI 明确提示"建议滚动重启"（防 Metaspace 长期累积）。

**验收 P-9~P-12**：双版本并行下切流失败自动回滚无业务中断；灰度期单节点异常不扩散；破坏性 DDL 被 L2 拒绝并给出 L3 指引；连续 20 次 L2 后 Metaspace 增长在阈值内。

### 7.6 停用语义（避免"停用就报错"）

| 动作 | 数据 | 路由 | 菜单 | 在途业务 | 可恢复 |
|---|---|---|---|---|---|
| `enable` | 保留 | 生效 | 显示 | 正常 | — |
| `disable` | 保留 | 返回 `503 + code=-5`（"插件已停用"） | **隐藏但配置保留** | 按策略（见下） | ✅ 一键恢复 |
| `uninstall` | **保留数据表**（不删） | 移除 | 移除 | 阻断 | ✅ 重装可接管 |
| `purge`（危险） | 删表/删数据 | — | — | — | ❌ 需二次确认 + 备份点 |

**在途业务策略**（按插件声明）：

| 策略 | 语义 | 适用 |
|---|---|---|
| `block` | 停用即阻断，在途实例不可操作 | 默认 |
| `readonly` | 只读，可查看不可推进 | workflow 停用前期 |
| `drain` | 允许在途完成，禁止新建 | workflow 计划停用 |

> `workflow` 停用默认 `drain`：先禁止新建，等实例清空后自动转 `readonly`。

### 7.7 菜单自动生成、权限位与前端资源（D-31）

**目标**：装一个插件菜单就有，不装就没有；**不需要管理员手工建菜单**，但管理员的手工调整也不能被下次启动冲掉。

#### 7.7.1 菜单来源（三级合成）

| 级 | 来源 | 内容 | 存储 |
|---|---|---|---|
| ① **生成层** | 描述符 `menus` + 控制器注解 `@CubeMenu(order, visible, icon, lastUpdate)`（等价 `MenuAttribute`） | 区域 / 控制器 / 动作三类菜单项，唯一键 `(pluginId, category, path)` | `menu` 表（`source=plugin`、`plugin_id`） |
| ② **管理员覆盖层** | 后台手工调整（改名、换图标、调排序、移位置、隐藏） | **只存与生成值的差异**，不复制整行 | `menu_override`（`key -> patch_json`） |
| ③ **用户个性化** | 收藏 / 常用 / 排序 | 按用户 | `user_profile`（已有） |

**合成规则**：生成层 → 应用覆盖层 → 应用用户层。覆盖层让"重新生成"变成幂等操作，**永不覆盖人工修改**。

#### 7.7.2 生成算法（差量、可回滚）

```
扫描插件域 → 收集 (controller, menuMeta) → 算出期望集合 E
现有集合 A（source=plugin 且 plugin_id=本插件）
新增 = E - A                     → insert（若同 key 存在软删项则恢复，覆盖层保留）
更新 = E ∩ A 且 lastUpdate 变化   → 只更新生成字段，不动覆盖字段
禁用 = A - E（且无子项依赖）      → 软删 enabled=0（不物理删，保留授权绑定）
```

| 规则 | 说明 |
|---|---|
| `lastUpdate` 语义 | 与 `MenuAttribute.LastUpdate` 一致：**声明变了才重建**，避免每次启动抖动 |
| 唯一键冲突 | 两个插件声明同 key → 保留先装者 + 启动告警 + 后台"菜单冲突"列表 |
| 缺失不删除 | 生成项消失时软删，权限位与角色绑定关系保留（对齐 §7.6） |
| 快照与回滚 | 每次生成写 `menu_snapshot`（hash + 差异摘要），支持一键回滚上一快照 |
| 手工菜单 | 管理员手工新建的菜单（`source=manual`）**不进入**生成流程 |
| 幂等 | 同一插件连续生成两次，第二次差异必须为 0（MENU-2 验收） |

#### 7.7.3 权限位自动注册

| 项 | 机制 |
|---|---|
| 声明 | 控制器注解（`EntityAuthorize` 等价）+ 描述符 `permissions` |
| 注册 | 生成菜单时同步 upsert 权限位（6 位：`Detail/Insert/Update/Delete/Approve/Export`），不破坏已有授权记录 |
| 校验 | 每请求按 `(pluginId, resource, action)` 计算；插件停用后保留数据但不参与校验 |
| 前端 | 仍由 `/Cube/MenuTree` 下发，未授权项不出现（前端零改动） |

#### 7.7.4 其他

| 项 | 机制 |
|---|---|
| 前端资源 | `/plugin-assets/{pluginId}/{version}/…`；内核静态资源处理器按启用状态路由 |
| 版本保留 | 卸载/升级后旧版本资源保留 **N 天（默认 7）**，防止已打开的浏览器页面 404 |
| 前端发现 | `/Cube/Site` / `/Cube/Plugins` 下发启用插件与资源清单（**纯增量**） |
| 审计 | 菜单生成 / 覆盖 / 回滚全部记审计（谁、哪个插件、差异摘要） |

#### 7.7.5 验收

| # | 用例 | 判定 |
|---|---|---|
| MENU-1 | 新装一个含 3 个控制器的插件 → 无人工操作，菜单树出现对应项且权限位可分配 | 通过 |
| MENU-2 | 同一插件重复启用/禁用 5 次 → 菜单无重复、无重排，差异为 0 | 通过 |
| MENU-3 | 管理员改名/排序/隐藏后升级插件（`lastUpdate` 变化）→ 覆盖字段保留、生成字段更新 | 通过 |
| MENU-4 | 停用插件 → 菜单消失但角色授权保留；重新启用 → 原授权直接生效 | 通过 |

### 7.8 数据迁移与结构同步（D-38）

> **v4.3.4 重构**：原 §7.8 只有"脚本迁移"，把"加一个字段"也变成人工写 DDL —— 与 XCode/Cube 的现状体验完全相反（.NET 侧改完 Model.xml 重启即生效）。本节按"自动为主、脚本为辅"重排：**结构同步是默认路径，脚本只承接自动表达不了的变更**。

#### 7.8.1 自动结构同步（`SchemaSync`，对齐 XCode 反向工程）

**触发点**：插件 `install` / `update`（生命周期 `migrate` 阶段）、内核启动、管理员点"检查结构"、切库后的空库初始化（§5.11.5）。**部署与开发人员全程无感**——不跑脚本、不手工建表。

```
Model.xml ──解析──► EntityMeta ──推导──► IDataTable(model)   ← 期望结构（含列/索引/类型/默认值/注释）
                                                    │  比对
数据库    ──正向──► IDataTable(db)                    ← 实际结构（正向工程：读 information_schema / 系统表）
                                                    ▼
                                    差异集（AddTable/AddColumn/AlterColumn/DropColumn/AddIndex/DropIndex）
                                                    │  按 Migration 档位过滤
                                                    ▼
                        备份点 ──► 生成并逐项执行 DDL ──► 记录步骤状态并重新比对
```

**四档 Migration（与 XCode 逐条等价，含"表级只能收紧"）**

| 模式 | 建库 | 建表 | 加列 | 改列 | 删列 | 加索引 | 删索引 | 适用 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `Off` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 生产（结构由 DBA 统一管） |
| `ReadOnly` | 📝 | 📝 | 📝 | 📝 | 📝 | 📝 | 📝 | 生产（只出 SQL 与差异报告） |
| `On`（**默认**） | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | 常规：只增不删，安全 |
| `Full` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 开发/新装 |

- **表级覆盖只能收紧**：`<Table Migration="ReadOnly">` 可把全局 `Full` 收紧为只读；反向（全局 `On`、表级 `Full`）**不生效**并记 WARN。
- DDL 能力面：`CreateDatabase / DatabaseExist / CreateTable / DropTable / AddTableDescription / AddColumn / AlterColumn / DropColumn / AddColumnDescription / CreateIndex / DropIndex`（与 XCode `DbMetaData` 同集合）。

- **先备份再改结构**（`cube.schema.backup-before-alter=true` 默认）：SQLite 用 `VACUUM INTO`，其余走逻辑备份或厂商工具；备份失败 → 中止并告警（不冒险改结构）。
- **审计**：每次同步记一条"连接名 / 插件 / 版本 / 执行的 DDL 条数 / 结果 / 耗时"，进审计日志与 `cube_schema_history`。
- **差异报告**：`GET /api/Cube/Diag/SchemaDiff?conn=...`（对应 Cube 现有 `DbController.SchemaDiff/SchemaTables/SchemaEntities` 三个只读端点）+ `mvn cube:ddl-diff` 命令行，输出"库多出来的列/实体多出来的列"双向差异。
- **大表护栏**：`AlterColumn`/`DropColumn` 在表行数超过阈值（`cube.schema.max-rows-for-alter`，默认 100 万）时**拒绝自动执行**，转为生成"在线变更建议单"（各库语法不同：PG `ADD COLUMN ... DEFAULT` 无重写、MySQL 8 `ALGORITHM=INSTANT`、达梦/金仓需评估），避免一次重启锁表几十分钟。
- **不自动做的三件事**（明确边界）：①**数据回填**（新增列的历史值计算）②**破坏性重构**（拆表、改主键、类型有损转换）③**跨库数据搬迁**（换库不等于搬数据，见 §5.11.5）。这三类一律走 §7.8.2 脚本 + 人工确认。

**配置映射（照抄 XCode `XCode.json` / `appsettings.json` 的 `XCode` 节，键名与默认值对齐 `XCode/Setting.cs`）**

| XCode `Setting` | 默认 | Java 键 | 说明 |
|---|---|---|---|
| `Migration` | `On` | `cube.schema.migration` | `off`/`readonly`/`on`/`full`（四档，见上表） |
| `ShowSQL` | `true` | `cube.db.show-sql` | 生产关；`sql-path` 非空时 SQL 单独落盘 |
| `SQLPath` | `""` | `cube.db.sql-path` | 慢 SQL / 全量 SQL 目录 |
| `TraceSQLTime` | `1000` | `cube.db.slow-sql-ms` | 慢 SQL 阈值（§13.3） |
| `SQLMaxLength` | `4096` | `cube.db.sql-max-length` | 日志里 SQL 截断长度 |
| `CommandTimeout` | `0` | `cube.db.command-timeout` | 秒；0 = 不限 |
| `RetryOnFailure` | `0` | `cube.db.retry-on-failure` | 失败重试次数 |
| `BatchSize` / `BatchInterval` | `5000` / `100` | `cube.db.batch-size` / `cube.db.batch-interval-ms` | 批量写参数（与 §5.17 配合） |
| `CheckComment` / `CheckAddIndex` / `CheckDeleteIndex` / `CheckDuplicateIndex` | `true` | `cube.schema.check-*` | 结构比对细项开关（误报多时按项关） |
| `NameFormat` | `Default` | `cube.schema.name-format` | 列名命名格式（`default`/`upper`/`lower`/`underline`） |
| `FullCountFloor` | `1000000` | `cube.db.full-count-floor` | 超阈值才用"总数缓存/估算"分页优化 |
| `DataCacheExpire` / `EntityCacheExpire` / `SingleCacheExpire` / `FieldCacheExpire` | `0`/`10`/`10`/`3600` | `cube.cache.*` | 缓存 TTL（§5.5） |

> **唯一不保留的开关**：`UseParameter`。XCode 默认 `false`（SQL 拼接）是为了老库兼容；Java 侧**恒为参数化**，不提供关闭开关——安全优先，且 `PreparedStatement` 计划缓存本就是性能收益。

**方言覆盖**：6 个 `DbProvider` 各自实现 `ddlCreate/alter/drop` 与"列是否已存在"的判定；SQLite 的 `ALTER` 能力弱（不能改列约束、不能删列以外的大改），`AlterColumn` 在 SQLite 上降级为"建新表 → 拷数据 → 改名"三步并在**执行前要求显式确认**（dev 环境自动，生产需 `Full` + 确认开关）。

**验收**

| # | 用例 | 判定 |
|---|---|---|
| SCHEMA-1 | Model.xml 加一个字段 → 重启（`On`）→ 库中列存在、实体读写正常、**无需任何 SQL** | 通过 |
| SCHEMA-2 | 删字段（`On`）→ 不执行删列、只记差异；切 `Full` 才删 | 通过 |
| SCHEMA-3 | 表级 `ReadOnly` + 全局 `Full` → 该表只出 SQL 不执行；反向配置被拒并 WARN | 通过 |
| SCHEMA-4 | 6 库各跑一次"新建库 + 全量建表" → 结构等价（`ddl-diff` 无差异），失败时备份点可恢复 | 通过（国产库交付前实测） |

#### 7.8.2 脚本迁移（自动表达不了时的补位）

| 项 | 方案 |
|---|---|
| 迁移来源 | 插件包 `db/migration/{version}/*.sql` 或 Liquibase changelog（**仅这两类，不做隐式脚本**） |
| 升级顺序 | ①备份点 → ②`SchemaSync`（§7.8.1，自动）→ ③**脚本**（数据回填/重构）→ ④播种（§5.11.5）→ ⑤插件 `start` |
| 不可逆 DDL | 删列/改类型 → 需人工确认 + **双版本兼容期**（旧插件仍能读新表结构） |
| 降级 | 仅支持"加列式"变更回退；破坏性变更要求先备份 + 明确不支持自动降级 |
| 脚本规范 | 必须幂等（`IF NOT EXISTS` / 存在性判断）；单脚本 ≤1 个逻辑变更；带 `-- @description` 头；禁止 `DROP TABLE`（除插件卸载的特批） |
| 与 `SchemaSync` 的冲突 | 脚本执行后**再跑一次**结构比对，若仍有差异 → 告警（说明模型与脚本不一致，二者必须收敛） |

### 7.9 授权插件（D-09：到期降级只读）

| 项 | 设计 |
|---|---|
| 授权载体 | 签名许可证文件（JWT 或 JSON+签名），绑定客户标识 / 到期时间 / 节点数 / 模块列表 |
| 校验点 | 启动 + 每日定时 + 写操作前（轻量缓存判定，避免每请求查库） |
| **到期行为** | 进入 **`readOnly` 模式**：①拒绝 `POST/PUT/PATCH/DELETE/import`，返回 `code=-8` + `message="授权已到期，系统处于只读模式"`；②允许 `GET` / 导出 / 登录 / 审计查询 / 诊断；③`/Cube/Site` 增加 `licenseState` 字段（**纯增量**，旧前端忽略无影响） |
| **宽限期** | **默认 30 天**（D-22）：到期后 30 天内仍全功能，每日告警；第 31 天起转 `readOnly`。天数可配（`cube.license.grace-days`，默认 30） |
| 模块级授权 | 未授权插件在安装/启用阶段被拒；已运行的可降级为停用 |
| 离线激活 | 支持离线申请 → 签发 → 导入（内网必需） |
| 防篡改 | 签名校验 + 时钟回拨检测（记录告警，不硬阻断，避免误伤） |
| 审计 | 授权变更、降级事件、拒绝的写请求均记审计 |

> **为什么只读而不是停机**：私有化场景下停机可能导致客户业务中断与数据丢失；只读能在保护商业利益的同时保住"可查看、可导出、可迁移"的基本能力。

### 7.10 卸载纪律（防类加载器泄漏，必做清单）

| 泄漏源 | 纪律 |
|---|---|
| 线程池 | 必须 `DisposableRegistry.newExecutor(pluginId, …)`；ArchUnit 禁 `Executors` / `new Thread(` |
| 定时任务 | 经 `cube-kernel-job` 注册，key 带 pluginId，卸载统一取消 |
| 缓存 | 经 `DisposableRegistry.newCache(...)` |
| SSE / 长连接 | 经 `SseRegistry`，卸载主动 close |
| 静态字段 | ArchUnit 禁插件类出现 `static` 非 final 字段 |
| ThreadLocal | 禁插件自建；统一 `RequestContext` |
| JDBC/事务 | 禁插件持有；只经内核 |
| TCCL | 线程创建时绑定插件 TCCL，卸载时恢复 |
| 监听器/回调 | 注册时返回 `AutoCloseable`，必须登记 |
| 泄漏检测 | `WeakReference` 哨兵：卸载后 N 秒若 ClassLoader 未回收 → 告警 + 记录持有者栈 |

### 7.11 安全

| 项 | 措施 |
|---|---|
| 来源可信 | 仅允许**签名**插件包；未签名仅 dev；公钥内置/可配 |
| 权限声明 | `permissions` 落地为权限位，启用时校验与既有授权不冲突 |
| SQL 越权 | 插件只能经 `Filters`/`GenericRepository`，ArchUnit 禁裸 JDBC |
| 资源限额 | 每插件独立线程池（带名称前缀）、独立 Caffeine 实例、可选 CPU/内存观测 |
| 审计 | 安装/启用/停用/升级/卸载/DDL 全量审计（谁、何时、版本、结果） |
| 内核保护 | 插件不得反射修改内核内部状态（SecurityManager 已废弃 → 用 JPMS 封装 + ArchUnit + 代码评审三重） |

### 7.12 系统升级：在线（默认）/ 离线双模（D-40，P1）

> **v4.3.4 修订**：原节只有离线升级，但私有化客户的**常态是在线**（能出网就用在线，出不了网才用离线）。两者共用同一套"校验 → 备份 → 执行 → 回滚"骨架，**只是传输通道不同**，因此代码路径必须合一（避免"离线能回滚、在线不能"的双标）。

#### 7.12.1 共同底座（两种模式都走这条流水线）

```
候选版本（在线清单 / 离线包）
 → ①解析清单：内核版本范围 / 插件依赖图 / 冲突声明
 → ②版本兼容矩阵校验：当前内核版本 ≥ min-kernel、已装插件版本、目标库方言支持
 → ③签名与完整性：包签名（公钥内置/可配）+ SHA256 逐文件校验
 → ④dry-run 演练（可强制）：输出将执行的 install/update/DDL/stop-start 动作清单
 → ⑤备份点：库结构 + 插件状态快照（§7.4）
 → ⑥执行：结构同步（§7.8.1）→ 脚本（§7.8.2）→ 插件加载（L2/L3）→ 健康检查
 → ⑦失败处置：按兼容性矩阵回切应用；不可安全回切时停写、告警并人工恢复（§16.2）
 → ⑧审计：谁、何时、从哪个版本到哪个版本、结果、耗时
```

**内核自身升级的边界（必须说清）**：`cube-kernel-*` **不能热替换自己**。内核补丁级（同 minor）可走"重启装载"，内核大版本走**旁路切换**（新版本二进制 + 同结构兼容期 + 灰度节点 + 回切），由运维在升级窗口执行；插件层仍可 L1/L2/L3（§7.5）。

#### 7.12.2 在线升级（**默认**）

| 项 | 设计 |
|---|---|
| 更新源 | `cube.upgrade.source`（HTTPS，默认官方源；支持私有 Nexus/制品库/自建 HTTP 目录），只允许**白名单域名**（防 SSRF / 供应链劫持） |
| 清单 | `manifest.json`：内核版本 + 插件版本 + 依赖 + 校验和 + 签名 + 变更说明 + 最低兼容内核 |
| 通道 | `cube.upgrade.channel = stable \| beta`（默认 `stable`）；`dev` 环境允许 `snapshot` |
| 检查时机 | 启动后延迟检查 + 每日定时（`cube.upgrade.check-cron`）；**只检查不自动装**，除非显式开 `cube.upgrade.auto-apply=true` |
| 灰度 | 集群按节点分批（`canary-nodes=1` 先行），健康检查通过再推进；异常自动停批并回滚该批 |
| 传输 | 支持 Range 断点续传 + 包级续传（内网慢链路）；下载失败不影响当前运行版本 |
| 离线降级 | 探测不到更新源（内网）→ **自动提示"改用离线包"**并给出导出/导入入口，而不是报错刷屏 |
| 窗口 | `cube.upgrade.window = "02:00-04:00"`（可选）；窗口外只允许手动触发 |
| 许可 | 更新源**不含**授权信息；授权仍按 §7.9 的许可证文件独立管理（商业授权不得随更新包下发） |

#### 7.12.3 离线升级（无外网客户）

```
┌────────────┐   导出   ┌──────────────┐  U盘/内网  ┌────────────┐
│ 研发构建机  │ ───────► │ upgrade-*.zip │ ────────► │ 客户现场    │
│ cube:package│          │ (插件+依赖清单│           │ 后台上传导入 │
└────────────┘          │  +SHA256+签名)│           └────────────┘
                        └──────────────┘                  │
                                                  ┌───────▼────────┐
                                                  │ 与在线同一流水线 │
                                                  │ ④~⑧（dry-run/  │
                                                  │ 备份/回滚/审计） │
                                                  └────────────────┘
```

- 升级包内附**依赖清单 + 校验和 + 变更说明 + 回滚脚本**
- 导入前同样做"版本兼容矩阵"校验，与在线模式**同一份代码**
- 支持"演练模式"（dry-run）：只校验不执行，输出将要执行的动作清单
- 允许离线包**只带部分插件**（客户只买了某几个模块），清单里声明即可

**验收**

| # | 用例 | 判定 |
|---|---|---|
| UP-1 | 在线源可达 → 检查到新版本、dry-run 输出正确、执行成功、审计有记录 | 通过 |
| UP-2 | 升级中途注入失败：可回切变更恢复旧版本；不可逆或兼容性未知时停止推进并告警，不自动覆盖生产数据 | 预期通过 |
| UP-3 | 无外网环境 → 不报错刷屏，提示改离线包；导入离线包后走同一流水线成功 | 通过 |
| UP-4 | 签名被篡改/清单 hash 不符 → **拒绝执行**并告警（不进入 dry-run） | 通过 |
| UP-5 | 集群 3 节点灰度：1 节点先行，健康检查失败则停批且其余节点不受影响 | 通过 |

### 7.13 集群一致性（非 SaaS 常见 1~3 节点）

| 项 | 方案 |
|---|---|
| 插件清单源 | `cube_plugin_state`（pluginId/version/enabled/mandatory/updated_at） |
| 广播通道 | **默认：DB 事件表轮询（无额外依赖，最简）**；可选 Nacos 监听 / MQ |
| 节点状态 | `cube_plugin_node_state`（nodeId/pluginId/version/state/last_seen） |
| 不一致处置 | 后台展示 + 告警；提供"一键收敛"（下发指令让节点对齐到目标版本） |
| 单节点部署 | 强制走同一代码路径（不另开分支），保证行为一致 |
| 升级互斥 | 同一插件的升级操作加分布式锁（DB 行锁即可） |

### 7.14 CubeDemo 作为插件示范集（D-32）

现状（本地实测）：

- `CubeDemo/Areas/School`：学生 / 班级 / 交易 三个实体（各自 `.cs` + `.Biz.cs` + `Model` + `Interface`）、`StudentController` / `ClassController`、**自定义控制器 `AbcController`**、**配置控制器 `TestConfigController`**；
- `CubeDemo/Areas/Test`：`测试字段` + `测试枚举`（偏配置型）。

规划（每个 demo 都是一个可独立装卸的插件包）：

| 插件包 | 类型 | 内容 | 验证点 |
|---|---|---|---|
| `demo-school` | business-code | 学生/班级/交易（Model.xml + Biz + 生成控制器）+ `AbcController`（自定义控制器）+ `TestConfigController`（配置控制器） | 代码型插件、会话内自定义路由、ConfigController、跨实体关联 |
| `demo-test` | business-config | 测试字段 + 测试枚举（仅 Model.xml） | 纯配置型插件：零代码上线、`itemType` 透传、枚举字典 |
| `demo-workflow` | business-config | 一个示例审批流（BPMN + 表单绑定） | 工作流插件与业务实体联动（§7.15） |

| 约束 | 说明 |
|---|---|
| 非核心能力一律插件化 | 平台自身只留内核 + `admin`/`perm` 强制插件；`storage`/`file`/`notify`/`workflow`/`ai`/`widget`/`job-*`/`license` 全部可装卸，CubeDemo 的演示内容同理 |
| **拆除验证** | 删掉全部 `demo-*` 插件后平台必须能启动并完成核心流程（登录 / 菜单 / CRUD / 导入导出），重装后恢复 → 验收 P-13 |
| 依赖方向 | `demo-*` 只能依赖系统插件暴露的 ExtensionPoint；**系统插件不得反向依赖 demo**（R5 门禁） |
| 用途 | 既是验收样板，也是业务方"照着抄"的最小样例（建议每个插件包 ≤ 15 个文件） |

### 7.15 工作流插件（Flowable + flowgram.ai，D-29）

#### 7.15.1 引擎与许可

| 项 | 结论 |
|---|---|
| 引擎 | **Flowable 7.x**（Apache-2.0，可商用分发）；嵌入式部署，与内核同进程（L 档可拆为卫星服务） |
| 存储 | Flowable 自带 `ACT_*` 表；同库或独立 `ConnName` 由配置决定 |
| 异步执行器 | 用 Spring `TaskExecutor`，**不引入外部调度组件**；需要"到点触发"的超时任务由 K15 统一触发（§5.13） |
| 前端画布 | **flowgram.ai**（MIT）；它是"自由节点流程画布"，**不是 BPMN 编辑器**（见 7.15.4） |

#### 7.15.2 现有 Cube Workflow 语义必须保留（29 个文件）

| 现状能力 | Flowable 落点 | 迁移要求 |
|---|---|---|
| 流程定义（节点/审批人/条件） | BPMN 2.0 `ProcessDefinition` | `cube-migrate` 转 BPMN；不支持的形态**显式报错**，不静默降级 |
| 流程实例（发起/撤销/终止） | `RuntimeService.startProcessInstance…` / `deleteProcessInstance` | 端点与信封不变 |
| 审批任务（通过/驳回/转办/加签/撤回） | `TaskService.complete` + 自定义 `TaskListener` | **动作语义逐条对齐**（尤其"驳回到指定节点"） |
| 超时处理（pass/reject/transfer） | Boundary Timer Event + K15 触发 | 现有 `WorkflowTimeoutJob` 逻辑平移 |
| 表单字段权限（可见/可写/必填） | `TaskForm` + 平台 `FormFields` 覆盖 | 仍由 `/meta` 下发，前端不改 |
| 写拦截器（审批中禁改） | `WorkflowWriteInterceptor` 等价（实体 Hook） | 审批中的实体写操作必须继续被拦截 |
| 抄送 / 通知 | `notify` 插件的 ExtensionPoint | 走插件间事件，不直接依赖 |

**实体升级原则**：`流程定义` / `流程实例` / `审批任务` / `审批记录` 的**对外视图保持**（前端字段不变）；底层写 Flowable `ACT_*` 表 + 平台扩展表（`wf_ext_*`），通过视图或字段映射对齐，对外端点不变。

#### 7.15.3 停用与在途

沿用 §7.6：`workflow` 停用默认 `drain`（先禁新建 → 在途可推进 → 清空后自动 `readonly`）；Flowable 的异步 Job 在停用时挂起（`suspendProcessDefinition`）。

#### 7.15.4 flowgram.ai 与 BPMN 的差距（必须显式处理）

| 项 | 设计 |
|---|---|
| 节点集受限 | 只开放 7 类：开始 / 审批 / 条件分支 / 并行分支 / 会签 / 抄送 / 结束（**脚本节点禁用**，避免执行任意代码） |
| 编译器 | `FlowGraph → BPMN2 XML` 由服务端编译 + 校验；`BPMN2 → FlowGraph` 仅用于回显（只读，允许提示信息缺失） |
| 不支持的 BPMN | 事件子流程、补偿、复杂网关组合、多实例边界事件——画布不提供；导入外部 BPMN 时**显式拒绝并列出原因** |
| 校验 | 编译前检查：孤立节点、无出口分支、缺默认流、审批人为空、环路 |
| 版本 | 定义发布即版本化，运行中实例绑定旧版本（Flowable 原生能力） |

> 取舍：**宁可画布窄，不可"保存成功但引擎跑不对"**。复杂编排走"导入 BPMN + 只读回显"，或由插件自定义控制器实现。

#### 7.15.5 验收

| # | 用例 | 判定 |
|---|---|---|
| WF-1 | 现有流程定义迁移为 BPMN 后，同一批审批用例逐节点对比 .NET 版 | 一致 |
| WF-2 | 驳回 / 转办 / 加签 / 撤回 / 超时（pass/reject/transfer）语义一致 | 通过 |
| WF-3 | 审批中实体写操作被拦截；审批完成后恢复 | 通过 |
| WF-4 | flowgram 画布：7 类节点可画、可编译、可发布；非法图被拒并给出原因 | 通过 |
| WF-5 | 停用 `workflow`（drain）：不可新建、在途可完成、清空后转只读 | 通过 |

---

## 8. 认证 / 权限 / 租户内核（K6）

### 8.1 三元关系

| 机制 | 现状 | Java 等价 |
|---|---|---|
| Cookie Authentication（Scheme `Cube`） | MVC 浏览器会话，Cookie `token-{系统名}` | Spring Security 自建 Filter（Cookie 名可配） |
| JWT（`UserToken`） | API 的 `accessToken + refreshToken`，DB 持久化可吊销 | Nimbus JOSE+JWT / jjwt + 令牌表 |
| SSO/OAuth | 外部 IDP → 本地用户 + 本地令牌 | **`sso` 系统插件**（Spring Security OAuth2 Client / 自研授权码服务端），内核只保留登录会话与令牌判定（§8.5） |

### 8.2 令牌契约（前端硬依赖）

- 请求头 `Authorization: <裸 JWT>`（**无 Bearer 前缀**，禁用默认 Bearer 解析）
- 来源优先级：`Authorization` → `X-Token` → `?token=` → `?jwtToken=` → Cookie（按配置）
- 只接受三段式 JWT
- Refresh 轮换：旧 refresh 立即失效并进黑名单（TTL = 剩余寿命）
- 吊销：令牌表 `Enable=false` / 按用户批量吊销
- RSA Challenge：**显式 `OAEPParameterSpec("SHA-256","MGF1",MGF1ParameterSpec.SHA256,"")`**（Java 默认 MGF1 用 SHA-1，会静默失败）；`challengeId` 一次性 + 300s TTL
- MFA：`code=-1` + `message="mfa_required:{mfaToken}"`；`/Mfa/Verify` 校验 TOTP

### 8.3 菜单与权限位

```
User → UserRole → Role → RoleMenu → Menu(含功能位)
权限位：Detail=1, Insert=2, Update=4, Delete=8, Approve=16, Export=32
```
- 菜单树裁剪：合并多角色权限 → 按访问位/功能位过滤 → **保留必要父级目录**
- `/Cube/MenuTree?module=Admin` 与 `/Auth/Info` 为前端动态路由与页面发现的必要接口
- 菜单来源 = 内核菜单 + 各启用插件的声明式菜单（`cube-plugin.json.menus`）

### 8.4 租户

- 定位顺序：`X-Tenant`（租户 **Code**）→ `tenantId` 参数 → 租户 Cookie → JWT/OAuth 上下文
- 无效显式租户 → `400`；对象级接口必须同时校验数据归属 + 租户归属（fail-closed）
- 写入自动填充租户 ID；管理员/非租户模式按配置绕过
- 上下文：`ThreadLocal` + 异步/线程池用 `TransmittableThreadLocal`（JDK 21 下 `ScopedValue` 仍为预览）

### 8.5 认证域的系统插件切分：`sso` / `auth-third` / `usercenter`（D-37 延伸）

> 依据 Cube 现状实测：`Controllers/{SsoController,MfaController,AuthController}.cs`、`Services/Auth/*`（`ISsoClientService`/`ISsoServerService`/`IOAuthAppService`/`IUserBindingService`/`ITokenService`/`IUserInfoProvider`/`ILoginCallback`）、实体 `OAuth配置`/`OAuth日志`/`用户令牌`/`用户链接`/`委托代理`/`用户在线`/`用户统计`/`访问规则`/`短信配置`/`邮件配置`、`Areas/Admin` 下 27 个控制器。**结论：内核只留"最小认证 + 授权判定"，其余全部插件化**——否则每个客户都要带着微信/钉钉 SDK 与短信通道跑。

| 归属 | 承载 | 必需性 | 说明 |
|---|---|---|---|
| **内核** `cube-kernel-security` | 本地账号口令登录、令牌签发/校验（Cookie `token-{系统名}` + JWT 裸 token）、权限位与菜单裁剪、数据权限、租户上下文 | **必需** | 令牌契约见 §8.2，**永不外置**（前端硬依赖） |
| **`sso` 插件** | OAuth2.0 **客户端**（微信/钉钉/企微/标准 OIDC）+ **服务端**（授权码、密码式、凭证式、刷新令牌）+ 账号绑定/自动注册 + `OAuth配置`/`OAuth日志` | 系统插件（可停） | Cube 注释明确：**禁用本地登录 + 只配一个第三方登录 = 单点登录**；停用后只剩本地登录 |
| **`auth-third` 插件** | 短信/邮件验证码、图形验证码、TOTP MFA、RSA Challenge、登录失败锁定与风控、`短信配置`/`邮件配置` | 系统插件（可停） | 对应 `MfaController` + `ITotpMfaService`/`ISmsVerifyCode`/`IMailVerifyCode`/`ICaptchaService` |
| **`usercenter` 插件** | 用户中心：用户/角色/部门/租户/租户关系/用户链接/在线/统计/委托代理/访问规则 | 系统插件（可停） | 对应 `Areas/Admin` 的 27 个控制器；停用后平台仅保留内核管理员账号集合 |

**拆分的四条纪律**

| 纪律 | 内容 |
|---|---|
| 依赖方向 | `sso` / `auth-third` / `usercenter` → `cube-kernel-security`（单向）；内核**不得**反向依赖任何插件 → ArchUnit 强制 |
| 登录链可组合 | 内核定义 `LoginHandler` SPI：本地口令 / OAuth 回调 / 短信码 / 扫码，按已启用插件**动态装配**登录页选项（`/Auth/Info` 的 `loginTypes` 为纯增量字段，旧前端忽略无影响） |
| 绑定语义 | 第三方身份 ↔ 本地用户经 `用户链接（UserConnect）` 绑定；无绑定时走"已登录则绑当前用户 / 否则按配置自动注册"（与 Cube 现状一致，禁止改成静默新建重复账号） |
| 停用语义 | 停 `sso` → 已签发的 JWT 仍有效直到过期（不强制踢人，避免客户误操作全站掉线），但登录页不再提供第三方入口；停 `usercenter` → 组织相关接口 404，账号口令登录仍可用 |
| 安全基线 | OAuth `client_secret` 加密存储（`IsSystem` 参数或专用字段）；`state`/`nonce` 必校验，公开客户端强制 **PKCE**；回调域名白名单；令牌与验证码**一律不得进日志**（`/OAuth日志` 只记结果与耗时） |

**验收**

| # | 用例 | 判定 |
|---|---|---|
| AUTH-P-1 | 只装内核（三个插件全停）→ 本地口令登录 + CRUD + 权限判定正常 | 通过 |
| AUTH-P-2 | 开 `sso` 且禁用本地登录 + 仅 1 个第三方 → 直接跳转该 IDP（单点登录），未绑定用户走绑定/自动注册 | 通过 |
| AUTH-P-3 | 开 `auth-third` → 短信码登录 + MFA 二次验证；停用后 MFA 用户按策略（拒绝或降级）且提示可读 | 通过 |
| AUTH-P-4 | 停 `usercenter` → 组织/角色接口 404，管理员账号仍可登录；重新启用后数据无丢失 | 通过 |

---

## 9. 工程结构与依赖治理（G2）

### 9.1 Maven 多模块

```
newlife-cube-java/
├── pom.xml
├── cube-bom/                        # 唯一版本源
├── cube-kernel/
│   ├── cube-kernel-api              # 只暴露 SPI + DTO（插件唯一直接依赖）
│   ├── cube-kernel-meta
│   ├── cube-kernel-dsl
│   ├── cube-kernel-codegen
│   ├── cube-kernel-data
│   ├── cube-kernel-web
│   ├── cube-kernel-security
│   ├── cube-kernel-plugin
│   ├── cube-kernel-i18n
│   ├── cube-kernel-view       # 展现层契约（视图/查询/仪表盘/工作台配置 + Widget 聚合）
│   ├── cube-kernel-automation      # 自动化引擎
│   ├── cube-kernel-obs             # 可观测与诊断
│   └── cube-kernel-cluster         # 拆分就绪（本地/远程双派发）
├── cube-starters/
│   ├── cube-boot-starter            # ★ 插件唯一依赖
│   └── cube-test-starter            # 契约测试/切片测试基座
├── cube-plugins/                    # 系统插件
│   ├── cube-plugin-admin   cube-plugin-perm     cube-plugin-file
│   ├── cube-plugin-notify  cube-plugin-workflow cube-plugin-ai
│   ├── cube-plugin-job     cube-plugin-widget   cube-plugin-license
│   └── cube-plugin-diagnostics      # 内置诊断/排障（客户现场无 APM 也能用）
├── cube-app/                        # 宿主薄壳（main + 配置 + 打包 + 离线包构建）
└── cube-contract/                   # 契约基线（OpenAPI + 运行时样本 + 比对器）
```

### 9.1.1 环境档案：dev / test / prod（D-24）

不区分"交付态/自用态"，统一用 Spring Profiles 三套档案：

| Profile | 用途 | 关键差异 |
|---|---|---|
| `dev` | 本地开发 | 内嵌 SQLite/H2；`ShowSQL` 开；缓存可关；插件热部署开；Trace=`otlp`(本地) 或 `none` |
| `test` | 集成/契约测试 | `CubeDemo + SQLite`；契约样本回放；L2 热升级开启；MQ=`db` |
| `prod` | 客户生产 | 客户数据库 + 客户 MQ（`rabbitmq`/`rocketmq`）；缓存按硬件配置；Trace=`skywalking` 或 `none`；审计落库 |

**统一约束**
- 三套档案**共用同一二进制**，差异只在 `application-{profile}.yml` 与外部配置
- 启动期做**配置 Schema 校验**（缺失必填项直接失败）+ **环境差异白名单**（哪些键允许跨环境不同）
- 生产配置变更记审计（谁、何时、改了哪个键——**不记录值本身**，避免泄露）

### 9.2 业务插件的最小 pom

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>com.newlifex.cube</groupId>
      <artifactId>cube-bom</artifactId>
      <version>${cube.version}</version>
      <type>pom</type><scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <!-- 唯一依赖：内核 API + 运行时 + 默认装配 -->
  <dependency>
    <groupId>com.newlifex.cube</groupId>
    <artifactId>cube-boot-starter</artifactId>
  </dependency>
  <dependency>
    <groupId>com.newlifex.cube</groupId>
    <artifactId>cube-test-starter</artifactId>
    <scope>test</scope>
  </dependency>
</dependencies>
```

**业务方手写文件只有三类**：`Model.xml`、`XxxBiz.java`、少量自定义 Controller/Service（可选）。

### 9.3 依赖治理门禁（ArchUnit）

| 规则 | 断言 |
|---|---|
| A1 | 插件不得依赖其他插件（除自身） |
| A2 | 插件不得依赖 `org.mybatis..`/`com.baomidou..`/`com.github.benmanes..`/`com.fasterxml.jackson..` |
| A3 | `..kernel.internal..` 不得被插件引用 |
| A4 | 插件不得使用 `Executors.` / `new Thread(` / `static` 非 final 字段 |
| A5 | 生成物不得包含业务分支（`if` 层数 ≤ 2） |
| A6 | 每个插件必须有 `cube-plugin.json`，且 `requires` ⊆ 内核已提供 SPI |
| A7 | **系统插件不得依赖 `business-*` 类型插件**（R5） |
| A8 | 插件不得持有 JDBC 连接/事务/`DataSource` |

---

## 10. 技术选型与许可证矩阵（**非 SaaS 场景重新评估**）

### 10.1 判定基准的变更

**v1 的判定基准**：按"是否需要 SaaS 合规"判定。
**v2 的判定基准**：**是否向客户交付二进制/镜像（分发）**。三种交付形态：

| 形态 | 说明 | 许可义务 |
|---|---|---|
| **D1 内部自用** | 只在自己组织内运行，不向第三方交付二进制 | 无分发 ⇒ GPL/AGPL 均**不产生**义务（内部使用属"私用"） |
| **D2 私有化交付**（本平台默认） | 客户现场安装，交付镜像/安装包 | **构成分发** ⇒ GPL 传染对内嵌库有效；AGPL 义务仅限于该组件自身（提供源码），不改源码则可用 |
| **D3 SaaS** | 已排除 | — |

> **本方案按 D2 判定**（私有化交付为主，部分客户可能仅内部自用 D1）。若某项目确认只做 D1，下表 ❌ 项可放宽为 ⚠️。

### 10.2 重新判定结果对照

| 组件 | 许可 | D1 内部自用 | **D2 私有化交付** | v1 判定 | 结论变化 |
|---|---|---|---|---|---|
| **XXL-Job**（`xxl-job-core` 内嵌 JAR） | GPL-3.0 | ✅ 可用 | ❌ **不可内嵌**（分发即传染）→ **改为协议兼容插件** | ❌ | 方式变更（D-27） |
| **MinIO**（独立进程，S3 协议） | AGPL-3.0 | ✅ | ✅ **采用**（独立进程 + 不改源码 + 提供源码指引） | ❌ | **放宽为采用**（D-28） |
| **Redis 8.x** | RSALv2 / SSPLv1 / **AGPLv3** 三选一 | ✅ | ✅ **可用**（平台只做客户端；AGPL 分支需随包提供源码指引） | ❌ | **放宽** |
| **Redis ≤7.2 / Valkey** | BSD-3 | ✅ | ✅ 可用（交付首选） | — | 新增说明 |
| **Flowable 7.x** | Apache-2.0 | ✅ | ✅ 可用 | — | **新增采用**（D-29） |
| **flowgram.ai** | MIT | ✅ | ✅ 可用 | — | **新增采用**（D-29） |
| **NewLife.AntJob**（移植为 Java） | MIT（自有） | ✅ | ✅ 可用 | — | **新增采用**（D-26） |
| **Elasticsearch** | SSPL/ELv2 | ✅ | ✅ **可用**（非 SaaS 不触发 SSPL 核心条款） | ❌ | **放宽** |
| **Grafana** | AGPL-3.0 | ✅ | ⚠️ 可用（独立进程 + 提供源码） | ❌ | **放宽** |
| **MySQL Connector/J** | GPL-2.0+FOSS | ✅ | ❌ **不可**（分发需商业许可） | ❌ | 不变 |
| **Camunda 8** | 专有 | ❌ | ❌（需商业许可） | ❌ | 不变 |
| **达梦 / 金仓 / 海量 JDBC** | 厂商专有 | ⚠️ | ⚠️ 随项目商业许可分发（见 §10.6） | — | 新增说明 |

### 10.3 ✅ 采用清单（D2 私有化交付安全）

| 领域 | 组件 | 许可 |
|---|---|---|
| 应用框架 | Spring Boot 3.5.x / Spring Security / Spring Cloud Alibaba 2025.0 | Apache-2.0 |
| 配置中心 | Nacos 3.0.3（**可选**，单机可只用本地配置） | Apache-2.0 |
| 调度 | **内核 K15（自研）** + AntJob 移植（MIT）/ XXL-Job 协议插件（无 GPL 依赖） | MIT / 自研 |
| 数据访问 | MyBatis-Plus / ShardingSphere | Apache-2.0 |
| 迁移 | Liquibase / Flyway Community | Apache-2.0 |
| 本地缓存 | Caffeine | Apache-2.0 |
| 分布式缓存 | **Redis**（客户端 Lettuce / Spring Data Redis）；服务端 Redis 8.x、Redis ≤7.2 或 Valkey 均可 | Apache-2.0 / BSD-3 |
| 插件 | **PF4J** | Apache-2.0 |
| Excel / Office | FastExcel / Apache POI | Apache-2.0 |
| JSON / JWT | Jackson / Nimbus JOSE+JWT | Apache-2.0 |
| 认证 | Spring Security / Sa-Token（可选） | Apache-2.0 |
| OpenAPI | springdoc-openapi | Apache-2.0 |
| AI | **Spring AI 1.1.2**（核心）+ **Spring AI Alibaba 1.1.2.2**（可选编排）；LangChain4j 备选但不引入 | Apache-2.0 |
| 工作流 | **Flowable 7.x**（引擎）+ **flowgram.ai**（画布） | Apache-2.0 / MIT |
| 文件存储 | 本地 / NAS / **S3 兼容**（MinIO、阿里云 OSS、腾讯 COS、七牛 Kodo、华为 OBS）；备用 SeaweedFS | AGPL-3.0（MinIO，独立进程）/ 厂商协议 / Apache-2.0 |
| 可观测 | OpenTelemetry / Micrometer / 本地落盘 / SkyWalking（可选） | Apache-2.0 |
| 代码生成 | JavaPoet / FreeMarker | Apache-2.0 |
| XML 绑定 | Jakarta XML Binding 4.x | EPL-2.0 或 GPL-2.0+CPE |
| 测试 | JUnit 5 / Testcontainers / ArchUnit / REST Assured | EPL-2.0 / MIT / Apache-2.0 / Apache-2.0 |
| 驱动 | pgjdbc（BSD-2）、mssql-jdbc（MIT）、MariaDB Connector/J（LGPL-2.1） | — |
| 消息客户端 | Kafka client / RocketMQ client / ActiveMQ client | Apache-2.0 |
| 消息客户端 | RabbitMQ Java client | ⚠️ 需按锁定版本核验（MPL-2.0 / Apache-2.0 双许可） |
| APM | **SkyWalking**（Agent + OAP） | Apache-2.0 |
| 连接池 | HikariCP / Druid（可选） | Apache-2.0 |
| 应用服务器 | 内嵌 Tomcat（默认）/ 可选 Undertow | Apache-2.0 |

### 10.4 ❌ 仍然禁用（D2 分发下不可用）

| 组件 | 原因 | 替代 |
|---|---|---|
| **XXL-Job（`xxl-job-core` 内嵌）** | GPL-3.0 内嵌 JAR ⇒ 分发即传染 | **自研协议兼容执行器** `job-xxl`（不引依赖）；D1 内部自用可切官方实现 |
| **MySQL Connector/J** | GPL-2.0+FOSS，分发需 Oracle 商业许可 | MariaDB Connector/J（LGPL-2.1） |
| **Camunda 8** | 专有，需商业许可 | Flowable |

### 10.5 ⚠️ 可用但建议替代（D2 放宽项）

| 组件 | 放宽理由 | 仍建议替代为 | 替代理由 |
|---|---|---|---|
| MinIO（AGPL-3.0） | 独立进程 + 不改源码 ⇒ 义务仅覆盖自身；**按需求采用** | 备用 SeaweedFS（Apache-2.0） | 客户要求纯 Apache 栈时替换 |
| Redis 8.x（RSALv2/SSPL/AGPL） | 非 SaaS 不触发核心限制；平台只做客户端 | 交付优先 Redis ≤7.2 或 Valkey（BSD-3） | 免源码提供义务，协议完全兼容 |
| Elasticsearch（SSPL） | 非 SaaS 可用 | OpenSearch（Apache-2.0） | 无许可顾虑 |
| Grafana（AGPL） | 独立进程 + 提供源码 | SkyWalking UI / 自建看板 | 减少合规文档负担 |

> **合规产出物**：私有化交付需随包提供《第三方组件清单 + 许可证声明 + 源码获取指引》（SBOM）。CI 用 `license-maven-plugin` 生成，随发布物一并交付。

### 10.6 ⚠️ 需采购/法务确认

达梦 DM JDBC、人大金仓 KingBase JDBC、海量 VastBase JDBC（厂商专有驱动，须随商业许可分发）；GraalVM Native（GPLv2+CE 可用，但与插件热加载互斥，**不建议**）。

---

## 11. 契约门禁与验收

### 11.1 三层验证

| 层 | 工具 | 输入 | 判定 |
|---|---|---|---|
| **L1 静态契约** | springdoc-openapi（Java 产出）+ 自研递归 diff | .NET 基线 `CubeDemo/contracts/openapi/*.json`（358/463/211，只读） | path/method/schema 缺失或签名变更即失败 |
| **L2 运行时样本** | 录制/回放比对器（REST Assured + Jackson 结构化 diff，忽略 `traceId`/时间/随机 ID） | 登录、`/Auth/Info`、`/Cube/MenuTree`、`/meta`（中/英双语）、列表/详情、导出响应头 | 字段集/顺序/取值规则完全一致 |
| **L3 端到端** | Playwright（**仅 ArcoVue**）+ REST Assured | `CubeDemo + SQLite`，baseURL 指向 Java | 交互路径全绿（其余 SPA/MVC 主题不在验收范围，D-25） |

### 11.2 插件专项验收（新增）

| # | 用例 | 判定 |
|---|---|---|
| P-1 | 装/卸业务插件，前端菜单即时出现/消失，无 404 残留 | 通过 |
| P-2 | 停用系统插件（file/notify/ai），依赖它的业务插件**级联停用**并提示 | 通过 |
| P-3 | 停用 workflow（`drain` 策略）→ 在途实例可完成、不可新建 | 通过 |
| P-4 | L2 热升级（1.2.0→1.2.1 加字段）后无重启，`/meta` 立即含新字段，**结构自动同步完成（无人工 DDL）** | 通过 |
| P-5 | 升级失败自动回滚到上一版本，元数据/路由/菜单元整 | 通过 |
| P-6 | 连续 20 次 L2 升级后 Metaspace 无持续增长（弱引用哨兵验证） | 通过 |
| P-7 | **在线升级**（有源可达）+ **离线升级包导入**（无外网）+ dry-run 演练 + 实际执行，两条通道结果一致 | 通过 |
| P-8 | 两节点集群：一节点装插件，另一节点在轮询周期内收敛 | 通过 |
| P-13 | 删除全部 `demo-*` 插件后平台仍可启动并完成核心流程；重装后恢复（D-32） | 通过 |

### 11.3 门禁时机

| 时机 | 门禁 |
|---|---|
| 每次 PR | L1 + 单测 + ArchUnit（A1~A8） |
| 每日 | L2 关键样本回放 |
| 阶段出口 | L2 全量 + L3 + 插件专项（P-1~P-8） |
| 上线前 | 三层全绿 + 灰度对比（错误率、P99、慢 SQL） |

---

### 11.4 展现层 / 可观测专项验收（新增）

**展现层（Z-1~Z-7）**

| # | 用例 | 判定 |
|---|---|---|
| Z-1 | 七视图配置往返：`PUT/GET /Cube/ViewProfile` 保存 `ViewsJson`（table/tree/card/kanban/calendar/gantt/map + 列/排序/chrome）后原样返回，前端可切换渲染 | 通过 |
| Z-2 | 保存查询：`QueriesJson` v2 往返；`viewFilter` 可翻译条件下推（SQL 口径与 .NET 一致）、不可翻译时整段放弃下推且不 500；`sorts` ≤3 列白名单，非法 400 | 通过 |
| Z-3 | 条件填色：`ViewsJson.colors` **原样存取**（≤50 条、不改写不裁剪）；前端刷新后规则生效；**后端无求值逻辑** | 通过 |
| Z-4 | 多级分组：前端 ≤3 级组头行 + 可折叠正常；筛选/排序下推正确；**后端不实现分组聚合**（防"复刻变重写"） | 通过 |
| Z-5 | 洞察面板：`POST /Cube/Widget/Query` 的 count/sum/avg/min/max/**group** 与 .NET 逐值比对一致；带数据权限与租户条件；不可翻译筛选返回 **400** | 通过 |
| Z-6 | 工作台：`HomeJson` > 主角色 > 系统 三层读取正确；命名工作台发布自动挂菜单且 `Sort` 顶置；个人布局不串用户 | 通过 |
| Z-7 | 自动化：GraphJson 触发 → 动作执行 → 运行历史可查；重复事件被幂等键去重；未知/预留节点类型**失败并停止** | 通过 |

**可观测（D-1~D-6）**

| # | 用例 | 判定 |
|---|---|---|
| D-1 | 任一次 API 调用在信封中返回 `traceId`，且与日志 MDC、审计记录一致 | 通过 |
| D-2 | 入站携带 `traceparent` 时沿用上游 TraceId；出站调用注入 `traceparent` | 通过 |
| D-3 | 超过阈值的 SQL 进入慢 SQL 日志与聚合表，参数已脱敏 | 通过 |
| D-4 | 诊断面板：链路检索/慢接口 TOP/错误聚合/JVM 概览 全部可用，且需权限 | 通过 |
| D-5 | 关掉全部外部 APM 后，内置诊断仍可独立定位一次人为注入的故障 | 通过 |
| D-6 | 默认配置下开启观测后，吞吐下降 < 5% | 通过 |

### 11.5 v4.3 新增专项验收（索引）

| 专项 | 用例 | 所在章节 |
|---|---|---|
| 调度 | JOB-1~JOB-6（Cron 语义等价 / 双节点互斥 / 插件停用 / XXL 联调 / AntJob 切片） | §5.13.8 |
| 文件存储 | FILE-1~FILE-4（三 provider / 大文件流式 / 插件停用 / 对账） | §5.14.4 |
| 数据库 | DB-1a / DB-1b / DB-2~DB-4（收敛为 6 库） | §5.11.4 |
| 菜单 | MENU-1~MENU-4（自动生成 / 覆盖保留 / 幂等 / 停用保留授权） | §7.7.5 |
| 工作流 | WF-1~WF-5（Flowable 语义等价 / flowgram 编译） | §7.15.5 |
| 缓存 | CACHE-1~CACHE-4 | 下表 |
| **分库分表** | SHARD-1~SHARD-7（区间推导 / 条件裁剪 / 缺范围抛错 / AutoShard 分页 / 批量分组 / 历史分片 / 懒建表） | §5.7.10 |
| **雪花 ID** | ID-1~ID-4（百万无重复 / workerId 唯一 / 时钟回拨 / 大表不缓存） | §5.7.10 |
| **AI 就绪** | AI-1~AI-7（SSE 契约 / 动态工具与权限 / MCP / 模型热切换 / 离线 / 配额审计 / 失败降级） | §5.15.7 |
| **结构同步** | SCHEMA-1~SCHEMA-4（加列零脚本 / `On` 不删列 / 表级只能收紧 / 6 库结构等价） | §7.8.1 |
| **首次运行与初始化** | INIT-1~INIT-4（零配置起 SQLite / 新库播种幂等 / 切库结构等价 / 播种失败回滚） | §5.11.5 |
| **参数中心** | PARAM-1~PARAM-3（存量兼容 / 四级作用域 / 域级失效 + 系统项只读） | §5.16 |
| **升级** | UP-1~UP-5（在线成功 / 失败回滚 / 无外网降级离线 / 签名拒绝 / 集群灰度） | §7.12 |
| **异步读写** | ASYNC-1~ASYNC-3（afterCommit / 背压 15s / 批次隔离） | §5.17 |
| **认证插件化** | AUTH-P-1~AUTH-P-4（只装内核 / 单点登录 / MFA / 停 usercenter） | §8.5 |
| 插件化拆除 | P-13 | §11.2 |

**缓存（CACHE-1~CACHE-4）**

| # | 用例 | 判定 |
|---|---|---|
| CACHE-1 | `shared.provider=none` 单机：无 Redis 也能完成登录 + CRUD + 导出 | 通过 |
| CACHE-2 | 两节点 + Redis：A 节点改数据，B 节点在广播/TTL 后读到新值，无长期脏读 | 通过 |
| CACHE-3 | 停掉 Redis：`fallback=degrade` 触发告警、L1 TTL 降到 ≤30s、令牌/权限状态不残留 | 通过 |
| CACHE-4 | 插件卸载后其 L1 缓存实例被释放（配合 P-6 无 ClassLoader 泄漏） | 通过 |

## 12. 迁移切片与平台产物

| 阶段 | 周期 | 平台产物 | 业务产物 | 出口门禁 |
|---|---|---|---|---|
| **P0 契约冻结** | 2~3 周 | `cube-contract` 骨架；录制器 | — | 基线全绿（358/463/211） |
| **P1 内核最小闭环 + 可观测骨架** | 8~10 周 | K1/K2/K4/K5；生成器 MVP（单表）；通用 CRUD + `/meta`；**`cube-kernel-obs` 骨架：TraceId/JSON 日志/慢 SQL/health/指标端点**；**K16 `cube-kernel-ai` 骨架：ToolRegistry + AiContext + MCP server + SSE 契约基座（§5.15）** | `CubeDemo` 1~2 实体用 Model.xml 重建 | 单实体 `/meta` + CRUD 逐字段 diff = 0；**D-1/D-3 通过**；**`/mcp` 能列出 1 个实体的工具** |
| **P2 插件域 + 展现层 + 自助配置对象 + 调度/存储** | 14~16 周 | K7（依赖图/生命周期/L1 启停/离线包）；**K9 展现层**；**§12.2 的 11 类对象与端点**；K14 双派发骨架；**DB 配置式切换（6 库）**；**分库分表 + 雪花 ID + 读写分离（§5.7）**；**MQ 可配置**；**K15 调度内核 + 菜单自动生成（§7.7）**；**L1+L2 缓存（§5.5）**；**`SchemaSync` 自动结构同步 + 首次运行自动建库建表与播种（§7.8.1/§5.11.5）**；**`Parameter` 参数中心（§5.16）**；**异步批写队列（§5.17）**；**`sso`/`auth-third`/`usercenter` 插件骨架（§8.5）**；**`storage` 插件（本地/NAS/MinIO/OSS）**；**`ai` 插件骨架（模型配置热切换 + `/Ai/AiChat` 占位 + `AiChatLog`）**；导入导出；i18n | `admin`/`perm`/`file`/`storage` 插件化迁移；`demo-school`/`demo-test` 插件化 | `/Auth/*`、`/Cube/*` 全绿；P-1/P-2；**Z-1~Z-5**；**DB-1a / DB-2~DB-4 / MQ-1~MQ-3**；**SHARD-1~7 / ID-1~4**；**JOB-1~JOB-4 / MENU-1~MENU-4 / CACHE-1~CACHE-4 / FILE-1~FILE-3**；**SCHEMA-1~4 / INIT-1~4 / PARAM-1~3 / ASYNC-1~3** |
| **P3 生产级热升级 + 工作流 + 调度插件 + 自动化 + 诊断** | 14~16 周 | **L2 生产硬化（§7.5.1 H1~H8）**；K10 自动化；K10' 看板/工作台；**诊断插件 + 告警 + 日志双落点**；集群广播；`license`（到期只读）；**`workflow`（Flowable + flowgram，§7.15）**；**`job-ant`（AntJob 迁移，§5.13.5）**；`job-xxl`（协议兼容）；**在线/离线双模升级（§7.12）**；notify/widget | `workflow` / `job-ant` / `job-xxl` / `notify` / `widget` 插件化；CubeDemo 拆为 `demo-*` 插件集 | P-3~P-13；**Z-6/Z-7**；**D-2/D-4~D-9**；**JOB-5~JOB-6 / WF-1~WF-5 / FILE-4**；**UP-1~UP-5 / AUTH-P-1~AUTH-P-4** |
| **P4 AI + 拆分验证 + 切流** | 8~10 周 | **`ai` 插件完整（Spring AI 1.1.2 + MCP + SSE 契约 + 本地模型 Ollama/vLLM + 权限裁剪 + 配额审计 + 可选 `/mcp` 对外）**；**L 档拆分演练（ai / job-ant / storage 拆为卫星服务）** | `AiController` 全套 | 灰度期错误率/P99 达标；拆分后 D-1/D-2 跨进程仍成立；回滚演练通过；**DB-1b（国产库实测）**；**AI-1~AI-7 全绿** |

> P0~P2 完成后**已有可交付价值**：新建业务仅写 Model.xml 即可打包为配置型插件上线，并自带视图/查询/洞察/工作台（填色与分组由前端提供，后端零引擎）与基础诊断。

### 12.2 自助配置界面的后端对象清单（D-12）

> 依据：`NewLife.Cube.ArcoVue/ArcoVue企业中后台迁移方案.md` 与前端实际调用点交叉核对。这些是**前端已依赖**的对象与端点，属于"必须实现"档，不是可选增强。

#### 12.2.1 对象清单（12 类）

| 对象 | 现有实体 | 关键字段 | 存储 | 隔离 | 后端职责 |
|---|---|---|---|---|---|
| **UserProfile** | `Entity/用户呈现配置.cs` | `ThemeJson` / `LayoutJson` / `WorkspaceJson` / `HomeJson` / `Version` | 表 | 按用户 | 壳层与首页配置读写、版本冲突检测 |
| **ViewProfile** | `Entity/视图配置.cs`（复核字段见 §5.9.5） | `UserId` / `TypePath` / `View` / `ColumnsJson` / `ViewsJson` / `ActiveViewId` / **`ActiveQueryId`** / `GanttJson` / `CardJson` / `FiltersJson` / **`QueriesJson`** / `PageSize` / `FormJson` / `DashboardJson` / `Version` | 表 | 用户；`UserId=0` 为模板 | 三层覆盖解析、模板发布、按 `typePath` 缓存（**注意：无 `Name`/`SortsJson` 字段，排序在 `ViewsJson[].sorts` 内**） |
| **EntityComment** | `Entity/实体评论.cs` | `Category` + `LinkId` 关联实体；`ParentId`/`RootId` 支持回复；`Content` | 表 | 按实体 + 权限 | 评论 CRUD、@提及 → 通知联动 |
| **EntityAutomation** | `Entity/实体自动化.cs` | `TypePath` / `Enable` / `TriggerConfig` / `GraphJson` / `Version` | 表 | 按实体 | 规则 CRUD、手动执行、运行历史 |
| **NotificationRecord / Inbox** | `Entity/通知记录.cs` | `UserId` / `Title` / `Content` / `ReadTime` / `Result` | 表 | 按接收用户 | Inbox 是投影：未读数、标记已读 |
| **Attachment** | `Entity/附件.cs` | `Title` / `FileName` / `Extension` / `Size` / `FilePath` / `ContentType` / `Enable` / `Storage` / `Hash` / `Key` | 表 + 存储 | 按关联对象 | 上传/下载/生命周期 |
| **Lov** | `Entity/Models/Lov*Model.cs`（多模型） | `Code` / 枚举项 / 列表配置 / 搜索字段 / 表格列 | 配置 | 按实体权限 | `Meta` / `ListData` / `BatchLabel` |
| **Log（审计）** | `Entity/应用日志.cs` | `Category`/`Action`/`Success`/`CreateUserID`/`CreateIP`/`CreateTime`/`Remark`/`TraceId`/`LinkId` | 表 | 按权限 | 查询、按 `TraceId` 跳诊断、字段差异展示 |
| **Widget** | 无独立实体（嵌在 Profile） | `widgetName` / `source` / `typePath` / `query` / `config` | Profile JSON | 继承所属配置 | `Sources`/`Catalog`/`Query`/`Data` 四个端点 |
| **Workbench** | `UserProfile.HomeJson` + `Parameter(Workbench.*)` | 12 栅格布局、命名工作台 `slug/title/homeJson`、角色 `LongValue` | 表 + Parameter | 用户 > 主角色 > 系统默认；**无租户层**（沿用现状） | 个人/命名/角色三层读取与保存 |
| **AI 配置** | `Parameter` | 模型、端点、开关 | Parameter | 按租户 | `/Cube/GetAiConfig`（不含密钥明文） |
| **Parameter（运行态参数中心）** | `XCode.Membership/字典参数.cs`（增强见 §5.16） | `UserID` / `Scope` / `Category` / `Name` / `Value` / `LongValue` / `Kind` / `Enable` / `Domain` / `Format` / `Version` / `IsSystem` / `Expire` | 表 | 用户 > 角色 > 租户 > 全局 | 批量读取 + 域级失效广播；承载**系统配置 / LOV / 共享查询 / 字典**四类（布局类配置仍归 `ViewProfile`） |

#### 12.2.2 端点清单（前端已依赖，必须实现）

| 方法 | 路径 | 对象 |
|---|---|---|
| GET/PUT | `/Cube/UserProfile` | UserProfile |
| GET/PUT/DELETE | `/Cube/ViewProfile`、`/Cube/ViewProfile/Template` | ViewProfile |
| GET/POST/DELETE | `/Cube/EntityComment` | EntityComment |
| GET/PUT | `/Cube/Workbench`；`/Cube/Workbench/Named/{slug}`；`/Cube/Workbench/Role/{id}` | Workbench |
| GET | `/Cube/Widget/Sources`、`/Cube/Widget/Catalog/{kind}` | Widget |
| POST | `/Cube/Widget/Query` | Widget 聚合查询 |
| GET/POST | `/Cube/Widget/Data/{name}` | Widget 数据 |
| GET/POST/PUT/DELETE | `/Cube/Automation`；`POST /Cube/Automation/Run`；`GET /Cube/Automation/Meta` | EntityAutomation |
| GET/POST | `/Cube/Automation/Inbox`、`/Inbox/UnreadCount`、`/Inbox/Read` | NotificationRecord |
| GET/POST | `/Admin/Lov/Meta`、`/ListData`、`/BatchLabel` | Lov |
| GET | `/Admin/Log` | Log |
| GET | `/Cube/GetAiConfig`、`/Cube/GetMapConfig` | Parameter |
| GET | `/Cube/Parameter/Batch?category=…&scope=…`（**批量**，供 `/meta` 与页面初始化一次取回） | Parameter（§5.16） |
| GET/POST/PUT/DELETE | `/Admin/Parameter`（系统配置/字典/共享查询管理，仅管理员） | Parameter |
| GET/POST | `/Admin/Upgrade/Check`、`/Admin/Upgrade/Apply`、`/Admin/Upgrade/Import`（在线检查/执行、离线包导入） | 升级（§7.12） |
| GET | `/Admin/Schema/Diff`、`/Admin/Schema/Sync`（只读差异报告 / 触发结构同步，`ReadOnly` 档只出 SQL） | `SchemaSync`（§7.8.1） |

> **契约红线**：`ViewProfile`/`Filters`/`Widget` 等**呈现层配置不能替代后端数据权限**。字段权限必须在**查询、写入、导出**三处对称强制；`X-Cube-Field-Validation` 只是协作信号，不是安全边界。

#### 12.2.3 能力边界（现状核对）

| 已有前端编辑器（可直接复用） | 尚无完整编辑器（后端补强或延后） |
|---|---|
| 命名视图（列/筛选/排序/分组/卡片/表单） | 字段级权限矩阵、数据范围编辑器 |
| Dashboard/Insight Widget（指标/图表/列表/KV/快捷链接） | AI 字段 Agent、会话历史 |
| 工作台（用户布局/角色默认/命名工作台） | 日历议程、画册布局 |
| 自动化编辑器（触发器/条件/动作图/运行） | 复杂 Widget 跨实体建模 |
| Lov 编辑器（枚举项/列表/搜索字段/表格列） | Log 字段 diff 结构化展示 |
| 评论 / 收件箱 / AI 浮窗 / 附件 / 主题与密度 | Attachment 完整生命周期界面、**Parameter 通用管理界面（系统配置/字典/共享查询）**、升级与结构差异界面 |

## 13. 可观测与诊断（G7，从第一天设计）

> **设计原则**：客户现场常常**没有 APM 平台、没有外网、没有专职运维**。因此可观测性必须"自带闭环"——内置诊断能力可独立工作，外部 APM 只是增强项。

### 13.1 `traceId` 契约（对齐现状 + 补齐标准）

| 项 | .NET 现状 | Java 要求 |
|---|---|---|
| 生成 | `DefaultSpan.Current?.TraceId`；无 Span 时通常不输出 | 无上游上下文时生成 32 位小写十六进制 TraceId + 8 字节 SpanId |
| 传播 | Stardust 接收端支持 W3C `traceparent`；Cube 侧未证实全入口解析 | **入站解析 `traceparent`**；出站 HTTP / MQ / RPC **注入 `traceparent`**；S/M/L 三档一致 |
| 响应信封 | `{code,message,data,traceId}` | **同名同格式**（字符串），不改变前端消费 |
| 日志 | `XTrace` + 文件 | MDC 固定键：`traceId`/`spanId`/`userId`/`tenantId`/`pluginId`/`route` |
| 审计 | `Log.TraceId` 可跳转 Stardust | 同字段；诊断面板可一键展开链路 |
| 错误模型 | `RequestId` 优先 TraceId，其次 `Activity.Id`，最后 `TraceIdentifier` | 统一取 TraceId；**不得把 SpanId 当 TraceId** |

### 13.2 三类信号

| 信号 | 实现 | 默认开销 | 开关 |
|---|---|---|---|
| **日志** | JSON 结构化 + 按天滚动 + 本地磁盘；ERROR/WARN 全量，INFO 采样，DEBUG 按包 | 低 | `cube.obs.log.level`、`cube.obs.log.sample` |
| **指标** | Micrometer：`http.server.requests`、DB 连接池、缓存命中、JVM(堆/GC/线程)、自动化队列深度、插件状态、慢 SQL 计数 | 低 | `/actuator/prometheus` 可选开启 |
| **追踪** | OpenTelemetry：HTTP / JDBC / 缓存 / 自动化 / MCP 自动埋点；采样策略 = 基线 1% + **错误全采** + **慢请求全采** | 中（可关） | `cube.obs.trace.sample`、`cube.obs.trace.enabled` |

#### 13.2.1 Trace Provider 可插拔（D-15）

```yaml
cube:
  obs:
    trace:
      provider: none        # none（默认）| skywalking | otlp
      sample: 0.01          # 基线采样率（错误/慢请求强制全采）
```

| provider | 行为 |
|---|---|
| **`none`（默认）** | **仍然生成 `traceId`**（32 位 hex）并写入响应信封与日志 MDC；**不创建 Span、不上报、不加载任何 Agent** |
| `skywalking` | SkyWalking Java Agent（`-javaagent`）或 OTel Bridge → 上报 SkyWalking OAP；Sw8/`traceparent` 传播 |
| `otlp` | OTel SDK → OTLP Collector（可再转 SkyWalking/Prometheus） |

> **关键设计**：**`traceId` 的生成 与 Span 上报解耦**。
> 原因：`traceId` 是**响应信封的硬契约**（前端与外部客户端已在消费），一旦"未配置 APM 就不给 traceId"就破坏契约。因此 `provider=none` 只关闭"追踪采集与上报"，不关闭"标识生成"。
> 这也让客户可以在不部署 APM 的情况下，依然通过 `traceId` 把**日志、审计、诊断面板**串起来。

#### 13.2.2 日志双落点（D-14，对齐 NewLife.Core 设计）

**对齐思路**：NewLife 用 `XTrace`（门面）+ `CompositeLog`（组合）+ `TextFileLog`/`NetworkLog`（Provider）+ 审计 `LogProvider`→`Log` 实体。Java 侧保持同一分层：

| 层 | NewLife | Java 对应 |
|---|---|---|
| 门面 | `XTrace` | SLF4J（`LoggerFactory`）+ 平台封装 `CubeLog` |
| 组合 | `CompositeLog` | Logback `AsyncAppender` + 多个 Appender |
| 文件落点 | `TextFileLog`（`MaxBytes`/`Backups`/按时间格式命名/UTF-8/异步队列） | Logback `RollingFileAppender` + `SizeAndTimeBasedRollingPolicy`，UTF-8，异步有界队列 |
| 数据库落点 | `LogProvider` → `Log` 实体 | 自研 `DbLogWriter`（异步批量 INSERT） |
| 审计门面 | `LogProvider.WriteLog` | `AuditService`（自动填充用户/IP/成功/字段差异/密码脱敏） |

**落点可配（D-23：保留期 / 尺寸 / 提供者全部配置化）**：

```yaml
cube:
  obs:
    log:
      sink: both            # file（仅硬盘）| db（仅数据库）| both（默认）
      path: ./logs          # 文件根目录（客户可指定到任意盘）
      pattern: "{app}/{node}/{level}"      # 目录分层
      max-bytes: 100        # 单文件上限 MB
      backups: 100          # 保留份数
      retention-days: 30    # 文件保留天数
      db:
        datasource: log     # 可独立数据源（可指向客户审计库）
        table: cube_log
        batch-size: 200
        queue-capacity: 20000
        retention-days: 180 # 审计保留期（按合同可配）
```

**为什么不用 Logback `DBAppender`**：字段模型固定（无法承载 `TraceId`/`LinkId`/租户/字段差异）、DDL 依赖特定数据库、通常同步写库易阻塞业务线程、跨客户库（达梦/金仓/海量）兼容差。

**自研 `DbLogWriter` 关键要求**

| 要求 | 说明 |
|---|---|
| 非阻塞 | 业务线程只入有界队列；队列满时**降级写本地补偿文件 + 告警**，绝不阻塞业务 |
| 批量 | 独立消费者批量 INSERT（默认 200/批），可配 |
| 重试 | 失败指数退避重试；最终失败落补偿文件（可回灌） |
| 字段 | 对齐 XCode `Log`：`Category/Action/Success/UserName/CreateUser/CreateUserID/CreateIP/CreateTime/Remark/TraceId/LinkID` + 租户 ID + 插件 ID |
| 索引 | `CreateTime`、`TraceId`、`(CreateUserID,CreateTime)`、`(Category,CreateTime)`（XCode 原有 3 个索引 + 上述 4 个） |
| 脱敏 | 密码/令牌字段固定打码；实体 `Sensitive` 字段在字段差异中打码 |
| 不可篡改 | 审计表仅允许 INSERT（应用层禁 UPDATE/DELETE；可选数据库权限/触发器加固） |
| 清理 | K15 调度按 `retention-days` 删除（审计保留期按合同，运行日志按容量） |
| **配置化** | **保留期、单文件尺寸、备份份数、目录格式、落点类型（`sink`）、审计表名与数据源、批量大小、队列容量全部可配**（D-23）；不做任何硬编码默认以外的假设，交付时按客户合同与硬件调整 |
| 双写语义 | **审计必落库**（可丢即告警+补偿）；运行日志默认只落盘（`sink=both` 时也写库但允许采样丢弃） |

**验收 D-7~D-9**：`sink=file` 时硬盘有滚动文件且 UTF-8 正确；`sink=db` 时审计落库且含 `traceId`/`LinkID`；DB 不可用时业务不受影响且补偿文件可回灌。

### 13.3 慢 SQL（等价 `TraceSQLTime`）

| 项 | 值 |
|---|---|
| 阈值 | `cube.obs.sql.traceMs`，默认 **1000ms**（对齐 XCode `TraceSQLTime`） |
| 落点 | ①专用 SQL 日志文件（等价 `SQLPath`）②可选 `cube_slow_sql` 表（供诊断面板 TOP N） |
| 记录字段 | 数据源、SQL（截断默认 4096，对齐 `SQLMaxLength`）、**参数摘要（脱敏）**、耗时、影响行数、`traceId`、路由、调用点、租户 |
| 全量 SQL | 默认关闭（对齐 `ShowSQL=false` 的生产建议）；仅 dev 或按请求采样开启 |

### 13.4 内置诊断插件 `cube-plugin-diagnostics`（核心交付物）

| 面板 | 内容 | 权限 |
|---|---|---|
| 链路检索 | 按 `traceId` / 时间 / 用户 / 路由检索，展示 Span 树与耗时瀑布 | `Detail` |
| 慢接口 TOP | 按 P50/P95/P99、错误率排序 | `Detail` |
| 错误聚合 | 按异常类型 + 调用点聚合计数，含首次/末次时间与样例栈 | `Detail` |
| 慢 SQL 排行 | TOP N + 采样明细 | `Detail` + 独立 `Diagnose` 位 |
| JVM 诊断 | 堆/GC/类加载/线程池/阻塞线程；线程 dump（需二次确认） | 独立 `Diagnose` 位 |
| 资源与连接 | 连接池、缓存命中率、磁盘、自动化队列 | `Detail` |
| 插件与元数据 | 插件状态/版本、元数据版本、节点一致性、离线包记录 | `Detail` |
| 审计查询 | 操作审计（含 `traceId` 跳转链路） | `Export` |

**实现要点**
- **复用现有 Admin 列表页 + Widget 组件**渲染，无额外前端开发（`/meta` + 通用 CRUD 已足够）
- 诊断数据来自 `cube-kernel-obs` 的本地环形缓冲 + 聚合表，**不依赖外部 APM**
- 故障自检清单（启动时 + 按需）：DB 连通、方言识别、迁移状态、缓存可用、插件清单一致、授权状态、时钟偏移

### 13.5 告警

| 项 | 设计 |
|---|---|
| 规则 | 阈值（如错误率 > 5%）、突增（如 5 分钟内 4xx 翻倍）、连续失败（如自动化连续 3 次失败）、心跳缺失 |
| 频控 | 去重 + 静默窗口 + 每日上限（对齐现有"每日最多一条"思路） |
| 渠道 | 站内信（默认）/ 邮件 / Webhook / 钉钉 / 企微 |
| 范围 | 租户级、节点级、插件级 |
| 处置 | 告警详情内直接给出"诊断入口"（跳对应面板） |

### 13.6 与外部平台对接（可选增强）

| 平台 | 接入方式 | 适用 |
|---|---|---|
| OpenTelemetry Collector | OTLP 导出 | 客户已有 OTel |
| SkyWalking | OTel / SkyWalking Agent | 客户已有 SkyWalking |
| Prometheus + Grafana | `/actuator/prometheus` | 客户有监控体系 |
| 无 | **内置诊断插件独立工作** | 多数私有化现场 |

### 13.7 合规与开销治理

- 默认低开销配置开箱即用（只对慢/错误全量采集）
- 全部诊断端点需权限位（含独立 `Diagnose` 位，默认仅管理员）
- 日志与审计中的敏感字段按实体 `Sensitive` 标记脱敏
- 保留策略可配（日志 7/30/90 天；审计按合同）
- 诊断面板自身的每一次访问都记审计（谁在何时看了什么）

## 14. Java 特有风险与对策

| # | 风险 | 后果 | 对策 |
|---|---|---|---|
| J1 | **ClassLoader 泄漏**（反复 L2） | Metaspace OOM | 连续升级次数上限 + 强制建议 L3 + 弱引用哨兵 |
| J2 | 线程未回收 | 内存/句柄累积 | 强制经 `DisposableRegistry`；ArchUnit 禁 `Executors` |
| J3 | ThreadLocal 上下文丢失 | 越权/串号 | `TransmittableThreadLocal` + 显式传参 |
| J4 | RSA-OAEP MGF1 默认 SHA-1 | 登录静默失败 | 显式 `OAEPParameterSpec` + 单测 |
| J5 | Spring Security 默认 Bearer | 全部 401 | 关闭默认 Bearer，自建裸 token 解析 |
| J6 | Long 序列化精度 | 前端错乱 | 全局 Long→String + `id/Id/ID` 兼容 |
| J7 | 反射与 AOT 冲突 | Native 不可行 | 不追求 Native；元数据编译期固化 |
| J8 | Boot 3.5 EOL | 安全补丁缺失 | 版本 pin + CVE 订阅 + Boot 4.x 路径 |
| J9 | 插件依赖冲突 | 启动失败 | child-first 加载 + 依赖白名单校验 |
| J10 | 元数据漂移 | 各节点行为不一致 | 域级版本 + 启动校验 + 一致性告警 |
| J11 | 停用插件残留路由/菜单 | 前端 404/空白 | 停用返 `503+code=-5`；菜单按启用集合裁剪（P-1） |
| J12 | 级联停用遗漏 | 半可用状态 | 依赖图逆拓扑停用（P-2） |
| **J13** | **"复刻"被做成"重写"**（额外做文件化 DSL / 服务端分组） | 工期失控、与前端已有实现重复 | v4.3.1：DSL 与服务端分组**默认不做**（D-34）；只在业务明确需要超大数据量分组时单独立项 |
| ~~J14~~ | ~~分组聚合与分页冲突~~ | — | **已撤销**（分组在前端，后端不做服务端聚合；Widget 聚合为独立端点） |
| **J15** | **筛选翻译偏差 / 假聚合** | 越权数据 / 数字不可信 | 只能编译为参数化 `Filters` + 白名单；**列表筛选不可翻译→整段放弃下推（前端兜底）**，**Widget 聚合不可翻译→400**；聚合仅五种函数 |
| **J16** | **自动化重复触发/风暴** | 数据被反复修改 | 幂等键 + 单规则并发上限 + 触发链深度上限（默认 3）+ 循环检测 |
| **J17** | **诊断开销与信息泄露** | 生产变慢 / 敏感信息外泄 | 默认低采样；诊断端点独立权限位；参数与字段脱敏；自身访问审计 |
| **J18** | **拆分后跨域一致性** | 数据不一致 | S8 规则（单域事务 + 事件补偿 + 幂等）；拆前必须有对应 P-9 演练 |

## 15. 附录

### 15.1 业务方视角的完整流程

```bash
# 1. 写模型（唯一必写文件）
vim src/main/cube/Order.xml

# 2. 生成（产出 6 个 Java 文件 + 元数据快照 + 文档 + DDL 草案）
mvn cube:generate

# 3. 需要业务逻辑时编辑 OrderBiz.java（不会被覆盖）
vim src/main/java/com/myapp/order/entity/OrderBiz.java

# 4. 打包为插件（.cube），含描述符/资源/迁移脚本
mvn clean package cube:package

# 5. 后台上传并热启用（无需重启）
curl -X POST /api/Cube/Plugin/Install -F file=@target/myapp-order.cube
curl -X POST /api/Cube/Plugin/myapp-order/enable
```

**纯配置型插件（无业务代码）**：只写 `Model.xml` + `cube-plugin.json`，`mvn cube:package -Dtype=config` 直接产出可导入包。

### 15.2 插件包树（示例）

```
myapp-order.cube
├── cube-plugin.json
│   {
│     "id": "myapp-order", "version": "1.2.0", "type": "business-code",
│     "kernelApi": "[1.0,2.0)",
│     "depends": [{ "id": "cube-plugin-admin", "version": "[1.0,)" }],
│     "requires": ["entity.registry","route.registry","security.permission"],
│     "models": ["Order.xml","OrderItem.xml"],
│     "menus": [{ "name":"订单管理","url":"/Order","icon":"fa-shopping-cart" }],
│     "permissions": [{ "code":"Order","bits":63 }],
│     "migrations": "db/migration/1.2.0"
│   }
├── lib/myapp-order.jar
├── model/{Order.xml, Order.json, OrderItem.xml, OrderItem.json}
├── db/migration/1.2.0/01-add-column.sql
├── i18n/messages_zh_CN.yml
└── META-INF/SIGNATURE
```

### 15.3 关键设计决策记录（ADR）

| ADR | 决策 | 理由 |
|---|---|---|
| ADR-01 | 元数据以**插件域**为键组织，非类型键 | 解除 XCode "类型静态缓存不可变"限制，且支持域级版本/灰度/契约比对 |
| ADR-02 | 单一 `EntityHandlerMapping` + 可增删 `RouteRegistry` | Spring 组件扫描的 Controller 无法卸载 |
| ADR-03 | **不给每个实体生成 Mapper**，用元数据驱动 SQL 引擎 | 运行期无法可靠动态添加 Mapper；同时覆盖 95% CRUD |
| ADR-04 | 分部类用"生成文件 + `@BizOf` 钩子类" | Java 无 partial，钩子类语义最接近 `.Biz.cs` |
| ADR-05 | **热插拔颗粒度 = 插件包**，不做单实体/单字段热注册 | 类加载隔离需同生共死；整包才能事务回滚；心智一致 |
| ADR-06 | 三级热更新，L1 生产默认、L2 可选、L3 兜底 | JVM 类卸载有泄漏风险，用 L1 覆盖多数诉求 |
| ADR-07 | 机制插件不得依赖业务插件（R5） | 保证系统插件可独立启停/升级 |
| ADR-08 | 业务只依赖 `cube-boot-starter` | 满足 G2，内核可独立演进 |
| ADR-09 | 配置型插件与代码型插件共用同一生命周期 | 不为"无代码"分裂第二套机制 |
| ADR-10 | 非 SaaS 下许可按"是否分发"判定，AGPL 独立进程可用 | 避免过度收紧导致的组件选择损失；合规义务用 SBOM 兜底 |
| ADR-11 | 集群一致性默认 DB 轮询，不强上 MQ/注册中心 | 非 SaaS 常见 1~3 节点，降低客户环境依赖 |
| ADR-12 | 单一 Model.xml + `cube:` 命名空间扩展承载展现配置 | 满足"只写 Model.xml"；物理模型保持 XCode 兼容可回迁 |
| ADR-13 | 列表筛选 / 保存查询 / 自动化条件 / Widget 过滤**共用同一筛选 schema**（`logic: all\|any` + `ops`，与前端 `matchesViewFilter` 同构） | 避免多套表达式漂移、安全边界只有一处；**填色与表格分组在前端求值，不参与**（v4.3.1 / D-34） |
| ADR-14 | 三档部署（S/M/L）同一二进制，只改配置与拓扑 | 小项目简单、大项目可拆；避免维护两套工程 |
| ADR-15 | 可观测从第一天纳入内核（TraceId 进信封） | 私有化现场无 APM 是常态；事后补埋点成本极高 |
| ADR-16 | 自动化用 DB 队列（SKIP LOCKED）而非内存/MQ | 无额外中间件依赖，多副本天然安全 |
| ADR-17 | **填色完全由前端求值**（v4.3.1 改判；原"后端下发 token"方案取消） | 现状规则存 `ViewsJson.colors`、前端计算样式（≤50 条单条件），后端不参与；仅保留"前端不用任意 CSS 注入"的实现约定 |
| ADR-18 | 调度是**内核能力**，外部调度系统只做协议插件 | 存量 `CronJob` 语义与数据必须无损；少一个客户侧中间件；规避 GPL 内嵌 |
| ADR-19 | Cron 解析**自研** `CubeCron`，不复用 `Spring CronExpression` | 现有语法含 `d#Lk`（倒数第 k 个星期）与 0=周日，Spring 不支持或语义不同 |
| ADR-20 | 存储抽 `ObjectStorage` SPI，MinIO/OSS 走 **S3 协议 + 独立进程** | 复用 Cube 已有 `S3ObjectStorage` 语义；AGPL 义务只覆盖 MinIO 自身 |
| ADR-21 | 菜单"**生成层 + 覆盖层 + 用户层**"三层合成 | 自动生成与人工调整并存，重装/升级不冲掉管理员配置 |
| ADR-22 | 工作流用 Flowable + flowgram，**受限节点集 + 服务端编译** | flowgram 不是 BPMN 编辑器；宁可画布窄，不可"保存成功但引擎跑不对" |
| ADR-23 | 缓存坚持 **L1 + L2 两级**（对齐 `ICacheProvider`） | 实体对象语义与多副本一致性是两个问题，压成一层必然牺牲其一 |

### 15.4 NewLife.Core 基础组件对照（迁移语义依据，D-30）

> 原则：**先读 NewLife.Core 的实现与 Doc，再定 Java 落点**。不是"凭印象重新设计一个类似物"，而是"确认原语义后找等价物或明确不复刻"。下表只列 Cube 实际消费的子集（与可行性篇 §5.2 一致）。

| NewLife.Core 组件 | 位置 | 核心语义 | Java 落点 | 处理方式 |
|---|---|---|---|---|
| `ICacheProvider` | `Caching/ICacheProvider.cs` | 两级缓存（`InnerCache` + `Cache`）+ 队列 + 分布式锁 | `CubeCacheProvider`（Caffeine + Redis）+ `CubeQueue` + `CubeLock` | **原样分层**（§5.5） |
| `ICache` / `MemoryCache` / `Cache` | `Caching/` | TTL、批量、计数、`AcquireLock` | Spring Cache 抽象 + `RedisTemplate` | 语义对齐，不追求 API 逐字相同 |
| `TimerX` | `Threading/TimerX.cs` | 轻量定时器（周期/对齐/异步/休眠） | `ScheduledExecutorService` / `TaskScheduler` | 仅 K15 内部控制用 |
| `Cron` | `Threading/Cron.cs` | 6 段 Cron（0=周日、`?`、`d#k`、`d#Lk`） | **自研 `CubeCron`** + 移植单测 | **必须自研**（ADR-19） |
| `IPlugin` | `Model/IPlugin.cs` | 插件宿主抽象（加载/卸载） | PF4J `Plugin` + 自研域管理 | 语义升级为"插件包"颗粒度（§7.0） |
| `ITracer` | `Log/ITracer.cs` | 链路追踪（Span/采样） | Micrometer Tracing → OpenTelemetry / SkyWalking | 可插拔，`none` 仍产 `traceId`（§13.2.1） |
| `EventBus` / `IEventBus` | `Messaging/` | 进程内/队列事件总线 | Spring `ApplicationEventPublisher` + `KernelBus` | 跨节点用 `KernelBus`（§5.12） |
| `DeferredQueue` | `Model/DeferredQueue.cs` | 延迟队列 + 批量合并写入 | `DelayQueue` / Redis ZSET + 批量落库 | 用于审计/日志异步批写（§13.2.2） |
| `ObjectContainer` | `Model/ObjectContainer.cs` | 轻量对象容器（DI 早期实现） | Spring `ApplicationContext` | 取代，不复刻 |
| `Host` | `Model/Host.cs` | 轻量应用主机（启动/停止） | Spring Boot | 取代，不复刻 |
| `Snowflake` | `Data/Snowflake.cs` | 雪花 ID（机器位/时间位可配） | 自研 `CubeId`（位分配置对齐） | 对齐位分配置，避免迁移后 ID 结构变化 |
| `TokenProvider` | `Web/TokenProvider.cs` | 分布式令牌（密钥环/跨节点校验） | 自研 JWT + Redis 令牌状态 | 令牌契约不变（§8.2） |
| `Config` / `IConfigProvider` | `Config/` | 多源配置（文件/命令行/注册中心） | Spring `Environment` + Nacos（可选） | 取代 |
| `ILog` / `XTrace` | `Log/` | 结构化日志 + 链路关联 | SLF4J + Logback + MDC | 格式与字段对齐 |
| `ApiHttpClient` | `Http/` | 增强 HTTP 客户端（DNS/重试/追踪） | `RestClient` + 拦截器 | 只保留 Cube 用到的能力 |

> **不逐条复刻的判断标准**：①Cube 是否实际用到（§5.2 已核对）②是否属于"平台语义"（如 Cron、令牌、雪花 ID → 必须等价）③是否只是实现手段（如 `ObjectContainer`、`Host` → 由框架取代）。

### 15.5 XCode 数据库层关键能力对照（分片 / 雪花 / 读写分离 / 结构同步 / 异步读写）

> 依据：`NewLife.XCode/XCode/Shards/*`、`XCode/Entity/{EntitySplit,Entity_Operate}.cs`、`XCode/Configuration/FieldItem.cs`、`XCode/Code/EntityBuilder.cs`、`NewLife.Core/Data/Snowflake.cs`，以及 `NewLife.XCode/Doc/` 下对应专题文档。**判据同上：先读实现再定落点。**

| XCode 能力 | 源码 / 文档 | 语义要点 | Java 落点 | 处理 |
|---|---|---|---|---|
| 分片路由 | `Shards/{ShardModel,IShardPolicy,TimeShardPolicy}.cs`；`Doc/{分片路由模型,Shards分配策略与路由}` | `shard(value)` / `shards(start,end)` / `shards(expression)`；ConnPolicy/TablePolicy/Step/Level | `ShardModel` + `ShardPolicy` + `TimeShardPolicy` | **必须等价**（§5.7.3） |
| 跨分片查询 | `Doc/{Shards跨分片查询与AutoShard,时间分片策略与范围裁剪}` | 自动/显式 AutoShard；跳过不存在表；单分片完整覆盖时裁剪条件；缺范围抛错 | `ShardService.autoShard(...)` | **必须等价**（§5.7.5） |
| 临时切换 | `Entity/EntitySplit.cs`；`Doc/分库分表临时切换` | 改工厂 `ConnName/TableName`，**并发会串库串表** | `ShardScope` / 独立 `EntitySession` | **不复刻该 API**（§5.7.7） |
| 数据规模 | `Configuration/FieldItem.cs`、`Code/EntityBuilder.cs` | `DataScale=time`（Int64 非自增主键 / InsertOnly 日志表首时间列）与 `timeShard:fmt`（生成策略 + Step） | 元数据属性 + 生成器规则；大表禁实体缓存 | **必须等价**（§5.7.4） |
| 雪花 ID | `NewLife.Core/Data/Snowflake.cs`；`Entity/Entity_Operate.cs` 的 `Snow` | 41/10/12、epoch 1970、workerId 默认 IP+进程+线程（不保证唯一）、`JoinCluster`、时钟回拨容忍 1h+10s | `SnowflakeId`（同布局 + Redis workerId + 回拨策略） | **必须等价**（§5.7.8） |
| 读写分离 | `Doc/读写分离策略（ReadWriteStrategy）` | 主名 + `{主名}Readonly` 自动关联；SELECT+无事务+非忽略时段+非忽略表才走从库 | `AbstractRoutingDataSource` + 同名约定 | **必须等价**（§5.7.9） |
| **结构同步（反向工程）** | `Doc/XCode数据模型与结构同步`；`DataAccessLayer/MetaData/DbMetaData_{Positive,Negative}.cs` | 正向：库→`IDataTable`；反向：模型→`IDataTable`→差异 DDL；四档 `Migration`（Off/ReadOnly/On/Full）+ 表级只能收紧；DDL 11 类操作 | `SchemaSync` + `DbProvider.ddl*`（§7.8.1） | **必须等价**（D-38） |
| **自动建库** | `DbMetaData` 的 `CreateDatabase/DatabaseExist` | 库不存在则建库（SQLite 即建文件） | `DbProvider.databaseExists/createDatabase` | **必须等价**（§5.11.5） |
| **初始化播种** | `Doc/数据初始化（InitData）.md` | 启动时按依赖顺序 `InitData`，幂等 | `SeedInitializer` + `cube_schema_history` | **必须等价**（§5.11.5） |
| **异步批写** | `Doc/实体队列异步批写（EntityQueue）.md`；`Entity/EntityQueue.cs`；`SaveAsync(delay)` | 近实时 + 延迟队列；周期 1000ms 自适应 500~5000ms；`MaxEntity` 背压最多等 15s；批量 ≤10000；`Dispose` 等 3s | `AsyncWriteQueue`（虚拟线程刷写器） | **等价 + 一条新硬规则**（§5.17：Java 必须 `afterCommit` 入队） |
| **异步查询** | 实体 `FindAllAsync/FindAsync` / `IDbSession` 异步方法 | 基于 Task 的异步 IO | 虚拟线程 + `CompletableFuture` + 超时 | **语义对齐，不引入 R2DBC**（§5.17.3） |
| **延迟队列** | `Model/DeferredQueue.cs` | 延迟 + 批量合并 | `DelayQueue` / Redis ZSET | 用于审计/日志（§13.2.2） |
| 连接池 | `Doc/数据库连接池（ConnectionPool）` | 按连接名维护池、超时/重试 | HikariCP | 由框架取代 |
| 连接串构造/脱敏 | `Doc/连接字符串构造与脱敏处理` | 构造 + 脱敏打印 | Hikari 配置 + 自研脱敏 | 由框架取代 |
| 配置中心连接串 | `Doc/配置中心DbConfigProvider` | 连接串存 Parameter 表，可热更新 + 本地缓存容灾 | Nacos / DB 配置（可选） | 可选增强 |
| 备份与跨库同步 | `Doc/数据备份恢复与跨库同步（DAL_Backup）` | 表备份/恢复、跨库同步 | 独立插件能力 | P3+ 可选 |

### 15.6 NewLife.AI → Spring AI / Spring AI Alibaba 能力对照（D-36）

> 依据：`NewLife.AI/Doc/{架构设计,MCP架构,功能清单,模型供应商多模态能力矩阵}.md`、`NewLife.Cube/AI/*`（18 个文件）、`alibaba/spring-ai-alibaba` 主仓 `pom.xml` + BOM + README、`spring-projects/spring-ai` 的 `starters/` 目录清单。**判据同上：先读实现再定落点。** 能力级评估见可行性篇 §9.8。

| NewLife.AI 模块（编码） | .NET 现状 | Java 落点 | 处理 |
|---|---|---|---|
| **AI** 服务商与协议（`AI-1a~1g`） | 46 家 `[AiClient]` 注册发现；OpenAI/Anthropic/Gemini/DashScope/Ollama/Bedrock 六协议 | Spring AI `spring-ai-starter-model-*`（openai/ollama/deepseek/anthropic/google-genai/mistral/bedrock） | **收敛到 3~6 家**，不做 46 家 |
| **AI** 统一接口与能力元数据（`AI-2a~2h`） | `IChatClient` 同步/流式、能力标记、`ToolChatClient`、Embedding/Rerank/视频/余额/语音 | `ChatClient`/`ChatModel` + Spring AI 多模态；Embedding + 向量库 | **覆盖**；Rerank/视频/余额**不复刻**（如需走 DashScope 可选 starter） |
| **AI** MCP（`AI-3x`） | 自研 MCP 客户端/服务端 | `spring-ai-starter-mcp-server-webmvc` + `spring-ai-starter-mcp-client(-webflux)` | **覆盖**（AIR-2 权限裁剪由 Cube 薄层加） |
| **CHAT** 对话与会话（`CHAT-*`） | WebUI、会话管理、消息展示、多模态交互 | `ai` 插件：`AiSession`/`AiMessage` + `/Ai/AiChat` SSE + 前端 AI 浮窗（ArcoVue 现有） | **等价复刻契约**；WebUI 由 ArcoVue 承担 |
| **TOOL** 技能/原生工具/Filter/注入（`TOOL-*`） | 技能包、`[Description]` 工具、`IChatFilter` 链、注入策略、数据库工具 | `@Tool` + `ToolCallbackProvider` + Advisor 链；技能 = 提示模板 + 工具白名单 | **覆盖**；技能包自研（薄） |
| **EVO** 用户记忆 10 类（`EVO-*`） | 10 类记忆自动提取与注入 | `ChatMemory` 只管消息窗口 → **自研记忆抽取** | **缺口**（P5 可选，不在 MVP） |
| **GW** API 网关（`GW-*`） | 多协议入站 + AppKey + 模型路由 + 用量 | 无对应 → 自研 `ai-gateway`（可选插件） | **缺口**（默认不做） |
| **IM** 渠道（`IM-*`） | 钉钉/企微/飞书/Webhook/Slack/Telegram | 无对应 | **不复刻** |
| **AGENT** 编排（`AGENT-*`） | Planner、多 Agent、反思、HITL | Spring AI Alibaba `graph-core` + `agent-framework`（Sequential/Parallel/Routing/Loop、持久化、流式、HITL） | **覆盖**（可选插件 `ai-graph`，P5+） |
| Studio / Admin 控制台 | 无（.NET 用管理页） | `spring-ai-alibaba-studio` 仅开发期；**不投产** | 不用（由 Cube 的 AI 配置页承担） |

**结论**：上述是候选映射而非替代性实证；核心面与明确排除的能力都须按 §16.6 分别验收，不能由依赖或模块存在推断行为等价。

## 16. 实证复核补充：可执行边界与收敛门禁

> **证据与状态**：本轮按工作区源码和项目文档抽查关键链路，未启动 .NET 或 Java 服务，未运行六库、集群、前端或第三方兼容测试。以下为设计要求，所有验收项目前均为**未执行**。证据使用相对本仓库路径；仓库版本和未验证范围见可行性篇的复核记录。

### 16.1 插件发布的可见性与流量切换

- `resolve → validate → load → prepare` 在隔离的候选域内完成，候选路由、权限、菜单、作业及工具**不得向生产请求或调度器可见**；先执行 §16.2 的兼容性检查和数据变更，再自检并发布。
- 单节点以不可变的插件域快照作为唯一发布点；请求开始时固定版本并持有引用直至完成，包括异步任务和 SSE。切换后旧版本停止接收新流量，排空、超时取消并释放线程、连接、回调、定时器及类加载器；未排空不得宣称已卸载。
- 多节点通过持久化操作记录、期望版本和节点确认推进，节点不支持目标版本或未完成加载时不接收该插件流量。发布失败、节点分区、重启恢复均应显示节点级状态；禁止以单节点内存切换冒充集群原子发布。
- **验收 P16-1**：并发请求、长 SSE、定时任务、加载失败及进程中断时验证每次请求只见一个版本；节点重启后收敛，不能遗留可执行的旧任务。通过前 L2 仅为实验能力。

### 16.2 结构同步、种子与恢复

1. 每个数据库/插件执行前取得有失效保护的独占执行权，保存目标版本、模型与脚本摘要、差异计划、步骤序号和状态 `planned/running/applied/failed`；同版本不同摘要拒绝执行。并发启动者不能同时修改同一对象。
2. 生成计划时显式校验数据库版本、方言、权限、表数据量和当前结构。`Off` 不执行 DDL；`ReadOnly` 只报告、不播种也不建库；`On` 的增列、建唯一索引仍可能因非空约束、重复数据或锁表失败，必须先检查，不能概括为无风险。空库初始化与生产权限不足均要给出明确失败状态。
3. 不假设六种数据库的 DDL 可事务回滚。逐步骤记账；进程中断后先读取实际结构并核对，不凭 `checksum` 断定执行成功。种子单库事务提交时同时记账；跨库分别记账，未完成的插件保持不可用。执行顺序统一为**结构同步 → 数据迁移脚本 → 种子 → 再比对 → 发布**；迁移脚本的前后置依赖必须在清单中声明。
4. 在线升级只允许声明并验证新旧代码均可读取、写入的 expand 变更；backfill 完成和所有旧节点退出之后才允许 contract。回切仅在旧版兼容当前结构和数据时自动执行，**不以自动恢复数据库快照覆盖其他节点或升级后写入**。破坏性变更需停写窗口、恢复演练及人工批准；恢复点须包含数据、结构与关联外部对象的可恢复范围和恢复时间目标。
5. SQLite 表重建须保留索引、触发器、外键、默认值和自增语义，检查外键与数据完整性；其他库按真实驱动验证。新分片和历史分片分别跟踪迁移状态，不得只同步当前分片后宣称全量兼容。

**验收 SCHEMA-16**：对六库分别注入每条 DDL 前后、脚本、播种、记账和发布间的崩溃，重启可检测实际状态并安全续行或停机告警；并发启动只执行一次；旧节点持续写入时失败回切不能抹掉已提交数据。国产库未实测时只能标记待验证。

### 16.3 事务、缓存与异步可靠性

`EntityQueue` 的 `Add` 会去重且在已满时立即返回 `false`；达到上限的一次调用可能已入队后等待并最终返回 `false`，不能简单解释为“false 一定未入队”（[源码](../../NewLife.XCode/XCode/Entity/EntityQueue.cs)）。Java 新接口须明确：**拒绝即未接收；接受即有稳定任务 ID；重复提交的结果可查询**。这是有意收紧的契约，不是逐行为等价。

- 内存队列只服务明确允许丢失的数据；`afterCommit` 前回滚不投递，但提交到入队之间、进程退出及刷写失败仍可能丢失。审计记录若有合规或完整性要求，不得默认用可丢队列；按业务等级选择同事务 outbox。
- outbox 与业务数据必须在**同一 ConnName、同一事务**提交；存 `eventId`、聚合键、版本、状态、重试时间，投递至少一次。消费者用 `(consumer,eventId)` 持久化去重，去重记录与本库副作用同事务提交；跨库/外部副作用使用目标端幂等键及对账补偿，不能许诺 exactly-once。
- 数据变更和缓存失效只在成功提交后发布，回滚不发布成功变更；节点断线重连须从持久游标补读或全量失效。权限、令牌撤销、租户隔离等安全数据不能因 Redis 或广播故障退化为陈旧放行；无法读取权威状态时拒绝相关敏感操作。
- **验收 TX-16**：提交前回滚、提交后入队前 kill、发送后确认前 kill、重复/乱序投递、失效消息漏收与节点重连均注入故障；验证有界重试、死信、告警和业务数据不重复。

### 16.4 作业与外部副作用

租约到期只能允许接管，不能证明原执行者已停止。抢占时以数据库时间原子分配 owner、`lockedUntil`、单调递增 token；续约和完成必须同时比较 owner 与 token。旧执行者恢复后必须拒绝其提交；对无法校验 token 的 HTTP、邮件等目标，以稳定执行 ID 做幂等或执行对账补偿，并明确可能重复。超过租期、网络分区、停止插件和误触发恢复均需覆盖。无法提供幂等的外部目标不承诺“仅执行一次”。

### 16.5 雪花 ID 的真实兼容边界

[Snowflake.cs](../../X/NewLife.Core/Data/Snowflake.cs) 默认起点为 1970 UTC 对应的本地时间，且 `StartTimestamp` 可在首次使用前自定义；无参生成器小幅回拨采用逻辑时间，另有按指定业务时间、`uid` 的重载。不得只用“41/10/12 + UTC”证明所有调用兼容。P0 盘点实际起点、时区、重载、历史 ID 与分片命名，建立 .NET/Java 固定输入向量，包含 DST、跨时区、回拨、每毫秒序列耗尽及重启。

41 位毫秒从 1970 起约在 **2039 年 9 月**耗尽正数时间范围；未来升级 ID 格式需要单独版本化和数据迁移决策，当前不得静默换 epoch。worker ID 必须有实际的分配、租约/持久化、释放与复用防重复规则；简单 Redis 自增取模或启动时扫描不能证明并发唯一。允许 fail-fast 的时钟回拨策略属于行为变化，需显式确认。

### 16.6 契约和 AI 替代的证据要求

- [WebAPI 接口规范](Api/WebAPI接口规范.md) 明确普通认证端点如 `/Auth/Login` 不带 `/api` 前缀；对照样本必须来自实际运行和配置，而不是根据路径名称猜测。`ControllerBaseX` 默认业务状态映射开关关闭；`RateLimitAttribute` 仍可直接返回 HTTP 429 和 `Retry-After`，两者不能混为“一律 200”。
- [认证控制器](../NewLife.Cube/Controllers/AuthController.cs) 登录包含验证码与 MFA 分支，刷新存在黑名单检查；Java 需覆盖这些分支以及相同刷新令牌并发使用、撤销、跨节点失效与退出后的访问。旧版的“先检查再处理”不能仅凭源码推断并发原子性；若新实现增加原子消费，应记录为有意增强并做客户端兼容验证。
- [幂等过滤器](../NewLife.Cube/Attributes/IdempotentAttribute.cs) 以用户、路径、请求头组成键，默认缓存成功 JSON 600 秒；该实现不保证并发首请求互斥。Java 如增强并发幂等，要单独定义同键不同请求体、租户隔离、过期和失败重试的行为，记录与旧版差异并测试导入/上传。
- “Model.xml 单一事实源”是 Java 目标，不是 XCode 现状的完整描述：[XCode 数据模型文档](../../NewLife.XCode/Doc/XCode数据模型与结构同步.md) 说明数据库、XML 和实体特性都可形成 `IDataTable`，Cube 控制器又会定制字段。P0 须盘点 XML、生成特性、控制器定制及运行时用户配置的差异；定义物理模型、业务扩展与用户配置的来源、优先级及冲突诊断。若某项无法从 XML 表达，须显式保留扩展并验证最终 `/meta`，不能静默丢弃以维持“唯一文件”。
- 对 `/meta`、登录/刷新、租户切换、导入导出、查询、`ViewProfile` 未知字段 round-trip 和 AI SSE，保存**原始请求与响应、状态码、头、事件边界及关联 ID**；只归一化明确允许变化的值，关联字段仍需校验。OpenAPI 快照是静态起点，不能替代运行样本；缺样本的端点不得标“等价”。
- [NewLife.AI 架构](../../NewLife.AI/Doc/架构设计.md) 含服务商、工具审批、过滤器、MCP、embedding、重排序等多种能力；§15.6 的 Java 映射仅是候选方案。对范围内每项登记源实现、输入输出、依赖版本、差异、可运行测试和负责人；范围外明确不迁移。现有 `VectorData` 将模型、维度和 Base64 浮点数据一起持久化（[源码](../../NewLife.AI/NewLife.AI/Embedding/VectorData.cs)）；若将来导入知识库存量，需定义字节序、模型/维度校验及重建索引，不能直接把不同模型向量混用。
- **验收 CONTRACT-16**：冻结源码版本、配置和测试数据；收集成功/失败/边界/并发样本，逐例对照 Java 与 ArcoVue。AI 工具同时验证租户、权限、危险操作审批、取消和分片 SSE；模型/库版本或能力不支持时标待验证，不以 starter 名称判定已覆盖。

### 16.7 收敛标准

设计完整不等于已验证：以范围内的接口、实体、后台任务、插件和外部依赖建立双向清单，每条必须有源证据、目标行为、差异及可执行验收；未确认项、被排除项和实测失败项分别列出。只有清单全覆盖、阻断项为零、关键运行和故障注入通过、用户确认行为变化后，才可宣布**该冻结范围**收敛；新增代码或需求须重新复核。

---

（完）
