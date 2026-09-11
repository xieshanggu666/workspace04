# 校园微电网推演沙盘 Campus Microgrid Sandbox

在校园地图上布置 **光伏 / 储能 / 充电桩 / 楼宇负载**，导入天气与分时电价，拖动 24 小时时间轴回放调度结果，比较不同容量方案，并回放故障告警。

- **能源管理员（manager）**：日常运行——查看基线调度、地图拖拽设备、设置/解除设备故障、确认告警。
- **规划师（planner）**：方案模拟——在地图画布上增减光储充与楼宇、调整容量参数、注入临时故障时段，保存容量方案并做多方案对比。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + TypeScript + Pinia + Vue Router + ECharts |
| 后端 | NestJS + TypeORM + Passport JWT（角色鉴权） |
| 数据库 | MySQL 8（**不可用时自动降级 SQLite**，零依赖即可启动） |
| 缓存 | Redis（基线推演结果缓存；**不可用时自动降级内存缓存**） |
| 测试 | Vitest（仿真引擎 14 个用例） |

## 目录结构

```
.
├── server/                 NestJS 后端
│   ├── src/
│   │   ├── entities/       TypeORM 实体（设备/天气/电价/方案/告警/仿真结果/用户）
│   │   ├── simulation/     ★ 纯函数仿真引擎（engine.ts）+ 方案合并 + 服务/控制器
│   │   ├── database/       数据源探测（MySQL→SQLite）+ 校园示例种子
│   │   ├── cache/          Redis→内存 自动降级缓存
│   │   ├── auth/ devices/ weather/ tariffs/ scenarios/ alarms/
│   │   └── main.ts         首启自动播种
│   └── data/               SQLite 文件（仅离线降级时生成）
└── web/                    Vue3 前端
    └── src/
        ├── views/          Sandbox 推演 / Compare 方案对比 / Alarms 告警回放 / Login
        ├── components/     CampusMap / DispatchChart / Timeline / KpiBar / DevicePanel / AlarmRail
        └── stores/         Pinia（auth、grid 画布与推演状态）
```

## 快速开始（无需 MySQL/Redis，30 秒跑起来）

要求 Node.js ≥ 18。

```bash
# 1. 安装依赖（workspace 一次性安装前后端）
npm install

# 2. 启动后端（自动建表 + 写入校园示例数据）
npm run dev:server
#   控制台看到 “微电网后端已启动: http://127.0.0.1:3000/api”

# 3. 新开终端启动前端
npm run dev:web
#   打开 http://localhost:5173
```

或一条命令同时启动前后端：

```bash
npm run dev
```

首启时后端探测不到 MySQL 会打印 `MySQL 不可达…降级 SQLite`，Redis 同理——**这是预期行为，不影响任何功能**。

### 演示账号

| 角色 | 账号 | 密码 | 权限 |
|---|---|---|---|
| 能源管理员 | `manager` | `manager123` | 运行模式：设备增删/移动、故障设置、告警确认 |
| 规划师 | `planner` | `planner123` | 规划模式：画布布点、容量编辑、方案保存与对比 |

## 使用 MySQL + Redis（生产/交付环境）

后端默认连接配置即题目要求：`root / zhongxin123`。

1. 启动 MySQL（数据库不存在会自动创建 `microgrid`）与 Redis：

```bash
# 示例（按本机环境调整）
docker run -d --name mg-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=zhongxin123 mysql:8
docker run -d --name mg-redis -p 6379:6379 redis:7
```

2. 复制配置并按需修改：

```bash
cp server/.env.example server/.env
# DB_HOST/DB_PORT/DB_USER=root/DB_PASSWORD=zhongxin123/DB_NAME=microgrid
# REDIS_HOST/REDIS_PORT
```

3. 启动后 TypeORM 自动建表（`synchronize: true`），首启自动播种。
   重新灌入示例数据：`npm run seed -w server`
   想跳过外部依赖强制离线：在 `server/.env` 设 `OFFLINE=1`。

## 校园示例数据

- **设备 11 台**：教学楼群/图书馆/实验楼/宿舍群/行政楼 5 栋楼宇；屋顶光伏 3 处（1060 kWp）；校园储能电站 1500 kWh / 400 kW；东门快充、南门慢充 2 座充电站。
- **天气 3 天**：`2026-09-08 典型晴朗日`、`2026-09-09 多云波动日`、`2026-09-10 高温晴热日`，均为 24 点逐时辐照/温度/云量。
- **分时电价**：00–08 谷 0.35 元、08–10/13–17/22–24 平 0.75 元、10–13/17–22 峰 1.25 元；上网 0.38 元；需量电费 40 元/kW·月。
- **规划方案 3 个**：A 储能扩容调峰、B 光伏翻倍+储能、C 光储柔充一体化（充电桩扩容）。
- **运行告警**：基于高温日基线推演生成（峰值越限、储能低电量、高温、天气波动等）。

## 仿真模型（真实约束）

- **光伏**：`P = 装机 × (辐照/1000) × (1 − 0.4%/℃×(T−25℃)) × (1 − 0.85×云量)`，夜间为 0、故障为 0。
- **楼宇**：逐时占用曲线（教学/实验/宿舍三套）× 基础负载，温度 >26℃ 叠加制冷负荷。
- **充电桩**：单桩功率 × 桩数 × 逐时车桩利用率（17–21 点晚高峰最高）。
- **储能**：峰段放电覆盖净负荷、平/峰越需量线削峰、谷段充满、平时仅消纳光伏余电；
  受 SOC 上下限、额定功率、单趟 96% 效率约束；
  **任何一小时内充电与放电严格互斥**（单元测试逐时断言）。
- **功率平衡**：`负载 + 电池充电 = 光伏 + 电池放电 + 电网购电 − 余电上网`（测试逐时校验，误差 <0.2kW）。
- **经济指标**：电量电费（峰谷价差）+ 基本电费（按当日最大购电需量折算）。
- **天气与峰值真实影响**：多云日光伏明显下降、高温日冷负荷与峰值最高（见对比页与三天气象切换）。

## 核心页面

1. **地图推演 `/sandbox`**
   - 运行/规划双模式切换（按角色开放）；地图 SVG 上拖拽设备、实时功率流动画、并网点购/售电、电池 SOC 环。
   - 底部 ECharts 24h 调度曲线（峰谷底色、时间游标），时间轴可拖动 / ▶ 自动播放，右侧栏逐时告警联动。
   - 设备侧栏：实时出力/SOC、容量参数编辑、规划态故障时段注入（如 11–13 点逆变器中断）。
2. **容量方案对比 `/compare`**：基线 + 3 个预置方案 + 当前画布方案，同天气日下对比费用/峰值/购电量/绿电占比（ECharts 柱图 + 差值表，自动标注最优）。
3. **故障告警回放 `/alarms`**：24 小时告警密度条、逐时刻回放、全日流水、确认/解决闭环；管理员可先在推演页置设备故障，再"重新推演并同步告警"。

## 主要 API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录获取 JWT |
| GET/POST/PUT/PATCH/DELETE | `/api/devices[...]` | 设备 CRUD、`/move` 拖拽、`/status` 故障设置（manager） |
| GET/POST | `/api/weather` `/api/weather/import` `/api/weather/generate` | 天气导入与参数化生成（24 点数组） |
| GET/PUT | `/api/tariffs` | 分时电价 |
| GET/POST/DELETE | `/api/scenarios` | 容量方案（planner） |
| POST | `/api/simulation/run` | 推演（支持 `scenarioId` 或临时 `config`） |
| GET | `/api/simulation/baseline?date=` | 管理员基线推演（Redis 缓存 5 分钟） |
| POST | `/api/simulation/compare` | 多方案 KPI 对比 |
| GET/PATCH/POST | `/api/alarms` `/alarms/sync` | 告警回放、确认、按当前故障重推演同步 |

## 测试

```bash
npm test -w server
# 14 个用例：光伏温度/云量模型、储能充放互斥与 SOC 限值、
# 谷充峰放、高温冷负荷、功率平衡、扩容降购电、故障注入与告警去重
```

## 常见问题

- **端口占用**：后端 3000、前端 5173，可改 `server/.env` 的 `PORT` 与 `web/vite.config.ts`。
- **想换一套校园数据**：改 `server/src/database/sample-data.ts` 后删除 SQLite 文件或清空 MySQL 表，重启即可重灌。
