# thu-schedule-ics

使用 [`@thu-info/lib`](https://www.npmjs.com/package/@thu-info/lib) 自动读取清华大学
信息门户的**课表**，生成可供日历 App 订阅的 `.ics`（iCalendar）文件，并可通过
GitHub Actions 定时托管到 GitHub Pages。

## 功能

- 登录清华大学信息门户，调用 `getSchedule()` 抓取本学期（或指定学期）课表；
- 把「第 N 周 + 星期 X + 第 a–b 节」映射为具体日期时间，包含教室与考试安排；
- 忽略你在 THUInfo 中**删除/隐藏**的时间片，排除自定义日程（可用开关保留）；
- 输出标准 iCalendar 2.0（`VERSION:2.0` + `METHOD:PUBLISH`，UTC 时间），兼容
  Google / Apple / Outlook 等主流日历。

## 目录结构

```
sunbeamgus.github.io/
├── .github/workflows/schedule-ics.yml   # 定时抓取 + 提交 .ics
├── thu-ics/
│   ├── src/
│   │   ├── index.ts    # 入口：登录 → 抓取 → 写文件
│   │   ├── ics.ts      # 数据结构 + ICS 生成
│   │   ├── periods.ts  # 节次 ↔ 时间映射（源自 THUInfo 官方 app）
│   │   └── totp.ts     # 可选 TOTP 两步验证
│   ├── package.json
│   └── tsconfig.json
└── res/courses.ics      # 生成结果（由工作流提交，供 Pages 订阅）
```

## 本地运行

前置：Node.js ≥ 20。

```bash
cd thu-ics
npm install

# Windows (PowerShell)
$env:THU_USER_ID="你的学号"
$env:THU_PASSWORD="你的密码"
npm run generate

# macOS / Linux (bash)
THU_USER_ID=你的学号 THU_PASSWORD=你的密码 npm run generate
```

运行后会在 `res/` 目录生成 `courses.ics`，直接用日历 App 打开即可导入。

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `THU_USER_ID` | 是 | 学号（信息门户账号） |
| `THU_PASSWORD` | 是 | 信息门户密码 |
| `THU_TOTP_SECRET` | 否 | TOTP 两步验证密钥（Base32）。未开启两步验证则无需设置 |
| `THU_SEMESTER_INDEX` | 否 | `nextSemesterList` 的下标，用于抓取下学期课表；留空 = 当前学期 |
| `THU_INCLUDE_CUSTOM` | 否 | `1`/`true` 时保留自定义日程，默认排除 |
| `THU_CALNAME` | 否 | 日历名称，默认「清华大学课表（学期名）」 |
| `THU_OUTPUT` | 否 | 输出文件路径，默认 `<仓库>/res/courses.ics` |

## 托管到 GitHub Pages（自动订阅）

1. **启用 Pages**：仓库 Settings → Pages，Source 选 `Deploy from a branch`，分支选
   `main`（或你的默认分支）、目录 `/ (root)`。
2. **配置密钥**：Settings → Secrets and variables → Actions，新增 Repository secrets：
   - `THU_USER_ID`：你的学号
   - `THU_PASSWORD`：你的密码
   - `THU_TOTP_SECRET`：若开启了 TOTP 两步验证则填 Base32 密钥，否则可留空

   可选 Repository variables（非敏感配置）：
   - `THU_INTENSIVE`：设为 `1` 时每小时刷新一次（选课期间用），否则仅每天刷新
   - `THU_SEMESTER_INDEX`：要抓取的学期下标（留空 = 当前学期）
3. **手动触发一次**：Actions → 「Generate THU Schedule ICS」 → Run workflow，确认成功。
4. **订阅**：日历 App 订阅 URL：

   ```
   https://<你的用户名>.github.io/res/courses.ics
   ```

   例如本项目对应 `https://sunbeamgus.github.io/res/courses.ics`，一键订阅链接为
   `webcal://sunbeamgus.github.io/res/courses.ics`（已在首页 `index.html` 提供入口）。

### 刷新频率

工作流默认**每天 UTC 20:00（北京时间次日 04:00）**刷新一次；同时每小时触发一次，
但只有把 Repository variable `THU_INTENSIVE` 设为 `1`（选课期间）时，每小时触发才会
真正抓取并提交，否则直接跳过。手动 `workflow_dispatch` 总是执行。频率可在
`.github/workflows/schedule-ics.yml` 中调整 `cron`。

## 节次时间表

按清华大学（本科生）标准课表，节次与时间对应如下（源自 THUInfo App 官方源码）：

| 节次 | 时间 | 节次 | 时间 |
| --- | --- | --- | --- |
| 1 | 08:00–08:45 | 8 | 15:20–16:05 |
| 2 | 08:50–09:35 | 9 | 16:10–16:55 |
| 3 | 09:50–10:35 | 10 | 17:05–17:50 |
| 4 | 10:40–11:25 | 11 | 17:55–18:40 |
| 5 | 11:30–12:15 | 12 | 19:20–20:05 |
| 6 | 13:30–14:15 | 13 | 20:10–20:55 |
| 7 | 14:20–15:05 | 14 | 21:00–21:45 |

如你的院系/研究生节次安排不同，可直接修改 `thu-ics/src/periods.ts`。

## 注意事项

- **隐私**：`.ics` 会被公开托管，任何拿到 URL 的人都能看到你的课表。请确认可接受，
  或改为在私有仓库托管。
- **两步验证**：`THU_TOTP_SECRET` 假定为标准的 TOTP（SHA-1、6 位、30 秒）。
  若学校使用其它方式（微信/短信）且无法自动化，则 GitHub Actions 无法无人值守登录，
  只能本地手动运行。
- **登录稳定性**：从 GitHub Actions 的海外 IP 登录可能触发安全策略或偶尔失败；
  脚本对「读取课表」做了 3 次重试，必要时可手动重新触发工作流。
- 本工具基于 `@thu-info/lib@3.15.2`，该库许可为 Business Source License 1.1，
  仅供个人学习使用。
