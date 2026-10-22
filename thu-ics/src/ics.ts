import { periodBegin, periodEnd } from "./periods.js";

/** 与 @thu-info/lib 3.x 的 ScheduleType 保持一致（不直接依赖其内部类型路径）。 */
export enum ScheduleType {
	PRIMARY = 0,
	SECONDARY = 1,
	EXAM = 2,
	CUSTOM = 3,
}

export interface TimeSlice {
	dayOfWeek: number; // 1 = 周一 … 7 = 周日
	begin: number; // 起始节次（1–14）
	end: number; // 结束节次（1–14）
	activeWeeks: number[]; // 活跃周（1 起）
}

export interface ExamTimeSlice {
	dayOfWeek: number;
	weekNumber: number;
	begin: string; // "HH:mm"
	end: string; // "HH:mm"
}

export interface ScheduleTime {
	base: TimeSlice[];
	exams?: ExamTimeSlice[];
}

export interface Schedule {
	name: string;
	location: string;
	hash: string;
	type: ScheduleType;
	activeTime: ScheduleTime;
	delOrHideTime: ScheduleTime;
}

export interface Semester {
	firstDay: string; // "YYYY-MM-DD"，第 1 周周一
	semesterId: string;
	semesterName: string;
	weekCount: number;
}

export interface CalendarData extends Semester {
	nextSemesterList: Semester[];
}

export interface BuildOptions {
	includeCustom: boolean;
}

export interface CalendarEvent {
	uid: string;
	dtStart: string; // "YYYYMMDDTHHMMSSZ"（UTC，与 THUInfo App 导出格式一致）
	dtEnd: string;
	summary: string;
	location: string;
	description: string;
}

const DAY_NAMES = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

/**
 * 在 "YYYY-MM-DD" 上增加 `days` 天，返回 "YYYYMMDD"。
 * 使用 UTC 计算，避免运行环境时区（GitHub Actions 为 UTC）带来的偏差。
 */
function addDays(dateStr: string, days: number): string {
	const [y, m, d] = dateStr.split("-").map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d + days));
	return `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(
		dt.getUTCDate(),
	)}`;
}

/** 从任意含 "HH:mm" 的字符串中提取时间并转为 ICS 的 "HHMMSS"。 */
function hhmmToIcs(time: string): string {
	const m = String(time).match(/(\d{1,2}):(\d{1,2})/);
	if (!m) {
		return "000000";
	}
	return `${pad2(parseInt(m[1], 10))}${pad2(parseInt(m[2], 10))}00`;
}

/**
 * 将北京时间（Asia/Shanghai，UTC+8，无夏令时）的本地时刻转为 UTC。
 * `date` 形如 "YYYYMMDD"，`time` 形如 "HHMMSS"，返回 "YYYYMMDDTHHMMSSZ"。
 */
function beijingToUtc(date: string, time: string): string {
	const y = Number(date.slice(0, 4));
	const mo = Number(date.slice(4, 6));
	const d = Number(date.slice(6, 8));
	const hh = Number(time.slice(0, 2));
	const mm = Number(time.slice(2, 4));
	const ss = Number(time.slice(4, 6));
	const dt = new Date(Date.UTC(y, mo - 1, d, hh - 8, mm, ss));
	return `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(
		dt.getUTCDate(),
	)}T${pad2(dt.getUTCHours())}${pad2(dt.getUTCMinutes())}${pad2(
		dt.getUTCSeconds(),
	)}Z`;
}

/** iCalendar 文本转义：反斜杠、分号、逗号、换行。 */
function escapeText(value: string): string {
	return String(value)
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\r?\n/g, "\\n");
}

/**
 * RFC 5545 要求每行不超过 75 字节。这里在 UTF-8 字节边界上折叠，
 * 续行以空格开头（该空格会被解析器剥离）。
 */
function foldLine(line: string): string {
	const bytes = Buffer.from(line, "utf8");
	const firstLimit = 75;
	const contLimit = 74;
	if (bytes.length <= firstLimit) {
		return line;
	}
	const parts: string[] = [];
	let offset = 0;
	let limit = firstLimit;
	while (offset < bytes.length) {
		let end = Math.min(offset + limit, bytes.length);
		// 不要在 UTF-8 多字节字符中间切开
		while (end > offset && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
			end--;
		}
		parts.push(bytes.subarray(offset, end).toString("utf8"));
		offset = end;
		limit = contLimit;
	}
	return parts.join("\r\n ");
}

function hiddenKey(week: number, day: number, begin: number, end: number): string {
	return `${week}|${day}|${begin}|${end}`;
}

function sanitizeHash(hash: unknown): string {
	return String(hash ?? "course").replace(/[^a-zA-Z0-9._-]/g, "-");
}

/**
 * 把 THUInfo 课表（Schedule[]）与学期信息（Semester）展开为日历事件。
 * 日期公式（与官方 app 一致）：日期 = firstDay + (week - 1) * 7 + (dayOfWeek - 1) 天。
 */
export function buildEvents(
	schedules: Schedule[],
	semester: Semester,
	options: BuildOptions,
): CalendarEvent[] {
	const events: CalendarEvent[] = [];

	for (const sched of schedules) {
		// 用户删除/隐藏的时间片（delOrHideTime）不生成事件
		const hidden = new Set<string>();
		for (const hs of sched.delOrHideTime?.base ?? []) {
			for (const week of hs.activeWeeks ?? []) {
				hidden.add(hiddenKey(week, hs.dayOfWeek, hs.begin, hs.end));
			}
		}

		const isCustom = sched.type === ScheduleType.CUSTOM;
		if (!isCustom || options.includeCustom) {
			for (const slice of sched.activeTime?.base ?? []) {
				for (const week of slice.activeWeeks ?? []) {
					if (hidden.has(hiddenKey(week, slice.dayOfWeek, slice.begin, slice.end))) {
						continue;
					}
					const date = addDays(
						semester.firstDay,
						(week - 1) * 7 + (slice.dayOfWeek - 1),
					);
					events.push({
						uid: `${sanitizeHash(sched.hash)}-w${week}-d${slice.dayOfWeek}-b${slice.begin}@thu-schedule-ics`,
						dtStart: beijingToUtc(date, hhmmToIcs(periodBegin(slice.begin))),
						dtEnd: beijingToUtc(date, hhmmToIcs(periodEnd(slice.end))),
						summary: sched.name,
						location: sched.location ?? "",
						description: `第${week}周 ${DAY_NAMES[slice.dayOfWeek] ?? ""} 第${
							slice.begin
						}-${slice.end}节`,
					});
				}
			}
		}

		// 考试（含正课附带的考试安排）
		for (const exam of sched.activeTime?.exams ?? []) {
			const date = addDays(
				semester.firstDay,
				(exam.weekNumber - 1) * 7 + (exam.dayOfWeek - 1),
			);
			events.push({
				uid: `${sanitizeHash(sched.hash)}-exam-w${exam.weekNumber}-d${exam.dayOfWeek}@thu-schedule-ics`,
				dtStart: beijingToUtc(date, hhmmToIcs(exam.begin)),
				dtEnd: beijingToUtc(date, hhmmToIcs(exam.end)),
				summary: `${sched.name}（考试）`,
				location: sched.location ?? "",
				description: `第${exam.weekNumber}周 ${DAY_NAMES[exam.dayOfWeek] ?? ""} 考试`,
			});
		}
	}

	events.sort((a, b) => (a.dtStart < b.dtStart ? -1 : a.dtStart > b.dtStart ? 1 : 0));
	return events;
}

export function generateICS(events: CalendarEvent[], calName: string): string {
	const now = new Date();
	const dtstamp = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(
		now.getUTCDate(),
	)}T${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(
		now.getUTCSeconds(),
	)}Z`;

	const lines: string[] = [];
	lines.push("BEGIN:VCALENDAR");
	lines.push("VERSION:2.0");
	lines.push("PRODID:-//thu-schedule-ics//THU Schedule//CN");
	lines.push("CALSCALE:GREGORIAN");
	lines.push("METHOD:PUBLISH");
	lines.push(`X-WR-CALNAME:${escapeText(calName)}`);
	lines.push("X-WR-CALDESC:清华大学课表（由 thu-schedule-ics 自动生成）");
	lines.push("X-WR-TIMEZONE:Asia/Shanghai");
	lines.push("X-PUBLISHED-TTL:PT1H");

	for (const ev of events) {
		lines.push("BEGIN:VEVENT");
		lines.push(`UID:${ev.uid}`);
		lines.push(`DTSTAMP:${dtstamp}`);
		lines.push(`DTSTART:${ev.dtStart}`);
		lines.push(`DTEND:${ev.dtEnd}`);
		lines.push(`SUMMARY:${escapeText(ev.summary)}`);
		if (ev.location) {
			lines.push(`LOCATION:${escapeText(ev.location)}`);
		}
		if (ev.description) {
			lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
		}
		lines.push("END:VEVENT");
	}

	lines.push("END:VCALENDAR");
	return lines.map(foldLine).join("\r\n") + "\r\n";
}
