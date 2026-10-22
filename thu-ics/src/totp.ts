import { createHmac } from "node:crypto";

/**
 * 极简 TOTP（RFC 6238）实现，用于自动化登录时的两步验证。
 * 默认 SHA-1 / 6 位 / 30 秒（Google Authenticator 标准参数）。
 *
 * 仅当设置了 `THU_TOTP_SECRET` 时才被使用；未设置则完全不影响登录流程。
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
	const cleaned = input
		.toUpperCase()
		.replace(/=+$/g, "")
		.replace(/[^A-Z2-7]/g, "");
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const ch of cleaned) {
		const idx = BASE32_ALPHABET.indexOf(ch);
		if (idx < 0) {
			continue;
		}
		value = (value << 5) | idx;
		bits += 5;
		if (bits >= 8) {
			bits -= 8;
			out.push((value >> bits) & 0xff);
		}
	}
	return Buffer.from(out);
}

export function totp(
	secret: string,
	options?: { step?: number; digits?: number },
): string {
	const step = options?.step ?? 30;
	const digits = options?.digits ?? 6;
	const key = base32Decode(secret);
	const counter = Math.floor(Date.now() / 1000 / step);
	const msg = Buffer.alloc(8);
	msg.writeBigUInt64BE(BigInt(counter));
	const hmac = createHmac("sha1", key).update(msg).digest();
	const offset = hmac[hmac.length - 1] & 0x0f;
	const code =
		((hmac[offset] & 0x7f) << 24) |
		((hmac[offset + 1] & 0xff) << 16) |
		((hmac[offset + 2] & 0xff) << 8) |
		(hmac[offset + 3] & 0xff);
	return String(code % 10 ** digits).padStart(digits, "0");
}
