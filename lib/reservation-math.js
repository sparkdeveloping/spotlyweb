export function releaseReservedQuantity(current, quantity) {
  const normalizedCurrent = Math.max(0, Number(current || 0));
  const normalizedQuantity = Math.max(0, Number(quantity || 0));
  return Math.max(0, normalizedCurrent - normalizedQuantity);
}

export function releaseBookedSlot(bookedSlots, slotId) {
  const next = { ...(bookedSlots || {}) };
  if (!slotId) return next;
  next[slotId] = releaseReservedQuantity(next[slotId], 1);
  return next;
}
