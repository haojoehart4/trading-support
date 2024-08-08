const express = require("express");
const app = express();
const crypto = require("crypto");
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
});

// binance.useServerTime()

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

// binance.balance((error, balances) => {
//   if ( error ) return console.error(error);
//   console.info("balances()", balances);
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
let numberStone = 20;
let mileStone = 1;
let priceStone1 = 0;
let tokenPairs = [];
let boughtPrice = 0;
let interval = null;
let tokenDefault = {};
let times = 0;
let ratio = 1;

bot.onText(/\/start/, (msg) => {
  chat_id = msg.chat.id;
  console.log("chat_id", chat_id);
  bot.sendMessage(
    msg.chat.id,
    "Hello mate, wish your day will be greater than yesterday. Can i help you ?",
    {
      reply_markup: {
        keyboard: [
          ["Invest new token", "Get balance information", "price_bought", "set_rt"],
        ],
      },
    }
  );
});

// binance.futuresOpenOrders().then((res) => {
//   console.log('res', res)
// });

bot.onText(/\/stop/, async (msg) => {
  tokenPairs = "BTCUSDT";
  await bot.sendMessage(msg.chat.id, "Stop bot successfully");
  await resetDefault();
  await closeInterval();
  // if (bot.isPolling()) {
  //   await bot.stopPolling({ cancel: true });
  // }
  //  ws.close()
});

const resetDefault = () => {
  mileStone = 1;
  priceStone1 = 0;
  boughtPrice = 0;
  chat_id = null;
  priceStoneUpdated = 0;
  numberStone = 0;
  tokenDefault = {};
  tokenPairs = [];
  times = 0;
  ratio = 0
};

const closeInterval = () => {
  if (interval) {
    clearInterval(interval);
  }
};

bot.on("message", (msg) => {
  if (msg.text.toString().toLowerCase().indexOf("balance") !== -1) {
    try {
      binance.futuresBalance().then((res) => {
        const USDT = res?.find((item) => item.asset === "USDT")?.balance;
        bot.sendMessage(chat_id, USDT);
      });

      // getTotalBalance(binance, "USDT").then((res) => {
      //   bot.sendMessage(msg.chat.id, `Your balance in  formation here: ${res}`);
      // });
    } catch (err) {
      console.log(err);
    }
  }

  //1

  if (msg.text.toString().toLowerCase().indexOf("set_rt") !== -1) {
    bot.sendMessage(msg.chat.id, `Please typing ratio`);
  }

  if (msg.text.toString().toLowerCase().indexOf("ratio") !== -1) {
    ratio = parseFloat(msg.text.toString().split(":")[1].trim());
  }

  if (msg.text.toString().toLowerCase().indexOf("bought") !== -1) {
    const priceGot = parseFloat(msg.text.toString().split(":")[1].trim());
    tokenDefault.price = priceGot
    tokenDefault.priceStoneUpdated = priceGot
    tokenDefault.priceStone = priceGot - (priceGot * (ratio/100));
    bot.sendMessage(msg.chat.id, `Please typing token`);
  }

  // if (msg.text.toString().toLowerCase().indexOf("start_bot") !== -1) {
  //   bot.sendMessage(msg.chat.id, `Please typing token`);
  // }

  if (msg.text.toString().toLowerCase().indexOf("times") !== -1) {
    const timesGot = parseFloat(msg.text.toString().split(":")[1].trim());
    times = timesGot
  }

  if (msg.text.toString().toLowerCase().indexOf("token") !== -1) {
    try {
      const tokenGot = msg.text.toString().split(":")[1].trim();
      const capitalizeLetter = tokenGot.toUpperCase();
      tokenDefault.symbol = capitalizeLetter
      bot.sendMessage(
        msg.chat.id,
        `Symbol: ${tokenDefault.symbol}, Price: ${tokenDefault.price}, PriceStone: ${tokenDefault.priceStone},
        PriceStone Updated: ${tokenDefault.priceStoneUpdated}`
      );

      const connectAndListen = async () => {
        try {
          const result = await binance.futuresPrices();
          await handleTrading(parseFloat(result[tokenDefault.symbol]));
        } catch (e) {
          console.log(e?.response?.data?.message);
        }
      };
      interval = setInterval(connectAndListen, 10000);
    } catch (e) {
      console.log(e.response);
      bot.sendMessage(chat_id, "Stop found.");
      return false;
    }
  }
});

const handleTrading = async (latestPrice) => {
  try {
    const percentChange =
      (latestPrice / tokenDefault.priceStoneUpdated - 1) * 100;
    if (latestPrice <= tokenDefault.priceStone) {
      await binance.futuresPositionRisk().then((res) => {
        const tokenInfo = res.find(
          (position) => position.symbol === tokenDefault.symbol
        );
        const qty = tokenInfo?.positionAmt;
        binance
          .futuresMultipleOrders([
            {
              symbol: tokenInfo,
              side: "SELL",
              // positionSide: "LONG",
              type: "MARKET",
              quantity: qty,
            },
          ])
          .then((res) => {
            closeInterval();
            resetDefault();
            bot.sendMessage(
              chat_id,
              `Đóng lệnh: Với giá: ${latestPrice}`
            );
          });
      });
    } else {
      //-------------- CẬP NHẬT PRICESTONE VÀ MUA THÒNG --------------------//
      if (percentChange > 1.5) {
        tokenDefault.priceStone = latestPrice - (latestPrice * (ratio / 100));
        await bot.sendMessage(
          chat_id,
          `Cập nhật pricestone - Symbol: ${tokenDefault.symbol}, price: ${latestPrice}, priceStone: ${tokenDefault.priceStone}, ratio: ${ratio}`
        );
        tokenDefault.priceStoneUpdated = latestPrice;
      }
    }
  } catch (err) {
    console.log("error_ne", err);
  }
};

const server = require("http").createServer(app);

// io.on((socket, next) => {

// })

const port = process.env.PORT || process.env.NODE_PORT;
server.listen(port, () => {
  console.log(`Let's trade now at ${port}`);
});


//response close
// {
//   orderId: 33199434685,
//   symbol: "LINKUSDT",
//   status: "NEW",
//   clientOrderId: "5FtquXu7NdnnFFqPNeugRK",
//   price: "0.000",
//   avgPrice: "0.00",
//   origQty: "19.37",
//   executedQty: "0.00",
//   cumQty: "0.00",
//   cumQuote: "0.00000",
//   timeInForce: "GTC",
//   type: "MARKET",
//   reduceOnly: false,
//   closePosition: false,
//   side: "SELL",
//   positionSide: "BOTH",
//   stopPrice: "0.000",
//   workingType: "CONTRACT_PRICE",
//   priceProtect: false,
//   origType: "MARKET",
//   priceMatch: "NONE",
//   selfTradePreventionMode: "NONE",
//   goodTillDate: 0,
//   updateTime: 1720424953008,
// }



// response current
// {
//   symbol: "LINKUSDT",
//   positionAmt: "19.37",
//   entryPrice: "13.074",
//   breakEvenPrice: "13.080537",
//   markPrice: "12.60444730",
//   unRealizedProfit: "-9.09523579",
//   liquidationPrice: "10.20082915",
//   leverage: "10",
//   maxNotionalValue: "1000000",
//   marginType: "cross",
//   isolatedMargin: "0.00000000",
//   isAutoAddMargin: "false",
//   positionSide: "BOTH",
//   notional: "244.14814420",
//   isolatedWallet: "0",
//   updateTime: 1720319863959,
//   isolated: false,
//   adlQuantile: 2,
// }
