export function computeConflictBuffer(totalSlots) {
  const slots = Number(totalSlots);
  if (!Number.isFinite(slots) || slots <= 0) return 0;
  const buffer = Math.max(2, Math.ceil(slots * 0.1));
  return Math.min(slots, buffer);
}

export function computeBookableLimit(totalSlots) {
  const slots = Number(totalSlots);
  if (!Number.isFinite(slots) || slots <= 0) return 0;
  const conflictBuffer = computeConflictBuffer(slots);
  return Math.max(0, slots - conflictBuffer);
}

export function buildActiveBookingsCapacityQuery({ parkingId, now }) {
  // Maps requested states to our current schema:
  // - BOOKED: status UPCOMING/ACTIVE
  // - ARRIVED_AT_GATE / QUEUE_LOCKED: queueHoldUntil in future (not revoked)
  // - INSIDE_PARKING: status CHECKED_IN/OVERSTAYED (and not checked out)
  return {
    parkingId,
    gateStatus: { $ne: "CHECKED_OUT" },
    status: {
      $nin: [
        "CANCELLED",
        "COMPLETED",
        "EXPIRED",
        "PENDING_PAYMENT",
        "PAYMENT_FAILED",
      ],
    },
    $or: [
      { status: { $in: ["UPCOMING", "ACTIVE"] } },
      { status: { $in: ["CHECKED_IN", "OVERSTAYED"] } },
      { queueHoldUntil: { $gt: now }, queueHoldRevokedAt: { $exists: false } },
    ],
  };
}

/**
 * Check if two time ranges overlap on the same date.
 * Times are in HH:MM format (e.g., "14:30").
 * Returns true if ranges overlap.
 */
export function timeRangesOverlap(start1, end1, start2, end2) {
  const toMinutes = (timeStr) => {
    const [h, m] = String(timeStr || "").split(":");
    return Number(h) * 60 + Number(m);
  };

  const start1Min = toMinutes(start1);
  const end1Min = toMinutes(end1);
  const start2Min = toMinutes(start2);
  const end2Min = toMinutes(end2);

  if (![start1Min, end1Min, start2Min, end2Min].every(n => Number.isFinite(n))) {
    return false;
  }

  // Ranges overlap if: start1 < end2 AND start2 < end1
  return start1Min < end2Min && start2Min < end1Min;
}

/**
 * Count bookings that overlap with requested time slot on the same date.
 * Only counts active, non-cancelled bookings.
 */
export function countOverlappingBookings(bookings, { bookingDate, startTime, endTime }) {
  return bookings.filter((b) => {
    // Must be same date
    if (String(b.bookingDate) !== String(bookingDate)) {
      return false;
    }

    // Must be active/upcoming (not cancelled/completed/expired)
    if (
      [
        "CANCELLED",
        "COMPLETED",
        "EXPIRED",
        "PENDING_PAYMENT",
        "PAYMENT_FAILED",
      ].includes(b.status)
    ) {
      return false;
    }

    // Check time overlap
    return timeRangesOverlap(b.startTime, b.endTime, startTime, endTime);
  }).length;
}
