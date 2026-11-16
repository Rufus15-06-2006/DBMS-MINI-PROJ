// Run in mongosh after selecting hospital_supply_chain_events.
// The web dashboard runs the same kind of aggregation from its API route.

// 1. Event counts per type over the last 30 days.
db.audit_events.aggregate([
  { $match: { timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
  { $group: { _id: "$event_type", event_count: { $sum: 1 } } },
  { $sort: { event_count: -1 } }
]);

// 2. Units issued / shortage quantities by product ID.
db.audit_events.aggregate([
  { $match: { timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
  { $group: {
      _id: "$product_id",
      total_issued: { $sum: { $ifNull: ["$quantity", 0] } },
      total_shortfall: { $sum: { $ifNull: ["$shortfall", 0] } },
      event_count: { $sum: 1 }
  } },
  { $sort: { total_shortfall: -1, total_issued: -1 } }
]);
