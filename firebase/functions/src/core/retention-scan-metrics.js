/** C6 privacy-safe metrics over snapshots the scheduled retention sweep already fetched. */
export function summarizeDriverRetentionScan({ dispatch = {}, presence = {}, active = {}, access = {} } = {}) {
  let dispatchAreas = 0;
  let dispatchDrivers = 0;
  for (const areas of Object.values(dispatch || {})) {
    for (const drivers of Object.values(areas || {})) {
      dispatchAreas += 1;
      dispatchDrivers += Object.keys(drivers || {}).length;
    }
  }
  return {
    dispatchAreasScanned: dispatchAreas,
    dispatchDriversScanned: dispatchDrivers,
    presenceDriversScanned: Object.keys(presence || {}).length,
    activeTripsScanned: Object.keys(active || {}).length,
    activeTripAccessRecordsScanned: Object.keys(access || {}).length
  };
}
