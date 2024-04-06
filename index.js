const express = require("express");
const app = express();
const { Server } = require("socket.io");
// const ws = require('ws')
const cors = require("cors");
const Binance = require("node-binance-api");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const axios = require("axios");
app.use(cors());
app.use(cookieParser());
app.use(express.json());
const request = require("request");
const _ = require("lodash");
dotenv.config();
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
const TelegramBot = require("node-telegram-bot-api");
const {
  timeConvert,
  refetchGetVol,
  getTotalBalance,
} = require("./utils/helper");
const findNewTokenLongTerm = require("./features/findnewtokenlongterm");
const { parse } = require("path");

app.get("/", (req, res) => {
  res.send("Hello from Node.js!");
});

const binance = new Binance().options({
  APIKEY: process.env.BINACE_API_KEY,
  APISECRET: process.env.BINANCE_API_SECRET_KEY,
  family: 4,
  useServerTime: true,
  reconnect: true,
  verbose: true,
});

// binance.futuresPrices()
// .then((data) => console.log(`Future Price`, data))
// .catch((err) => console.log(err))

// binance.futuresAccount()
// .then((data) => console.log(`Future ACCOUNT`, data))
// .catch((err) => console.log(err))

// binance.marketSell("FISUSDT", 64)
// .then((data) => console.log('__', data))
// .catch((err) => console.log(err.body))

// binance.prices('LQTYUSDT', (error, ticker) => {
//   console.info("Price of BNB: ", ticker);
// });

// binance.bookTickers('LQTYUSDT')
// .then((x) => console.log('bookTickers::', x))
// .catch((err) => console.log(err))

// binance.depth("LQTYUSDT", (error, depth, symbol) => {
//   console.info(symbol+" market depth", depth);
// });

// binance.trades("LQTYUSDT", (error, trades, symbol) => {
//   let totalBuyVolume = 0;
//   let totalSellVolume = 0;
//   for (let trade of trades) {
//     if (trade.isBuyer) {
//       totalBuyVolume += parseFloat(trade.qty);
//     } else {
//       totalSellVolume += parseFloat(trade.qty);
//     }
//   }
//   console.log("Total buy volume: ", totalBuyVolume);
//   console.log("Total sell volume: ", totalSellVolume);
// });

// binance.prices('BNBBTC', (error, ticker) => {
//   console.info("Price of BNB: ", ticker.BNBBTC);
// });

binance.balance((error, balances) => {
  if ( error ) return console.error(error);
  console.info("balances()", balances);
});

// binance.futuresMiniTickerStream( 'LQTYUSDT', (response) => {
//   console.log('LQTYUSDT::', response)
// })

// Get the depth of market for the LQTYUSDT trading pair
// binance.futuresDepth( 'BTCUSDT', (error, depth) => {
//   console.log('response::', depth)
// });

// ====//===
// const getKLines = async (marketSymbol, timeInterval, startTime, endTime) => {
//   const instance = axios.create({
//     baseURL: `https://api.binance.com/api/v3`,
//   });
//   const response = await axios.get(
//     `https://api.binance.com/api/v3/klines?symbol=${marketSymbol}&interval=${timeInterval}&startTime=${startTime}&endTime=${endTime}&limit=${1000}`
//   );
//   return response.data;
// };
// getKLines('LQTYUSDT', '1h', new Date('11/17/2023 03:00:00').getTime(),  new Date('11/17/2023 07:00:00').getTime())

// ---------------------------------TELEGRAM-BOT------------------------------------//
const token = process.env.TELEGRAM_HAPPIER_TRADING_BOT;
const bot = new TelegramBot(token, {
  polling: true,
});

bot.on("polling_error", (msg) => console.log(msg));

// ---------------------------------TELEGRAM-BOT------------------------------------//

// -------------------------- Binance Code Example ---------------
// Subscribe to the Binance websocket stream for the market price of BTCUSDT
let chat_id = 0;
let mileStone = 1;
let priceStone1 = 0;
let tokenPairs = "btcusdt";
let boughtPrice = 0;
let interval = null;
let sessionDownTrend = 0;
let objTrading = {
  allowBuy: false,
  specificTime: 0,
  specificMin: 0,
  isCompleteDefault: false,
  isCompleteInterval: false,
};
let priceStoneUpdated = 0;
let totalBalance = 0;
let quantityBuy = 0;
let secondBuy = {
  priceSold: 0,
  quantity: 0,
  priceBought: 0,
};
let numberStone = 12;
let isBuyDouble = false;

const targetTime = new Date();
targetTime.setHours(targetTime.getHours() + 1);

bot.onText(/\/start/, (msg) => {
  chat_id = msg.chat.id;
  console.log("chat_id", chat_id);
  bot.sendMessage(
    msg.chat.id,
    "Hello mate, wish your day will be greater than yesterday. Can i help you ?",
    {
      reply_markup: {
        keyboard: [
          [
            "Invest new token",
            "Find new token to invest",
            "Get balance information",
          ],
        ],
      },
    }
  );
});

bot.onText(/\/stop/, async (msg) => {
  tokenPairs = "BTCUSDT";
  await bot.sendMessage(msg.chat.id, "Stop bot successfully");
  await resetDefault();
  await closeInterval();
  if (bot.isPolling()) {
    await bot.stopPolling({ cancel: true });
  }
  //  ws.close()
});

const resetDefault = () => {
  mileStone = 1;
  priceStone1 = 0;
  boughtPrice = 0;
  chat_id = null;
  priceStoneUpdated = 0;
  sessionDownTrend = 0;
  objTrading = {
    allowBuy: false,
    specificTime: null,
    specificMin: null,
    isCompleteDefault: false,
    isCompleteInterval: false,
  };
  secondBuy = {
    priceSold: 0,
    quantity: 0,
    priceBought: 0,
  };
  isBuyDouble = false;
};

const closeInterval = () => {
  if (interval) {
    clearInterval(interval);
  }
};

bot.on("message", (msg) => {
  if (msg.text.toString().toLowerCase().indexOf("balance") !== -1) {
    binance.balance((error, balances) => {
      if (error) return console.error(error);
      let balanceResult = [];
      for (const x in balances) {
        if (parseFloat(balances[x].available) > 0) {
          balanceResult.push(`${x}: ${balances[x].available}`);
        }
      }
      const responseToUser = balanceResult.join(", ");
      bot.sendMessage(
        msg.chat.id,
        `Your balance information here: ${responseToUser}`
      );
    });
  }

  if (msg.text.toString().toLowerCase().indexOf("invest new token") !== -1) {
    bot.sendMessage(msg.chat.id, "Please type new token pairs to invest");
  }

  if (
    msg.text.toString().toLowerCase().indexOf("usdt") !== -1 &&
    msg.text.toString().toLowerCase().indexOf("pair") !== -1
  ) {
    getTotalBalance(binance, "USDT")
      .then(async (res) => {
        totalBalance = res;
        tokenPairs = msg.text.toString().split(":")[1].trim();
        const pairsPrice = await axios.get(
          `https://api.binance.com/api/v3/ticker/price?symbol=${tokenPairs.toUpperCase()}`
        );
        const first25Percent = Math.round(totalBalance * 0.5);
        quantityBuy = Math.round(
          first25Percent / parseFloat(pairsPrice.data.price)
        );

        binance
          .marketBuy(tokenPairs.toUpperCase(), quantityBuy)
          .then((res1) => {
            const boughtPriceFloat = parseFloat(res1?.fills[0]?.price);
            boughtPrice = parseFloat(boughtPriceFloat);
            priceStoneUpdated = parseFloat(boughtPriceFloat);
            priceStone1 =
              parseFloat(boughtPriceFloat) -
              parseFloat(boughtPriceFloat) * 0.12;
            // priceStoneHalf =
            //   parseFloat(boughtPriceFloat) - parseFloat(boughtPriceFloat) * 0.1;
            bot.sendMessage(
              chat_id,
              `Buy at price=${res1?.fills[0]?.price} and quantity_response=${quantityBuy}`
            );
            const connectAndListen = async () => {
              try {
                const result = await axios.get(
                  `https://api.binance.com/api/v3/ticker/price?symbol=${tokenPairs.toUpperCase()}`
                );
                await handleTrading(parseFloat(result?.data?.price));
              } catch (e) {
                console.log(e?.response?.data?.message);
              }
            };
            interval = setInterval(connectAndListen, 12000);
          })
          .catch((err) => {
            bot.sendMessage(chat_id, `Can not buy this pairs - ${err?.body}`);
          });
      })
      .catch((err) => {
        bot.sendMessage(chat_id, `Can not get total balance - ${err?.body}`);
      });
  }

  if (msg.text.toString().toLowerCase().indexOf("find new token") !== -1) {
    try {
      findNewTokenLongTerm(bot, chat_id, binance);
    } catch (e) {
      console.log(e.response);
      bot.sendMessage(chat_id, "Stop found.");
      return false;
    }
  }

  if (msg.text.toString().toLowerCase().indexOf("sold second") !== -1) {
    try {
      const totalQty = Math.round(
        secondBuy.quantity - secondBuy.quantity * 0.2
      );
      quantityBuy = secondBuy.quantity - totalQty;
      binance
        .marketSell(tokenPairs.toUpperCase(), totalQty)
        .then((res) => {
          secondBuy = {
            priceSold: 0,
            quantity: 0,
            priceBought: 0,
          };
          bot.sendMessage(
            chat_id,
            `Bán second_buy với giá: ${res.fills[0]?.price}, khối lượng: ${quantitySold}, mileStone=${mileStone}`
          );
        })
        .catch((err) => {
          bot.sendMessage(
            chat_id,
            `Sold side, can not sell pairs - ${err?.body}`
          );
        });
    } catch (e) {
      console.log(e.response);
      bot.sendMessage(chat_id, "Stop found.");
      return false;
    }
  }
});

// binance.marketSell('ADAUSDT', 10 )
// .then((res) => {
//   console.log(res)
// })
// .catch((err) => {
//   console.log(err)
// })
// getTotalBalance
// getTotalBalance(binance, "USDT")
//     .then(res => {
//       console.log(res)
//     })

const handleTrading = async (close_price) => {
  try {
    const latestPrice = parseFloat(close_price);
    const percentChange = (latestPrice / priceStoneUpdated - 1) * 100;
    const exactSpecificTime = objTrading.specificTime % 4;
    const exactUTCTime = new Date().getUTCHours() % 4;
    if (new Date().getUTCMinutes() !== objTrading.specificMin) {
      objTrading.allowBuy = false;
      objTrading.isCompleteInterval = false;
    } else if (
      exactSpecificTime === exactUTCTime &&
      new Date().getUTCMinutes() === objTrading.specificMin
    ) {
      objTrading.allowBuy = true;
    }

    //buy case
    if (
      objTrading.allowBuy &&
      objTrading.isCompleteDefault &&
      !objTrading.isCompleteInterval
    ) {
      const coupleFilterLatest = {
        startTime: new Date().getTime() - 4 * 60 * 60 * 1000,
        endTime: new Date().getTime(),
      };

      const rltLatest = await refetchGetVol({
        ...coupleFilterLatest,
        symbol: tokenPairs,
      });

      const coupleFilter8Hrs = {
        startTime: new Date().getTime() - 8 * 60 * 60 * 1000,
        endTime: new Date().getTime() - 4 * 60 * 60 * 1000,
      };

      const rlt8Hrs = await refetchGetVol({
        ...coupleFilter8Hrs,
        symbol: tokenPairs,
      });

      const percentChange =
        (latestPrice - parseFloat(rltLatest.closePrice)) /
        parseFloat(rltLatest.closePrice);

      if (percentChange < 4) {
        // IN CASE PERCENTCHANGE < 3
        sessionDownTrend += 1;
        objTrading.isCompleteInterval = true;
        bot.sendMessage(
          chat_id,
          `Downtrend - % THAY ĐỔI: ${percentChange}%, session_downtrend_count: ${sessionDownTrend}, GIÁ MỞ CỬA: ${rlt8Hrs.openPrice}, GIÁ ĐÓNG CỬA: ${rltLatest.closePrice}`
        );
      } else {
        // IN CASE PERCENTCHANGE >= 3
        objTrading.isCompleteInterval = true;
        const percentChangeVol =
          ((rltLatest.totalVolume - rlt8Hrs.totalVolume) /
            rltLatest.totalVolume) *
          100;

        const percentChangePrice =
          ((rltLatest.closePrice - rlt8Hrs.closePrice) / rltLatest.closePrice) *
          100;
        if (
          (sessionDownTrend >= 2 && percentChangePrice > 4) ||
          (sessionDownTrend >= 2 && percentChangeVol > 70)
        ) {
          sessionDownTrend = 0;

          if (isBuyDouble) {
            isBuyDouble = false;
            totalBalance = await getTotalBalance(binance, "USDT");
            const fullMoney = Math.round(totalBalance);
            const quantityBuySecond = Math.round(fullMoney / latestPrice);
            await binance
              .marketBuy(tokenPairs.toUpperCase(), quantityBuySecond)
              .then((res) => {
                secondBuy = {
                  priceSold:
                    parseFloat(res?.fills[0]?.price) -
                    parseFloat(res?.fills[0]?.price) * 0.12,
                  quantity: parseFloat(quantityBuySecond),
                  priceBought: parseFloat(res?.fills[0]?.price),
                };
                mileStone = 2;
                bot.sendMessage(
                  chat_id,
                  `MUA LẦN 2 - 50%, VỚI GIÁ: ${res?.fills[0]?.price}, SỐ LƯỢNG: ${quantityBuySecond}, PRICESTONE: ${priceStone1}, MILESTONE: ${mileStone}
              VÀ THÔNG TIN MUA LẦN 2: (priceSold: ${secondBuy.priceSold}, quantity: ${secondBuy.quantity})`
                );
              })
              .catch((err) => {
                bot.sendMessage(
                  chat_id,
                  `Can not buy this 50% pairs at the second time - ${err?.message}`
                );
              });
          } else if (mileStone === 1 && secondBuy.quantity === 0) {
            const fiftyPercent = Math.round(totalBalance * 0.5);
            const quantityBuySecond = Math.round(fiftyPercent / latestPrice);
            await binance
              .marketBuy(tokenPairs.toUpperCase(), quantityBuySecond)
              .then((res) => {
                secondBuy = {
                  priceSold:
                    parseFloat(res?.fills[0]?.price) -
                    parseFloat(res?.fills[0]?.price) * 0.12,
                  quantity: parseFloat(quantityBuySecond),
                  priceBought: parseFloat(res?.fills[0]?.price),
                };
                mileStone = 2;
                bot.sendMessage(
                  chat_id,
                  `MUA LẦN 2 - 50%, VỚI GIÁ: ${res?.fills[0]?.price}, SỐ LƯỢNG: ${quantityBuySecond}, PRICESTONE: ${priceStone1}, MILESTONE: ${mileStone}
                  VÀ THÔNG TIN MUA LẦN 2: (priceSold: ${secondBuy.priceSold}, quantity: ${secondBuy.quantity})`
                );
              })
              .catch((err) => {
                bot.sendMessage(
                  chat_id,
                  `Can not buy this 25% pairs at the second time - ${err?.message}`
                );
              });
          }
        }
        bot.sendMessage(
          chat_id,
          `Uptrend - % THAY ĐỔI: ${percentChange}%, session_downtrend_count: ${sessionDownTrend}, GIÁ MỞ CỬA: ${rlt8Hrs.openPrice}, GIÁ ĐÓNG CỬA: ${rltLatest.closePrice}`
        );
      }
    }

    const percentChangeDefault =
      ((latestPrice - boughtPrice) / boughtPrice) * 100;

    //-------------- CẬP NHẬT PRICESTONE VÀ MUA THÒNG --------------------//
    if (percentChange > 2) {
      priceStone1 = latestPrice - latestPrice * 0.12;
      await bot.sendMessage(
        chat_id,
        `Cập nhật pricestone: ${priceStone1}, latestPrice: ${latestPrice}, mileStone: ${mileStone}, secondBuy_priceSold: ${secondBuy.priceSold}`
      );
      priceStoneUpdated = latestPrice;
    }
    // ----------------------//------------------------//

    //----------------------- KHI GIÁ MỚI NHẤT <= PRICESTONE => BÁN HẾT + NGHỈ CHƠI---------------------------//

    let priceSecondChange =
      mileStone > 1 &&
      (latestPrice - secondBuy.priceBought) / secondBuy.priceBought >= 7.2
        ? true
        : false;
    let priceDefaultChange =
      mileStone === 1 && percentChangeDefault >= 7.2 ? true : false;

    if (
      latestPrice <= priceStone1 ||
      (mileStone === 2 && latestPrice <= secondBuy.priceSold)
    ) {
      const totalQty = Math.round(
        quantityBuy +
          secondBuy.quantity -
          (quantityBuy + secondBuy.quantity) * 0.2
      );
      await binance
        .marketSell(tokenPairs.toUpperCase(), totalQty)
        .then(async (res1) => {
          await bot.sendMessage(
            chat_id,
            `Sell all tokens with price ${res1?.fills[0]?.price}, quantity = ${totalQty}, mileStone = ${mileStone}`
          );
        })
        .catch((err) => {
          bot.sendMessage(
            chat_id,
            `Sold side, can not sell pairs - ${err?.body}`
          );
        });
      resetDefault();
      closeInterval();
    } else if (priceSecondChange || priceDefaultChange) {
      await binance
        .marketSell(tokenPairs.toUpperCase(), totalQty)
        .then(async (res1) => {
          await resetDefault();
          objTrading.isCompleteDefault = true;
          isBuyDouble = true;
          objTrading.specificTime = new Date().getUTCHours();
          objTrading.specificMin = new Date().getUTCMinutes();
          bot.sendMessage(
            chat_id,
            `Complete Default, PriceStone: ${priceStone1}, numberStone: ${numberStone}, mileStone: ${mileStone}, specificMin: ${objTrading.specificMin}, specificTime: ${objTrading.specificTime}`
          );
          await bot.sendMessage(
            chat_id,
            `Sell all tokens with price ${res1?.fills[0]?.price}, quantity = ${totalQty}, mileStone = ${mileStone}`
          );
        })
        .catch((err) => {
          bot.sendMessage(
            chat_id,
            `Sold side, can not sell pairs - ${err?.body}`
          );
        });
    } else if (
      mileStone === 1 &&
      latestPrice <= priceBought - priceBought * 0.06
    ) {
      // Bán 1 nửa vol khi giá giảm 50% so với lúc mua
      const halfQty = Math.round(totalBalance - totalBalance * 0.05);
      await binance
        .marketSell(tokenPairs.toUpperCase(), halfQty)
        .then(async (res1) => {
          totalQty -= halfQty;
          objTrading.isCompleteDefault = true;
          objTrading.specificTime = new Date().getUTCHours();
          objTrading.specificMin = new Date().getUTCMinutes();
          sessionDownTrend = 1;
          await bot.sendMessage(
            chat_id,
            `Waiting for 4 hours - Session_down_trend = ${sessionDownTrend} - Sell 50% tokens with price ${res1?.fills[0]?.price}, quantity = ${halfQty}, mileStone = ${mileStone}, rest_quantity = ${totalQty}`
          );
        });
    } else if (mileStone === 2) {
      // -----------------KHI ĐANG Ở BƯỚC 2 MÀ GIÁ MỚI NHẤT <= GIÁ VỪA MUA THÊM ===> BÁN SỐ LƯỢNG VỪA MUA THÊM ===> GIẢM MILESTONE = 1-------------------//
      if (latestPrice <= secondBuy.priceBought - secondBuy.priceBought * 0.06) {
        const halfQtySecondBuy = secondBuy.quantity - secondBuy.quantity * 0.05;
        secondBuy.quantity = secondBuy.quantity - halfQtySecondBuy;
        await binance
          .marketSell(tokenPairs.toUpperCase(), halfQty)
          .then(async (res1) => {
            objTrading.isCompleteDefault = true;
            objTrading.specificTime = new Date().getUTCHours();
            objTrading.specificMin = new Date().getUTCMinutes();
            sessionDownTrend += 1;
            await bot.sendMessage(
              chat_id,
              `Waiting for 4 hours - Session_down_trend = ${sessionDownTrend} - Sell 50% tokens with price ${res1?.fills[0]?.price}, quantity = ${halfQty}, mileStone = ${mileStone}, rest_quantity = ${totalQty}`
            );
          });
      } else if (latestPrice <= secondBuy.priceSold) {
        const quantity = Math.round(secondBuy.quantity * 0.2);
        await binance
          .marketSell(tokenPairs.toUpperCase(), quantity)
          .then((res1) => {
            bot.sendMessage(
              chat_id,
              `BÁN LƯỢNG TOKENS ĐÃ MUA Ở BƯỚC 2 VỚI GIÁ: ${res1?.fills[0]?.price}, SỐ LƯỢNG: ${totalQty}, MILESTONE = ${mileStone}`
            );
            secondBuy = {
              priceSold: 0,
              quantity: 0,
              priceBought: 0,
            };
            mileStone = 1;
          })
          .catch((err) => {
            bot.sendMessage(
              chat_id,
              `Sold side, can not sell pairs - ${err?.body}`
            );
          });
      }
      // ------------------------//-----------------------//--------------------
    }
  } catch (err) {
    console.log("something");
  }
};

const server = require("http").createServer(app);

// io.on((socket, next) => {

// })

const port = process.env.NODE_PORT;
server.listen(port, () => {
  console.log(`Let's trade now at ${port}`);
});
