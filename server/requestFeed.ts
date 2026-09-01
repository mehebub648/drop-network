export type RequestFeedFilters = {
  bloodGroup?: string;
  district?: string;
  urgentOnly?: boolean;
};

export type RequestFeedCandidate = {
  blood_group: string;
  location: { area_name: string };
  needed_by?: string;
  created_at: string;
};

type RankedRequest<T> = { request: T; score: number };

function isUrgent(request: RequestFeedCandidate, now: number) {
  return !request.needed_by || new Date(request.needed_by).getTime() - now <= 72 * 3_600_000;
}

function oldestFirst<T extends RequestFeedCandidate>(left: T, right: T) {
  return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
}

export function buildRequestFeedPage<T extends RequestFeedCandidate>(
  candidates: T[],
  filters: RequestFeedFilters,
  page: number,
  limit: number,
  now = Date.now()
) {
  const hasFilters = Boolean(filters.bloodGroup || filters.district || filters.urgentOnly);
  const exact = candidates
    .filter(request => !filters.bloodGroup || request.blood_group === filters.bloodGroup)
    .filter(request => !filters.district || request.location.area_name === filters.district)
    .filter(request => !filters.urgentOnly || isUrgent(request, now))
    .sort(oldestFirst);
  const exactSet = new Set(exact);

  const other = hasFilters && exact.length < 10
    ? candidates
      .filter(request => !exactSet.has(request))
      .map<RankedRequest<T>>(request => ({
        request,
        score:
          (filters.bloodGroup && request.blood_group === filters.bloodGroup ? 4 : 0) +
          (filters.district && request.location.area_name === filters.district ? 3 : 0) +
          (isUrgent(request, now) ? (filters.urgentOnly ? 3 : 1) : 0)
      }))
      .sort((left, right) => right.score - left.score || oldestFirst(left.request, right.request))
      .map(item => item.request)
    : [];

  const combined = [
    ...exact.map(request => ({ request, other: false })),
    ...other.map(request => ({ request, other: true }))
  ];
  const start = (page - 1) * limit;
  const pageItems = combined.slice(start, start + limit);

  return {
    items: pageItems.filter(item => !item.other).map(item => item.request),
    otherItems: pageItems.filter(item => item.other).map(item => item.request),
    exactTotal: exact.length,
    total: combined.length,
    pages: Math.max(1, Math.ceil(combined.length / limit))
  };
}
