import { InfoHelper } from "@thu-info/lib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildEvents,
	generateICS,
	type CalendarData,
	type Schedule,
	type Semester,
} from "./ics.js";
import { totp } from "./totp.js";

const here = dirname(fileURLToPath(import.meta.url));

function sleep(ms: number): Promise<void> {
	return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function withRetry<T>(
	fn: () => Promise<T>,
	attempts: number,
	label: string,
): Promise<T> {
	let lastError: unknown;
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn();
		} catch (e) {
			lastError = e;
			if (i < attempts - 1) {
				console.warn(`⚠️ ${label} 第 ${i + 1} 次失败，${2 * (i + 1)}s 后重试…`);
				await sleep(2000 * (i + 1));
			}
		}
	}
	throw lastError;
}

function envBool(name: string, defaultValue = false): boolean {
	const v = process.env[name];
	if (v === undefined || v === "") {
		return defaultValue;
	}
	return v !== "0" && v.toLowerCase() !== "false";
}

async function main(): Promise<void> {
	const userId = process.env.THU_USER_ID;
	const password = process.env.THU_PASSWORD;
	if (!userId || !password) {
		throw new Error(
			"缺少登录凭据：请设置环境变量 THU_USER_ID 与 THU_PASSWORD。",
		);
	}

	const helper = new InfoHelper();

	// 可选：两步验证（TOTP）。未设置 THU_TOTP_SECRET 时保持默认行为。
	const totpSecret = process.env.THU_TOTP_SECRET;
	if (totpSecret) {
		helper.twoFactorMethodHook = async (_hasWeChat, _phone, hasTotp) =>
			hasTotp ? "totp" : undefined;
		helper.twoFactorAuthHook = async () => totp(totpSecret);
	}
	// 自动化环境下自动信任新设备（每次 CI 都是全新指纹）。
	helper.trustFingerprintHook = async () => true;
	helper.trustFingerprintNameHook = async () => "GitHub Actions";

	console.log(`🔐 正在以 ${userId} 登录清华大学信息门户…`);
	await helper.login({ userId, password });

	const semRaw = process.env.THU_SEMESTER_INDEX;
	const nextSemesterIndex =
		semRaw === undefined || semRaw === "" ? undefined : Number(semRaw);

	console.log("📚 正在读取课表…");
	const { schedule, calendar } = await withRetry(
		() => helper.getSchedule(nextSemesterIndex),
		3,
		"读取课表",
	);

	// getSchedule 返回的 calendar 恒为当前学期；选择其它学期时需自行取 nextSemesterList。
	let semester: Semester = calendar;
	if (
		nextSemesterIndex !== undefined &&
		(calendar as CalendarData).nextSemesterList?.[nextSemesterIndex]
	) {
		semester = (calendar as CalendarData).nextSemesterList[nextSemesterIndex];
	}

	const includeCustom = envBool("THU_INCLUDE_CUSTOM", false);
	const events = buildEvents(schedule as Schedule[], semester, { includeCustom });
	const calName =
		process.env.THU_CALNAME ??
		`清华大学课表（${semester.semesterName || semester.semesterId || "本学期"}）`;
	const ics = generateICS(events, calName);

	// 默认输出到仓库的 res/courses.ics（here = thu-ics/src，向上两级到仓库根）。
	const out =
		process.env.THU_OUTPUT ?? resolve(here, "..", "..", "res", "courses.ics");
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, ics, "utf8");

	console.log(`✅ 已生成 ${out}`);
	console.log(
		`   学期：${semester.semesterName}（第 1 周周一 = ${semester.firstDay}，共 ${semester.weekCount} 周）`,
	);
	console.log(`   事件数：${events.length}`);
}

main().catch((e) => {
	console.error("❌ 生成失败：", e);
	process.exit(1);
});
