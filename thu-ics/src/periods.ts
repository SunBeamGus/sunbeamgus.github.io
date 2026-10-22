/**
 * 清华大学上课节次时间表。
 *
 * 来源：THUInfo App 官方源码
 * apps/thu-info-app/src/utils/scheduleLayout.ts 中的 `beginTime` / `endTime`。
 *
 * 数组下标即节次（下标 0 占位）：
 *   第 1 节 08:00–08:45 … 第 14 节 21:00–21:45
 */
export const PERIOD_BEGIN: string[] = [
	"",
	"08:00", // 1
	"08:50", // 2
	"09:50", // 3
	"10:40", // 4
	"11:30", // 5
	"13:30", // 6
	"14:20", // 7
	"15:20", // 8
	"16:10", // 9
	"17:05", // 10
	"17:55", // 11
	"19:20", // 12
	"20:10", // 13
	"21:00", // 14
];

export const PERIOD_END: string[] = [
	"",
	"08:45", // 1
	"09:35", // 2
	"10:35", // 3
	"11:25", // 4
	"12:15", // 5
	"14:15", // 6
	"15:05", // 7
	"16:05", // 8
	"16:55", // 9
	"17:50", // 10
	"18:40", // 11
	"20:05", // 12
	"20:55", // 13
	"21:45", // 14
];

function clampPeriod(period: number): number {
	if (!Number.isFinite(period)) {
		return 1;
	}
	return Math.min(14, Math.max(1, Math.floor(period)));
}

/** 第 `period` 节的开始时间，如 "09:50"。 */
export function periodBegin(period: number): string {
	return PERIOD_BEGIN[clampPeriod(period)] ?? "08:00";
}

/** 第 `period` 节的结束时间，如 "11:25"。 */
export function periodEnd(period: number): string {
	return PERIOD_END[clampPeriod(period)] ?? "08:45";
}
