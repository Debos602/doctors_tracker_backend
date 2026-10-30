export function getPagination({ page = 1, limit = 10 }) {
  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta({ page, limit, total }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/** Adds _id as a tie-breaker so paging is stable when the sort field has duplicates. */
export function buildSort(sortBy = 'createdAt', order = 'desc') {
  const direction = order === 'asc' ? 1 : -1;
  return sortBy === '_id' ? { _id: direction } : { [sortBy]: direction, _id: direction };
}

export function buildDateRange(from, to) {
  if (!from && !to) return undefined;
  const range = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return range;
}

/** O(1) metadata count when there is no filter, exact count otherwise. */
export function countDocuments(Model, filter) {
  return Object.keys(filter).length
    ? Model.countDocuments(filter)
    : Model.estimatedDocumentCount();
}
