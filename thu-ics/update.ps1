# 本地生成课表 ICS 并推送到 GitHub。
# 用法（在仓库根目录执行）：
#   powershell -ExecutionPolicy Bypass -File .\thu-ics\update.ps1
# 也可由 Windows 任务计划程序定时运行（见 register-task.ps1）。

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path   # thu-ics\
$RepoRoot  = Split-Path -Parent $ScriptDir                      # 仓库根

# ---- 1. 首次自动安装依赖 ----
if (-not (Test-Path (Join-Path $ScriptDir "node_modules"))) {
    Write-Host "首次运行，安装依赖（若卡住可配置 npm 镜像或代理）..."
    Push-Location $ScriptDir
    npm install
    if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
    Pop-Location
}

# ---- 2. 生成 ICS（index.ts 会读取 thu-ics\.env；直连清华内网，无需代理）----
Push-Location $ScriptDir
npm run generate
$genExit = $LASTEXITCODE
Pop-Location
if ($genExit -ne 0) {
    Write-Host "生成失败（exit $genExit）。" -ForegroundColor Red
    exit $genExit
}

# ---- 3. 提交并推送（git 已在本仓库配置代理 localhost:15236）----
Push-Location $RepoRoot
git add res/courses.ics
if (git diff --cached --quiet) {
    Write-Host "ICS 无变化，跳过提交。"
} else {
    git commit -m "chore: update res/courses.ics"
    if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
    git push
    if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
}
Pop-Location

Write-Host "`nOK 完成。"
