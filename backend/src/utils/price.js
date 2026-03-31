function roundToTwo(n) {
	return Math.round(Number(n || 0) * 100) / 100;
}

function toNumber(value, fallback = 0) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function parseYmd(ymd) {
	const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return null;

	const year = Number(m[1]);
	const month = Number(m[2]);
	const day = Number(m[3]);

	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
		return null;
	}
	if (month < 1 || month > 12 || day < 1 || day > 31) {
		return null;
	}

	return { year, month, day };
}

export function getOccupancyMultiplier({ totalSlots, availableSlots }) {
	const total = toNumber(totalSlots, 0);
	const available = Math.max(0, toNumber(availableSlots, 0));

	if (!Number.isFinite(total) || total <= 0) {
		return { multiplier: 1, occupancyPercent: 0 };
	}

	const occupied = Math.max(0, Math.min(total, total - available));
	const occupancyPercent = (occupied / total) * 100;

	if (occupancyPercent >= 90) {
		return { multiplier: 1.5, occupancyPercent: roundToTwo(occupancyPercent) };
	}
	if (occupancyPercent >= 75) {
		return { multiplier: 1.3, occupancyPercent: roundToTwo(occupancyPercent) };
	}
	if (occupancyPercent >= 50) {
		return { multiplier: 1.15, occupancyPercent: roundToTwo(occupancyPercent) };
	}

	return { multiplier: 1, occupancyPercent: roundToTwo(occupancyPercent) };
}

export function getDayMultiplier({ bookingDateYmd }) {
	const parsed = parseYmd(bookingDateYmd);
	if (!parsed) {
		return { multiplier: 1, dayType: "WEEKDAY" };
	}

	// Use UTC noon for stable weekday/weekend evaluation from YYYY-MM-DD.
	const dt = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0));
	const day = dt.getUTCDay();
	const isWeekend = day === 0 || day === 6;

	return {
		multiplier: isWeekend ? 1.1 : 1,
		dayType: isWeekend ? "WEEKEND" : "WEEKDAY",
	};
}

export function calculateDynamicPrice({
	baseRate,
	durationHours,
	totalSlots,
	availableSlots,
	bookingDateYmd,
}) {
	const safeBaseRate = Math.max(0, toNumber(baseRate, 0));
	const safeDuration = Math.max(1, Math.ceil(toNumber(durationHours, 1)));

	const { multiplier: occupancyMultiplier, occupancyPercent } = getOccupancyMultiplier({
		totalSlots,
		availableSlots,
	});
	const { multiplier: dayMultiplier, dayType } = getDayMultiplier({ bookingDateYmd });

	const effectiveHourlyRate = roundToTwo(safeBaseRate * occupancyMultiplier * dayMultiplier);
	const totalPrice = roundToTwo(effectiveHourlyRate * safeDuration);

	return {
		baseRate: safeBaseRate,
		durationHours: safeDuration,
		multipliers: {
			occupancy: occupancyMultiplier,
			day: dayMultiplier,
		},
		occupancyPercent,
		dayType,
		effectiveHourlyRate,
		totalPrice,
	};
}
