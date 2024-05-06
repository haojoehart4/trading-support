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
let priceStoneUpdated = 0;
let totalBalance = 0;
let quantityBuy = 0;
let tokenDefault = {};

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
            "Track price",
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
};

const closeInterval = () => {
  if (interval) {
    clearInterval(interval);
  }
};

bot.on("message", (msg) => {
  if (msg.text.toString().toLowerCase().indexOf("balance") !== -1) {
    try {
      getTotalBalance(binance, "USDT").then((res) => {
        bot.sendMessage(msg.chat.id, `Your balance in  formation here: ${res}`);
      });
    } catch (err) {
      console.log(err);
    }
  }

  //1
  if (msg.text.toString().toLowerCase().indexOf("track") !== -1) {
    bot.sendMessage(msg.chat.id, `Please typing token`);
  }

  if (msg.text.toString().toLowerCase().indexOf("token") !== -1) {
    try {
      const tokenGot = msg.text.toString().split(":")[1].trim();
      const capitalizeLetter = tokenGot.toUpperCase();

      axios
        .get(
          `https://api.binance.com/api/v3/ticker/price?symbol=${capitalizeLetter}`
        )
        .then((res) => {
          tokenDefault = {
            symbol: res?.data?.symbol,
            price: parseFloat(res?.data?.price),
            priceStone:
              parseFloat(res?.data?.price) -
              parseFloat(res?.data?.price) * 0.15,
            priceStoneUpdated: parseFloat(res?.data?.price)
          };
          bot.sendMessage(msg.chat.id, `Please type quantity`);
        });
    } catch (e) {
      console.log(e.response);
      bot.sendMessage(chat_id, "Stop found.");
      return false;
    }
  }

  if (msg.text.toString().toLowerCase().indexOf("quantity") !== -1) {
    const priceStr = msg.text.toString().split(":")[1].trim();
    tokenDefault.quantity = Math.round(parseFloat(priceStr));
    bot.sendMessage(
      msg.chat.id,
      `Symbol: ${tokenDefault.symbol}, price: ${tokenDefault.price}, priceStone: ${tokenDefault.priceStone}, quantity: ${tokenDefault.quantity}`
    );
    const connectAndListen = async () => {
      try {
        const result = await axios.get(
          `https://api.binance.com/api/v3/ticker/price?symbol=${tokenDefault.symbol}`
        );
        await handleTrading(parseFloat(result.data.price));
      } catch (e) {
        console.log(e?.response?.data?.message);
      }
    };
    interval = setInterval(connectAndListen, 10000);
  }
});

const handleTrading = async (latestPrice) => {
  try {
    const percentChange = (latestPrice / tokenDefault.priceStoneUpdated - 1) * 100;
    if (latestPrice <= tokenDefault.priceStone) {
      const qtyPayload = Math.round(tokenDefault.quantity - tokenDefault.quantity * 0.2);
      await binance
        .marketSell(elm.symbol.toUpperCase(), qtyPayload)
        .then((res) => {
          closeInterval()
          resetDefault()
          bot.sendMessage(
            chat_id,
            `Bán token: ${latestPrice} với giá: ${res.fills[0]?.price}, khối lượng: ${qtyPayload}`
          );
        });
    } else {
      //-------------- CẬP NHẬT PRICESTONE VÀ MUA THÒNG --------------------//
      if (percentChange > 2) {
        tokenDefault.priceStone = latestPrice - latestPrice * 0.15;
        await bot.sendMessage(
          chat_id,
          `Cập nhật pricestone - Symbol: ${tokenDefault.symbol}, price: ${latestPrice}, priceStone: ${tokenDefault.priceStone}, quantity: ${tokenDefault.quantity}`
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
