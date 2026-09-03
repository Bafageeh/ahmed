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

const dinarPaidDistributions = (item) => {
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  return payments.reduce((sum, payment) => {
    if (!isDinarPaymentPaid(payment)) return sum;
    const received =
      payment?.paid_amount !== undefined && payment?.paid_amount !== null
        ? payment.paid_amount
        : payment?.total_distribution;
    return sum + Math.max(0, toDinarNumber(received));
  }, 0);
};

const dinarRemainingDistributions = (item) =>
  Math.max(0, dinarExpectedDistributions(item) - dinarPaidDistributions(item));

const dinarTotalReceived = (item) =>
  dinarPaidDistributions(item) + dinarReturnedPrincipal(item);

module.exports = {
  toDinarNumber,
  isDinarPaymentPaid,
  dinarOriginalInvestment,
  dinarReturnedPrincipal,
  dinarRemainingInvestment,
  dinarExpectedDistributions,
  dinarPaidDistributions,
  dinarRemainingDistributions,
  dinarTotalReceived,
};
