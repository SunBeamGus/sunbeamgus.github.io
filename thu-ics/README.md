# thu-schedule-ics

使用 [`@thu-info/lib`](https://www.npmjs.com/package/@thu-info/lib) 在**本地**自动读取
清华大学信息门户的课表，生成可供日历 App 订阅的 `.ics` 文件，并推送到 GitHub Pages
托管订阅。

> **为什么是本地？** 清华的登录服务（`oauth.tsinghua.edu.cn`）只对国内网络开放，
> GitHub 托管的 Actions runner 在海外无法访问，因此生成课表这步必须在你的电脑上运行。

## 功能

- 登录清华大学信息门户，调用 `getSchedule()` 抓取本学期（或指定学期）课表；
- 把「第 N 周 + 星期 X + 第 a–b 节」映射为具体日期时间，包含教室与考试安排；
- 忽略你在 THUInfo 中**删除/隐藏**的时间片，排除自定义日程（可用开关保留）；
- 输出标准 iCalendar 2.0（UTC 时间），兼容 Google / Apple / Outlook 等主流日历。

## 快速开始

前置：Node.js ≥ 20、Git（并已在本仓库配置好代理）。

1. **填写凭据**（`.env` 已被 `.gitignore` 忽略，不会被提交）：

   ```powershell
   copy thu-ics\.env.example thu-ics\.env
   # 用记事本打开 thu-ics\.env，填入 THU_USER_ID / THU_PASSWORD
   ```

2. **生成并推送**（在仓库根目录执行）：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\thu-ics\update.ps1
   ```

   脚本会自动：首次 `npm install` → 直连清华生成 `res/courses.ics` → 用 git 代理
   提交并推送到 GitHub。

   也可以跳过脚本、在 `thu-ics` 目录直接运行 `npm run generate`（`index.ts` 会读取
   `.env`），只生成不推送。

3. **订阅**：日历 App 订阅 URL：

   ```
   https://<你的用户名>.github.io/res/courses.ics
   ```

   例如 `https://sunbeamgus.github.io/res/courses.ics`，一键订阅
   `webcal://sunbeamgus.github.io/res/courses.ics`（首页 `index.html` 已有入口）。

## 定时自动运行（可选）

用 Windows 任务计划程序每天自动执行（需管理员权限）：

```powershell
powershell -ExecutionPolicy Bypass -File .\thu-ics\register-task.ps1
```

取消：`Unregister-ScheduledTask -TaskName "THU Schedule ICS" -Confirm:$false`

> 前提：任务运行时机器需开机；首次 `git push` 已通过 Git Credential Manager 交互
> 登录（凭据会被缓存，之后可无人值守）。

## 目录结构

```
sunbeamgus.github.io/
├── thu-ics/
│   ├── src/
│   │   ├── index.ts        # 入口：读取 .env → 登录 → 抓取 → 写文件
│   │   ├── ics.ts          # 数据结构 + ICS 生成
│   │   ├── periods.ts      # 节次 ↔ 时间映射（源自 THUInfo 官方 app）
│   │   └── totp.ts         # 可选 TOTP 两步验证
│   ├── update.ps1          # 本地一键：生成 + 提交 + 推送
│   ├── register-task.ps1   # 注册 Windows 计划任务（可选）
│   ├── .env.example        # 凭据模板（复制为 .env 后填写）
│   ├── package.json
│   └── tsconfig.json
└── res/courses.ics          # 生成结果（供 Pages 订阅）
```

## 环境变量（写在 `thu-ics/.env` 或系统环境变量）

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `THU_USER_ID` | 是 | 学号（信息门户账号） |
| `THU_PASSWORD` | 是 | 信息门户密码 |
| `THU_TOTP_SECRET` | 否 | TOTP 两步验证密钥（Base32） |
| `THU_SEMESTER_INDEX` | 否 | 抓取下学期课表（`nextSemesterList` 下标）；留空 = 当前学期 |
| `THU_INCLUDE_CUSTOM` | 否 | `1`/`true` 时保留自定义日程，默认排除 |
| `THU_CALNAME` | 否 | 日历名称，默认「清华大学课表（学期名）」 |
| `THU_OUTPUT` | 否 | 输出文件路径，默认 `<仓库>/res/courses.ics` |

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

- **隐私**：`.ics` 会公开托管，任何拿到 URL 的人都能看到你的课表。请确认可接受，
  或改为私有仓库托管。
- **两步验证**：`THU_TOTP_SECRET` 假定为标准的 TOTP（SHA-1、6 位、30 秒）。
  若学校使用其它方式（微信/短信）无法自动化，则只能手动运行。
- **代理模式**：生成课表需直连清华内网。若你的代理是「全局/TUN 模式」把
  `*.tsinghua.edu.cn` 也劫持到海外，会导致超时——请在代理软件中把该域名设为直连。
- 本工具基于 `@thu-info/lib@3.15.2`，该库许可为 Business Source License 1.1，
  仅供个人学习使用。
