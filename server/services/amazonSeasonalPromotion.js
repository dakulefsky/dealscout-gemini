const siteSettings = require('./siteRuntimeSettingsService');

function thanksgivingDate(year) {
  const thanksgiving = new Date(Date.UTC(year, 10, 1));
  const firstThursdayOffset = (4 - thanksgiving.getUTCDay() + 7) % 7;
  thanksgiving.setUTCDate(1 + firstThursdayOffset + 21);
  return thanksgiving.toISOString().slice(0, 10);
}

function blackFridayDate(year) {
  const friday = new Date(`${thanksgivingDate(year)}T00:00:00.000Z`);
  friday.setUTCDate(friday.getUTCDate() + 1);
  return friday.toISOString().slice(0, 10);
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
      title: 'Prime Day Sale',
      description: 'Shop the current Amazon deal selection.',
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
      title: localDate === cyberMonday ? 'Cyber Monday Sale' : 'Black Friday Sale',
      description: 'Shop current Amazon deals through Cyber Monday.',
      href: '/?category=all',
      startsOn: blackFriday,
      endsOn: cyberMonday,
    };
  }

  if (localDate === thanksgivingDate(year)) {
    return {
      id: 'thanksgiving-day-sale',
      title: 'Thanksgiving Day Sale',
      description: 'Shop the current Amazon deal selection.',
      href: '/?category=all',
      startsOn: localDate,
      endsOn: localDate,
    };
  }

  if (localDate === `${year}-10-31`) {
    return {
      id: 'halloween-day-sale',
      title: 'Halloween Day Sale',
      description: 'Shop the current Amazon deal selection.',
      href: '/?category=all',
      startsOn: localDate,
      endsOn: localDate,
    };
  }

  if (localDate === `${year}-12-25`) {
    return {
      id: 'christmas-day-sale',
      title: 'Christmas Day Sale',
      description: 'Shop the current Amazon deal selection.',
      href: '/?category=all',
      startsOn: localDate,
      endsOn: localDate,
    };
  }
  return null;
}

module.exports = { thanksgivingDate, blackFridayDate, cyberMondayDate, dateInNewYork, activePromotionFor, getActivePromotion };
