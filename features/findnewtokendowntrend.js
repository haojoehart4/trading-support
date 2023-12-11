const axios = require("axios");
const _ = require("lodash");
const { refetchGetVol, sleep } = require("../utils/helper");

const handleFilterCondition = async (
  filterParam,
  usdtPairString,
  intervalTime,
  volume
) => {
  const result = await axios.get(
    `https://api.binance.com/api/v3/ticker?windowSize=${intervalTime}&symbols=${usdtPairString}`
  );

  // !volume ?  await result?.data?.filter((x) => parseFloat(x.priceChangePercent) < filterParam) :

  let highPercentChange = !volume
    ? await result?.data
        ?.filter(
          (x) =>
            parseFloat(x?.lastPrice) < 10 &&
            parseFloat(x.priceChangePercent) < 0
        )
        ?.sort(
          (a, b) => parseFloat(a?.quoteVolume) - parseFloat(b?.quoteVolume)
        )
    : await result?.data
        ?.filter(
          (x) =>
            parseFloat(x?.quoteVolume) > 1000000 &&
            parseFloat(x?.priceChange) > 0
        )
        ?.sort(
          (a, b) =>
            parseFloat(a?.priceChangePercent) -
              parseFloat(b?.priceChangePercent) &&
            parseFloat(a?.quoteVolume) - parseFloat(b?.quoteVolume)
        )
        ?.slice(-5);

  const arr = highPercentChange
    ?.filter((x) => parseFloat(x?.lastPrice) > 0.1)
    ?.map((x) => {
      return {
        // ...x,
        symbol: x.symbol,
        price_percent_change: x?.priceChangePercent,
      };
    });
  return arr;
};

const handleLoop = async (
  childArray,
  filterParam,
  intervalTime,
  volume = false
) => {
  let usdtPairsString = "";
  let tokenPairsPriceChange = [];
  for (let i = 0; i < childArray.length; i++) {
    //join string [[1,2], [3,4]]
    usdtPairsString = `%5B${childArray[i]?.join(",")}%5D`;
    //filter 2 hours
    const result = await handleFilterCondition(
      filterParam,
      usdtPairsString,
      intervalTime,
      volume
    );
    tokenPairsPriceChange = [...tokenPairsPriceChange, ...result];

    const usdtPairsArr = tokenPairsPriceChange.map((x) => `%22${x.symbol}%22`);
    usdtPairsString = `%5B${usdtPairsArr.join(",")}%5D`;
  }

  return {
    usdt_pair_string: usdtPairsString,
    token_pairs_price_change: tokenPairsPriceChange,
  };
};

const handleSeperateSymbols = async (arr, isGetAPI = false) => {
  let usdtPairs;
  if (isGetAPI) {
    usdtPairs = await arr?.symbols
      ?.filter((symbol) => symbol.quoteAsset === "USDT")
      ?.map((item) => {
        return `%22${item.symbol}%22`;
      });
  } else {
    usdtPairs = await arr?.map((item) => {
      return `%22${item.symbol}%22`;
    });
  }

  const limitLoop = usdtPairs.length / 99;
  let childArray = [];
  for (let i = 0; i < Math.ceil(limitLoop); i++) {
    const arr = await usdtPairs.slice(i * 99, 99 * (i + 1));
    childArray.push(arr);
    i++;
  }

  return childArray;
};

const findnewtokendowntrend = (telegramBot, chat_id) => {
  axios
    .get(`https://api.binance.com/api/v3/exchangeInfo`)
    .then(async (res) => {
      let childArray = [];
      let tokenPairsPriceChange = [];

      // filter 7d hours
      // childArray = await handleSeperateSymbols(res?.data, true);
      // const loopResult7d = await handleLoop(childArray, -16, "7d");
      // usdtPairsString = loopResult7d.usdt_pair_string;
      // tokenPairsPriceChange = loopResult7d.token_pairs_price_change;

      // filter 3d hours
      childArray = await handleSeperateSymbols(res?.data, true);
      const loopResult16Hrs = await handleLoop(childArray, -3, "1d");
      usdtPairsString = loopResult16Hrs.usdt_pair_string;
      tokenPairsPriceChange = loopResult16Hrs.token_pairs_price_change;

      // // filter 3h hours
      childArray = await handleSeperateSymbols(tokenPairsPriceChange);
      const loopResult1d = await handleLoop(childArray, 0.5, "3h", true);
      usdtPairsString = loopResult1d.usdt_pair_string;
      tokenPairsPriceChange = loopResult1d.token_pairs_price_change;

      // //filter 8h hours
      // childArray = await handleSeperateSymbols(tokenPairsPriceChange);
      // const loopResult4Hrs = await handleLoop(childArray, -2.5, "8h");
      // usdtPairsString = loopResult4Hrs.usdt_pair_string;
      // tokenPairsPriceChange = loopResult4Hrs.token_pairs_price_change;
      let responseResultUp = [];
      for (let i of tokenPairsPriceChange) {
        let buyVol9Hrs = 0;
        let sellVol9Hrs = 0;
        let buyVol6Hr = 0;
        let sellVol6Hr = 0;
        let buyVol3Hr = 0;
        let sellVol3Hr = 0;
        const coupleFilterLatest = {
          startTime: new Date().getTime() - 3 * 60 * 60 * 1000,
          endTime: new Date().getTime(),
        };

        const coupleFilter6HrsAgo = {
          startTime: new Date().getTime() - 6 * 60 * 60 * 1000,
          endTime: new Date().getTime() - 3 * 60 * 60 * 1000,
        };

        //6hrs
        const result6Hrs = await refetchGetVol(coupleFilter6HrsAgo);

        const past6HrsRlt = {
          isBuySession:
            result6Hrs.closePrice - result6Hrs.openPrice > 0 ? true : false,
          ...result6Hrs,
        };

        //3hrs
        const result3Hrs = await refetchGetVol(coupleFilterLatest);

        const past3HrsRlt = {
          isBuySession:
            result3Hrs.closePrice - result3Hrs.openPrice > 0 ? true : false,
          ...result3Hrs,
        };
        // const past3HrsRlt = {rate: result3Hrs.buyVol / result3Hrs.sellVol, isBuySession: result3Hrs.buyVol - result3Hrs.sellVol > 0 ? true : false};
        if (
          (!past6HrsRlt?.isBuySession &&
            past3HrsRlt?.isBuySession &&
            past3HrsRlt?.totalVolume / past6HrsRlt?.totalVolume > 1.5) ||
          (past6HrsRlt?.isBuySession && past3HrsRlt?.isBuySession)
        ) {
          responseResultUp.push(`${i.symbol}: 6h - Giá mở cửa: ${past6HrsRlt.openPrice}, Giá đóng cửa: ${past6HrsRlt.closePrice}, KL: ${past6HrsRlt?.totalVolume}, 
          --- 3h - Giá mở cửa: ${past3HrsRlt.openPrice}, Giá đóng cửa: ${past3HrsRlt.closePrice}, KL: ${past3HrsRlt?.totalVolume} \n`)
        }
      }

      const responseResultString1 =
        responseResultUp.length > 0
          ? responseResultUp.join("\n")
          : "Không có coin nào để mua hết!";

      await telegramBot.sendMessage(
        chat_id,
        `Downtrend: ${responseResultString1}`
      );
    })
    .catch((err) => {
      console.log(err);
    });
};

module.exports = findnewtokendowntrend;
