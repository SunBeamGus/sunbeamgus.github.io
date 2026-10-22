# 注册 Windows 计划任务：每天定时生成并推送课表 ICS。
# 需要以管理员身份运行 PowerShell。
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\thu-ics\register-task.ps1
# 取消：
#   Unregister-ScheduledTask -TaskName "THU Schedule ICS" -Confirm:$false

$ErrorActionPreference = "Stop"

$TaskName = "THU Schedule ICS"
$Time     = "08:00"   # 每天运行时间（24 小时制）

$ScriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$UpdateScript = Join-Path $ScriptDir "update.ps1"

$Action   = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$UpdateScript`""
$Trigger  = New-ScheduledTaskTrigger -Daily -At $Time
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
    -Settings $Settings -Description "每天生成清华课表 ICS 并推送到 GitHub" -Force | Out-Null

Write-Host "已注册计划任务：$TaskName（每天 $Time 运行）"
Write-Host "如需取消： Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
