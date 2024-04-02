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
  useServerTime: true,
  reconnect: true,
  family: 4,
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

// binance.balance((error, balances) => {
//   if ( error ) return console.error(error);
//   console.info("balances()", balances);
//   console.info("ETH balance: ", balances.ETH.available);
// });

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
let loseBuy = 0;
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
};
let numberStone = 10;
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
  await closeInterval()
  if (bot.isPolling()) {
    await bot.stopPolling({ cancel: true });
  }
  //  ws.close()
});

const resetDefault = () => {
  mileStone = 1;
  loseBuy = 0;
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
        const first25Percent = Math.round(totalBalance * 0.25);
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
              parseFloat(boughtPriceFloat) - parseFloat(boughtPriceFloat) * 0.12;
              loseBuy = parseFloat(boughtPriceFloat) - parseFloat(boughtPriceFloat) * 0.6;
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
                handleTrading(parseFloat(result?.data?.price));
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
      const totalQty = Math.round(secondBuy.quantity - secondBuy.quantity * 0.2);
      quantityBuy = secondBuy.quantity - totalQty;
      binance
        .marketSell(tokenPairs.toUpperCase(), totalQty)
        .then((res) => {
          secondBuy = {
            priceSold: 0,
            quantity: 0,
          };
          loseBuy = 0
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
      bot.sendMessage("Stop found.");
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
// getTotalBalance(binance, "LQTY")
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

      if (percentChange < 3) {
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

          if (mileStone === 1 && isBuyDouble) {
            isBuyDouble = false;
            totalBalance = await getTotalBalance(binance, "USDT");
            const fiftyPercent = Math.round(totalBalance * 0.5);
            const quantityBuySecond = Math.round(fiftyPercent / latestPrice);
            await binance
              .marketBuy(tokenPairs.toUpperCase(), quantityBuySecond)
              .then((res) => {
                secondBuy = {
                  priceSold:
                    parseFloat(res?.fills[0]?.price) -
                    parseFloat(res?.fills[0]?.price) * 0.05,
                  quantity: parseFloat(quantityBuySecond),
                };
                bot.sendMessage(
                  chat_id,
                  `MUA LẦN 2 - 50%, VỚI GIÁ: ${res?.fills[0]?.price}, SỐ LƯỢNG: ${quantityBuySecond}, PRICESTONE: ${priceStone1},
              VÀ THÔNG TIN MUA LẦN 2: (priceSold: ${secondBuy.priceSold}, quantity: ${secondBuy.quantity})`
                );
              })
              .catch((err) => {
                bot.sendMessage(
                  chat_id,
                  `Can not buy this 25% pairs at the second time - ${err?.message}`
                );
              });
          } else if (mileStone === 1 && secondBuy.quantity === 0) {
            const twentyFivePercent = Math.round(totalBalance * 0.25);
            const quantityBuySecond = Math.round(
              twentyFivePercent / latestPrice
            );
            await binance
              .marketBuy(tokenPairs.toUpperCase(), quantityBuySecond)
              .then((res) => {
                secondBuy = {
                  priceSold:
                    parseFloat(res?.fills[0]?.price) -
                    parseFloat(res?.fills[0]?.price) * 0.05,
                  quantity: parseFloat(quantityBuySecond),
                };
                mileStone = 2;
                bot.sendMessage(
                  chat_id,
                  `MUA LẦN 2 VỚI GIÁ: ${res?.fills[0]?.price}, SỐ LƯỢNG: ${quantityBuySecond}, PRICESTONE: ${priceStone1},
              VÀ THÔNG TIN MUA LẦN 2: (priceSold: ${secondBuy.priceSold}, quantity: ${secondBuy.quantity})`
                );
              })
              .catch((err) => {
                bot.sendMessage(
                  chat_id,
                  `Can not buy this 25% pairs at the second time - ${err?.message}`
                );
              });
          } else if (mileStone === 2) {
            const fiftyPercent = Math.round(totalBalance * 0.25);
            const quantityBuyThird = Math.round(fiftyPercent / latestPrice);
            await binance
              .marketBuy(tokenPairs.toUpperCase(), quantityBuyThird)
              .then((res) => {
                mileStone = 3;
                secondBuy = {
                  priceSold:
                    parseFloat(res?.fills[0]?.price) -
                    parseFloat(res?.fills[0]?.price) * 0.05,
                  quantity: quantityBuyThird,
                };
                bot.sendMessage(
                  chat_id,
                  `MUA LẦN 3 VỚI GIÁ: ${res?.fills[0]?.price}, KHỐI LƯỢNG: 25% - SỐ LƯỢNG: ${quantityBuyThird}, priceStone: ${priceStone1},
              Third_buy_info: ( priceSold: ${secondBuy.priceSold}, quantity: ${secondBuy.quantity} )`
                );
              })
              .catch((err) => {
                bot.sendMessage(
                  chat_id,
                  `Can not buy this 25% pairs at the third time - ${err?.message}`
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
     if (mileStone === 1) {
      //-----KHI ĐANG Ở MILESTONE = 1, GIÁ THỤT 1 NỬA SO VỚI LÚC MUA VÀ SECONDBUY.QUANTITY = 0-----//
      if (
        latestPrice <= loseBuy &&
        secondBuy.quantity === 0
      ) {
        //mua tiep 25% khi dang lỗ 7% ở bước 1
        const twentyFivePercent = Math.round(totalBalance * 0.25);
        const quantityBuySecond = Math.round(twentyFivePercent / latestPrice);
        await binance
          .marketBuy(tokenPairs.toUpperCase(), quantityBuySecond)
          .then((res) => {
            secondBuy = {
              priceSold:
                parseFloat(res?.fills[0]?.price) -
                parseFloat(res?.fills[0]?.price) * 0.06,
              quantity: parseFloat(quantityBuySecond),
            };
            bot.sendMessage(
              chat_id,
              `Mua THÒNG với giá: ${res?.fills[0]?.price}, Khối lượng: 25% - Số lượng: ${quantityBuySecond}, priceStone: ${priceStone1},
            Second_buy_info: (priceSold: ${secondBuy.priceSold}, quantity: ${secondBuy.quantity})`
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
    //   //---------------------//--------------------//--------------------//--------------------
    // }
    else if (mileStone === 2) {
      numberStone = 10;
    } else if (mileStone === 3) {
      numberStone = 5;
    }

    //-------------- CẬP NHẬT PRICESTONE VÀ MUA THÒNG --------------------//
    if (percentChange > 1.05) {
      priceStone1 = latestPrice - latestPrice * (numberStone / 100);

      //Cập nhật mua thòng bước 1
      if (mileStone === 1 && secondBuy.quantity !== 0) {
        secondBuy.priceSold = latestPrice - latestPrice * 0.06;
      } else if(mileStone === 1 && secondBuy.quantity === 0) {
        loseBuy = latestPrice - latestPrice * 0.06
      }
      await bot.sendMessage(
        chat_id,
        `Cập nhật pricestone: ${priceStone1}, latestPrice: ${latestPrice}, mileStone: ${mileStone}, secondBuy_priceSold: ${secondBuy.priceSold}`
      );
      priceStoneUpdated = latestPrice;
    }
    // ----------------------//------------------------//

    //----------------------- KHI GIÁ MỚI NHẤT <= PRICESTONE => BÁN HẾT + NGHỈ CHƠI---------------------------//
    if (
      latestPrice <= priceStone1 ||
      (mileStone === 3 && latestPrice <= secondBuy.priceSold) ||
      (percentChangeDefault >= 7.2 && mileStone === 1)
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

          if (percentChangeDefault >= 7 && mileStone === 1) {
            await resetDefault();
            objTrading.isCompleteDefault = true;
            isBuyDouble = true;
            objTrading.specificTime = new Date().getUTCHours();
            objTrading.specificMin = new Date().getUTCMinutes();
            bot.sendMessage(
              chat_id,
              `Complete Default, PriceStone: ${priceStone1}, numberStone: ${numberStone}, mileStone: ${mileStone}, specificMin: ${objTrading.specificMin}, specificTime: ${objTrading.specificTime}`
            );
          } else {
            await resetDefault();
            await closeInterval();
          }
        })
        .catch((err) => {
          bot.sendMessage(
            chat_id,
            `Sold side, can not sell pairs - ${err?.body}`
          );
        });
      //-----------------------------//----------------------------//
    } else if (mileStone === 2) {
      // -----------------KHI ĐANG Ở BƯỚC 2 MÀ GIÁ MỚI NHẤT <= GIÁ VỪA MUA THÊM ===> BÁN SỐ LƯỢNG VỪA MUA THÊM ===> GIẢM MILESTONE = 1-------------------//
      if (latestPrice <= secondBuy.priceSold) {
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
    } else if (mileStone === 1 && latestPrice <= secondBuy.priceSold) {
      // KHI ĐANG Ở BƯỚC 1 VÀ GIÁ MỚI NHẤT <= GIÁ MUA THÒNG ====> BÁN MUA THÒNG
      await binance
        .marketSell(tokenPairs.toUpperCase(), secondBuy.quantity)
        .then((res) => {
          secondBuy = {
            priceSold: 0,
            quantity: 0,
          };
          bot.sendMessage(
            chat_id,
            `Bán mua THÒNG bước 1 với giá: ${res.fills[0]?.price}, khối lượng: ${quantitySold}, mileStone=${mileStone}`
          );
        });
      // ---------------------------//----------------------//-----------------
    }
  } catch (err) {
    console.log("something");
  }
};

const server = require("http").createServer(app);

// io.on((socket, next) => {

// })

const port = process.env.PORT || process.env.NODE_PORT;
server.listen(port, () => {
  console.log(`Let's trade now at ${port}`);
});
