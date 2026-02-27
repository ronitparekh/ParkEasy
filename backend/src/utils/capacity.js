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
