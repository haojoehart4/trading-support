const axios = require("axios");
const _ = require("lodash");
const { refetchGetVol, sleep } = require("../utils/helper");

const handleFilterCondition = async (usdtPairString, intervalTime, volume) => {
  try {
    const result = await axios.get(
      `https://api.binance.com/api/v3/ticker?windowSize=${intervalTime}&symbols=${usdtPairString}`
    );
    let highPercentChange = !volume
      ? await result?.data?.sort(
          (a, b) =>
            parseFloat(a?.priceChangePercent) -
            parseFloat(b?.priceChangePercent)
        )
      : await result?.data?.sort(
          (a, b) =>
            parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)
        );

    const arr = highPercentChange?.map((x) => {
      return {
        ...x,
        symbol: x.symbol,
        price_percent_change: x?.priceChangePercent,
      };
    });
    return arr;
  } catch (e) {
    throw e;
  }
};

const findnewtokenlongterm = async (telegramBot, chat_id) => {
  let responseResultUp = [];
  let responseResultStr = [];
  let usdt_pair_string = "";
  let filterCondition = [];
  let loopResult = [];
  let arr = [];

  await axios
    .get(`https://api.binance.com/api/v3/ticker/24hr?type=MINI`)
    .then(async (res) => {
      const pairsNotAccepted = [
        "BUSDUSDT",
        "USDCUSDT",
        "TUSDUSDT",
        "EURUSDT",
        "FDUSDUSDT",
      ];
      const resultFormat = await res?.data?.map((x) => {
        return {
          ...x,
          perecentChange: (x?.lastPrice - x?.openPrice) / x?.openPrice
        }
      }) 

      const result = await resultFormat?.filter(
        (x) =>
          x.symbol.indexOf("USDT") > 0 &&
          parseFloat(x.lastPrice) > 0.05 &&
          parseFloat(x.lastPrice) < 10 &&
          !pairsNotAccepted.includes(x.symbol)
      ).sort((a,b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume) && parseFloat(b?.perecentChange) - parseFloat(a?.perecentChange))?.slice(0, 40);
      console.log(result.length);
      await sleep(5000);
      const limitLoop = result.length / 20;
      let childArray = [];

      for (let i = 0; i < Math.ceil(limitLoop); i++) {
        const arr = result.slice(i * 20, 20 * (i + 1));
        childArray.push(arr);
      }

      const childArrStr = childArray?.map((arr) => {
        return arr?.map((x) => {
          return `%22${x.symbol}%22`;
        });
      });

      arr = childArrStr?.map((x) => {
        return `%5B${x.join(",")}%5D`;
      });
      for (let x of arr) {
        //7d
        filterCondition = await handleFilterCondition(x, "7d", false);
        loopResult = filterCondition?.flat()?.slice(0, 15);
        await sleep(5000);

        //6d
        usdt_pair_string = `%5B${loopResult
          ?.map((x) => `%22${x?.symbol}%22`)
          ?.join(",")}%5D`;
        filterCondition = await handleFilterCondition(
          usdt_pair_string,
          "6d",
          false
        );
        loopResult = filterCondition?.flat()?.slice(0, 10);
        await sleep(5000);

        //3d
        usdt_pair_string = `%5B${loopResult
          ?.map((x) => `%22${x?.symbol}%22`)
          ?.join(",")}%5D`;
        filterCondition = await handleFilterCondition(
          usdt_pair_string,
          "3d",
          true
        );
        loopResult = filterCondition?.flat();

        const avg = loopResult.length / 2;
        const tokenGot3d = loopResult.slice(avg - 3, avg + 3);
        await sleep(5000);

        //4h
        usdt_pair_string = `%5B${tokenGot3d
          ?.map((x) => `%22${x?.symbol}%22`)
          ?.join(",")}%5D`;
        filterCondition = await handleFilterCondition(
          usdt_pair_string,
          "6h",
          true
        );
        loopResult = filterCondition?.flat();

        const tokenGot4h = loopResult
          ?.sort((a, b) =>
            parseFloat(b.quoteVolume - parseFloat(a.quoteVolume))
          )
          ?.slice(0, 3);

        for (let i of tokenGot4h) {
          const coupleFilterLatest = {
            startTime: new Date().getTime() - 4 * 60 * 60 * 1000,
            endTime: new Date().getTime(),
          };

          const coupleFilter6HrsAgo = {
            startTime: new Date().getTime() - 8 * 60 * 60 * 1000,
            endTime: new Date().getTime() - 4 * 60 * 60 * 1000,
          };

          //6hrs
          const result6Hrs = await refetchGetVol({
            ...coupleFilter6HrsAgo,
            symbol: i.symbol,
          });

          const past6HrsRlt = {
            isBuySession:
              result6Hrs.closePrice - result6Hrs.openPrice > 0 ? true : false,
            ...result6Hrs,
          };

          //3hrs
          const result3Hrs = await refetchGetVol({
            ...coupleFilterLatest,
            symbol: i.symbol,
          });


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
            responseResultUp.push({
              symbol: i.symbol,
              openPrice2h: past3HrsRlt.openPrice,
              closePrice2h: past3HrsRlt.closePrice,
              quoteVol2h: past3HrsRlt.totalVolume,
              openPrice4h: past6HrsRlt.openPrice,
              closePrice4h: past6HrsRlt.closePrice,
              quoteVol4h: past6HrsRlt.totalVolume,
            });
            // responseResultUp.push(`${i.symbol}: 8h - Giá mở cửa: ${past6HrsRlt.openPrice}, Giá đóng cửa: ${past6HrsRlt.closePrice}, KL: ${past6HrsRlt?.totalVolume},
            //   --- 4h - Giá mở cửa: ${past3HrsRlt.openPrice}, Giá đóng cửa: ${past3HrsRlt.closePrice}, KL: ${past3HrsRlt?.totalVolume} \n`);
          }
        }
      }

      responseResultUp
        .sort((a, b) => parseFloat(b.quoteVol2h) - parseFloat(a.quoteVol2h))
        ?.slice(0, 3)
        ?.map((x) => {
          responseResultStr.push(
            `${x.symbol}: 8h - Giá mở cửa: ${x.openPrice4h}, Giá đóng cửa: ${x.closePrice4h}, KL: ${x?.quoteVol4h}, 
        --- 4h - Giá mở cửa: ${x.openPrice2h}, Giá đóng cửa: ${x.closePrice2h}, KL: ${x?.quoteVol2h} \n`
          );
        });

      const responseResultString1 =
        responseResultStr.length > 0
          ? responseResultStr.join("\n")
          : "Không có coin nào để mua hết!";

      await telegramBot.sendMessage(
        chat_id,
        `Long term: ${responseResultString1}`
      );
    });
};

module.exports = findnewtokenlongterm;
