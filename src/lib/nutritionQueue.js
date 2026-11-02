export function mergeNutrition(remote, pending) {
  const rows = new Map(remote.map((row) => [row.id, row]))
  for (const operation of Object.values(pending)) {
    if (operation.type === 'delete') rows.delete(operation.id)
    else rows.set(operation.id, operation.row)
  }
  return [...rows.values()].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )
}
export function acknowledge(pending, sent) {
  const next = { ...pending }
  for (const operation of Object.values(sent))
    if (next[operation.id]?.version === operation.version)
      delete next[operation.id]
  return next
}
