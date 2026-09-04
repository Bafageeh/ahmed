const toDinarNumber = (value) => {
  const number = Number(String(value ?? 0).replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
};

const isDinarPaymentPaid = (payment) =>
  Boolean(Number(payment?.is_paid)) ||
  String(payment?.status || '').trim().toLowerCase() === 'paid';

const dinarOriginalInvestment = (item) =>
  Math.max(
    0,
    toDinarNumber(
      item?.original_investment_amount ?? item?.investment_amount ?? item?.investment
    )
  );

const dinarReturnedPrincipal = (item) => {
  const original = dinarOriginalInvestment(item);
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  const returned = payments.reduce(
    (sum, payment) =>
      sum + (isDinarPaymentPaid(payment) ? Math.max(0, toDinarNumber(payment?.total_principal)) : 0),
    0
  );

  return Math.min(original, returned);
};

const dinarRemainingInvestment = (item) =>
  Math.max(0, dinarOriginalInvestment(item) - dinarReturnedPrincipal(item));

const dinarExpectedDistributions = (item) => {
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  return payments.reduce(
    (sum, payment) => sum + Math.max(0, toDinarNumber(payment?.total_distribution)),
    0
  );
};

const dinarPaymentGrossDistribution = (payment) => {
  if (!isDinarPaymentPaid(payment)) return 0;

  const scheduled = Math.max(0, toDinarNumber(payment?.total_distribution));
  if (scheduled > 0) return scheduled;

  return Math.max(0, toDinarNumber(payment?.paid_amount));
};

const dinarPaymentInvestmentFee = (payment) =>
  isDinarPaymentPaid(payment) ? Math.max(0, toDinarNumber(payment?.investment_fee)) : 0;

const dinarPaymentVat = (payment) =>
  isDinarPaymentPaid(payment) ? Math.max(0, toDinarNumber(payment?.vat_amount)) : 0;

const dinarPaymentTotalFees = (payment) =>
  dinarPaymentInvestmentFee(payment) + dinarPaymentVat(payment);

const dinarPaymentNetDistribution = (payment) => {
  if (!isDinarPaymentPaid(payment)) return 0;

  if (payment?.net_distribution !== undefined && payment?.net_distribution !== null) {
    return Math.max(0, toDinarNumber(payment.net_distribution));
  }

  const paid =
    payment?.paid_amount !== undefined && payment?.paid_amount !== null
      ? Math.max(0, toDinarNumber(payment.paid_amount))
      : dinarPaymentGrossDistribution(payment);
  const fees = dinarPaymentTotalFees(payment);

  return Math.max(0, paid - fees);
};

const dinarGrossPaidDistributions = (item) => {
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  return payments.reduce(
    (sum, payment) => sum + dinarPaymentGrossDistribution(payment),
    0
  );
};

// Backward-compatible alias: schedule progress should continue to use gross
// distributions. Net profit is exposed separately below.
const dinarPaidDistributions = dinarGrossPaidDistributions;

const dinarNetPaidDistributions = (item) => {
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  return payments.reduce(
    (sum, payment) => sum + dinarPaymentNetDistribution(payment),
    0
  );
};

const dinarPaidInvestmentFees = (item) => {
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  return payments.reduce(
    (sum, payment) => sum + dinarPaymentInvestmentFee(payment),
    0
  );
};

const dinarPaidVat = (item) => {
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  return payments.reduce(
    (sum, payment) => sum + dinarPaymentVat(payment),
    0
  );
};

const dinarPaidFees = (item) => dinarPaidInvestmentFees(item) + dinarPaidVat(item);

const dinarRemainingDistributions = (item) =>
  Math.max(0, dinarExpectedDistributions(item) - dinarGrossPaidDistributions(item));

const dinarTotalReceived = (item) =>
  dinarNetPaidDistributions(item) + dinarReturnedPrincipal(item);

module.exports = {
  toDinarNumber,
  isDinarPaymentPaid,
  dinarOriginalInvestment,
  dinarReturnedPrincipal,
  dinarRemainingInvestment,
  dinarExpectedDistributions,
  dinarPaymentGrossDistribution,
  dinarPaymentInvestmentFee,
  dinarPaymentVat,
  dinarPaymentTotalFees,
  dinarPaymentNetDistribution,
  dinarGrossPaidDistributions,
  dinarPaidDistributions,
  dinarNetPaidDistributions,
  dinarPaidInvestmentFees,
  dinarPaidVat,
  dinarPaidFees,
  dinarRemainingDistributions,
  dinarTotalReceived,
};
