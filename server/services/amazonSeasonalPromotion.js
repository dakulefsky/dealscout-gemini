const siteSettings = require('./siteRuntimeSettingsService');

function blackFridayDate(year) {
  const thanksgiving = new Date(Date.UTC(year, 10, 1));
  const firstThursdayOffset = (4 - thanksgiving.getUTCDay() + 7) % 7;
  thanksgiving.setUTCDate(1 + firstThursdayOffset + 21);
  thanksgiving.setUTCDate(thanksgiving.getUTCDate() + 1);
  return thanksgiving.toISOString().slice(0, 10);
}

function cyberMondayDate(year) {
  const friday = new Date(`${blackFridayDate(year)}T00:00:00.000Z`);
  friday.setUTCDate(friday.getUTCDate() + 3);
  return friday.toISOString().slice(0, 10);
}

function dateInNewYork(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

async function getActivePromotion(now = new Date()) {
  const localDate = dateInNewYork(now);
  const [startSetting, endSetting] = await Promise.all([
    siteSettings.get('amazon_prime_day_start'),
    siteSettings.get('amazon_prime_day_end'),
  ]);
  const primeStart = startSetting.value || '';
  const primeEnd = endSetting.value || '';

  return activePromotionFor(localDate, primeStart, primeEnd);
}

function activePromotionFor(localDate, primeStart = '', primeEnd = '') {
  const year = Number(localDate.slice(0, 4));
  if (primeStart && primeEnd && localDate >= primeStart && localDate <= primeEnd) {
    return {
      id: 'prime-day',
      title: 'Amazon Prime Day',
      description: 'Browse current deals. Prices are checked by DealScout and can change.',
      href: '/?category=all',
      startsOn: primeStart,
      endsOn: primeEnd,
    };
  }

  const blackFriday = blackFridayDate(year);
  const cyberMonday = cyberMondayDate(year);
  if (localDate >= blackFriday && localDate <= cyberMonday) {
    return {
      id: 'black-friday-cyber-monday',
      title: 'Black Friday through Cyber Monday',
      description: 'Browse current Amazon deals, with prices checked by DealScout.',
      href: '/?category=all',
      startsOn: blackFriday,
      endsOn: cyberMonday,
    };
  }
  return null;
}

module.exports = { blackFridayDate, cyberMondayDate, dateInNewYork, activePromotionFor, getActivePromotion };
