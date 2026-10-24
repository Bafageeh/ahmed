const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function buildIncomeWidgetData(snapshot, definitions, includeFinance, userId) {
  const sources = [
    ...definitions.filter((source) => includeFinance || !['finance', 'com'].includes(source.id)).map((source) => ({
      amount: finite(snapshot.values?.[source.id]?.amount), color: source.color,
    })),
    ...(snapshot.manual || []).map((row) => ({ amount: finite(row.amount), color: '#58736F' })),
  ];
  const total = sources.reduce((sum, source) => sum + source.amount, 0);
  const positive = sources.filter((source) => source.amount > 0);
  const positiveTotal = positive.reduce((sum, source) => sum + source.amount, 0);
  const updatedAt = snapshot.updatedAt instanceof Date ? snapshot.updatedAt.getTime() : finite(snapshot.updatedAt);
  return {
    ownerId: String(userId),
    monthlyAmount: Math.round((total + Number.EPSILON) * 100) / 100,
    annualAmount: Math.round((total * 12 + Number.EPSILON) * 100) / 100,
    activeCount: positive.length,
    updatedAt,
    stale: Boolean(snapshot.failed?.length),
    segments: positive.map((source) => ({ color: source.color, fraction: source.amount / positiveTotal })),
  };
}

module.exports = { buildIncomeWidgetData };
