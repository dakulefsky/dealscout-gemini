const alerts = require('../repositories/priceAlertRepository');
const mailer = require('./mailService');

async function processPriceAlerts({ asin, salePrice }) {
  const sale = Number(salePrice);
  if (!asin || !Number.isFinite(sale) || sale <= 0) return { checked: 0, delivered: 0, failed: 0 };
  if (!mailer.isConfigured()) return { checked: 0, delivered: 0, failed: 0, skipped: 'EMAIL_NOT_CONFIGURED' };

  const claimed = await alerts.claimEligible(asin, sale);
  let delivered = 0;
  let failed = 0;

  for (const alert of claimed) {
    try {
      await mailer.sendPriceAlert(alert.email, {
        dealId: alert.dealId,
        dealTitle: alert.dealTitle,
        currentPrice: sale,
        targetPrice: alert.targetPrice,
      });
    } catch (error) {
      failed += 1;
      await alerts.releaseClaim(alert.id).catch(() => {});
      console.warn(`[PriceAlerts] Delivery failed for ${alert.id}:`, error.message);
      continue;
    }

    try {
      const marked = await alerts.markTriggered(alert.id);
      if (!marked) throw new Error('delivery claim was no longer active');
      delivered += 1;
    } catch (error) {
      // The email has already been sent. Do not reopen the claim here or an
      // immediate retry could knowingly duplicate the notification. A stale
      // DELIVERING lease is recoverable if the process cannot persist success.
      failed += 1;
      console.warn(`[PriceAlerts] Delivered email but could not mark ${alert.id} triggered:`, error.message);
    }
  }

  return { checked: claimed.length, delivered, failed };
}

module.exports = { processPriceAlerts };
