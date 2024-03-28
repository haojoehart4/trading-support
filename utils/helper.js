const axios = require("axios");

const timeConvert = (time) => {
  return new Promise((resolve, reject) => {
    let timeResult = 0;
    switch (time) {
      case "1m":
        timeResult = 60000;
        break;
      case "2m":
        timeResult = 120000;
        break;
      case "3m":
        timeResult = 180000;
        break;
      case "5m":
        timeResult = 300000;
        break;
      case "7m":
        timeResult = 420000;
        break;
      case "9m":
        timeResult = 540000;
        break;
      case "11m":
        timeResult = 660000;
        break;
      case "30m":
        timeResult = 1800000;
        break;
      case "1h":
        timeResult = 3600000;
        break;
      case "2h":
        timeResult = 7200000;
        break;
      case "4h":
        timeResult = 14400000;
        break;
      case "6h":
        timeResult = 21600000;
        break;
      case "8h":
        timeResult = 28800000;
        break;
      case "12h":
        timeResult = 43200000;
        break;
    }
    resolve(timeResult);
  });
};

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

const refetchGetVol = async (coupleFilters) => {
  const result = await axios.get(
    `https://api.binance.com/api/v3/klines?symbol=${coupleFilters.symbol}&limit=250&startTime=${coupleFilters?.startTime}&endTime=${coupleFilters?.endTime}&interval=1m`
  );
  let totalVolume = 0;
  let closePrice = 0;
  let openPrice = 0;
  await sleep(20000);
  if (result?.data?.length > 0) {
    openPrice = parseFloat(result?.data[0][1]);
    closePrice = parseFloat(result?.data[result?.data.length - 1][4]);

    await result?.data?.map((x) => {
      totalVolume += parseFloat(x[7]);
    });
  } else {
    openPrice = 0;
    closePrice = 0;
    totalVolume = 0;
  }
  return {
    openPrice: openPrice,
    closePrice: closePrice,
    totalVolume: totalVolume,
  };
};

const getTotalBalance = (binance, baseAsset = null) => {
  return new Promise(async (resolve, reject) => {
    let result = 0;
    try {
      await binance.balance((error, balances) => {
        let balanceResult = [];
        if (error) reject(error);
        for (const x in balances) {
          if (parseFloat(balances[x].available) > 0) {
            balanceResult.push(`${x}: ${balances[x].available}`);
          }
        }
        if (baseAsset) {
          result = parseFloat(balances[baseAsset].available);
          resolve(result)
        } else {
          const responseToUser = balanceResult.join(", ");
          resolve(`Your balance information here: ${responseToUser}`)
        }
      });
    } catch (err) {
      reject(err)
    }
  });
};

module.exports = { timeConvert, refetchGetVol, sleep, getTotalBalance };
