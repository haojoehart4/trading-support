const axios = require("axios");


const timeConvert = (time) => {

    return new Promise((resolve, reject) => {
        let timeResult = 0
        switch(time) {
            case '1m':
                timeResult =  60000
                break
            case '2m':
                timeResult = 120000
                break
            case '3m':
                timeResult = 180000
                break
            case '5m':
                timeResult = 300000
                break
            case '7m':
                timeResult = 420000
                break
            case '9m':
                timeResult = 540000
                break
            case '11m':
                timeResult = 660000
                break
            case '30m':
                timeResult = 1800000
                break
            case '1h':
                timeResult = 3600000
                break
            case '2h':
                timeResult = 7200000
                break
            case '4h':
                timeResult = 14400000
                break
            case '6h':
                timeResult = 21600000
                break
            case '8h':
                timeResult = 28800000
                break
            case '12h':
                timeResult = 43200000
                break
    
        }
        resolve(timeResult)
    })
}

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

const refetchGetVol = async (coupleFilters, timeToSleep = 11000) => {
    const result = await axios.get(
      `https://api.binance.com/api/v3/klines?symbol=${coupleFilters.symbol}&limit=1000&startTime=${coupleFilters?.startTime}&endTime=${coupleFilters?.endTime}&interval=5m`
    );
    let totalVolume = 0
    const openPrice = parseFloat(result?.data[0][1])
    const closePrice = parseFloat(result?.data[result?.data.length - 1][4])

    await result?.data?.map((x) => {
        totalVolume += parseFloat(x[5])
      });

    return {openPrice: openPrice, closePrice: closePrice, totalVolume: totalVolume}
  };

module.exports = {timeConvert, refetchGetVol, sleep}