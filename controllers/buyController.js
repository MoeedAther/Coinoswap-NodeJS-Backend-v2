import prisma from "../database/prisma.js";
import axios from "axios";

class buyController {
  // This controller is responsible for updating buy/sell coins into buy sell table
  static updateCoins = async (req, res) => {
    try {
      // ---------- API CALLS ----------
      const finchpayResp = await axios.get(
        "https://api.finchpay.io/v1/currencies",
        {
          headers: {
            Accept: "application/json",
            "x-api-key": process.env.FINCHPAY,
          },
        }
      );

      const guardarianResp = await axios.get(
        "https://api-payments.guardarian.com/v1/currencies?available=true",
        {
          headers: {
            Accept: "application/json",
            "x-api-key": process.env.GUARDARIAN,
          },
        }
      );

      const guardarianFiatCoins = guardarianResp.data.fiat_currencies;
      const guardarianCryptoCoins = guardarianResp.data.crypto_currencies;

      const finchCoins = finchpayResp.data;

      let fiatCoins = [];
      let cryptoCoins = [];

      let mappedFiat = [];
      let mappedCrypto = [];

      // ---------- BUILD COIN OBJECTS ----------

      for (const f of finchCoins) {
        if (f.is_fiat) {
          fiatCoins.push({
            standardTicker: f.ticker.toLowerCase(),
            ticker: f.ticker,
            name: f.name,
            network: null,
            image: `https://finchpay.io/static/assets/${f.ticker.toLowerCase()}.svg`,
            buyPartner: "finchpay",
            mappedPartners: [],
            data: f,
            isFiat: true,
            isApproved: 0,
            isMapped: 0,
            isStandard: 0,
          });
        } else {
          cryptoCoins.push({
            standardTicker:
              f.ticker.toLowerCase() +
              (f.network ? f.network.toLowerCase() : f.ticker.toLowerCase()),
            ticker: f.ticker.toLowerCase(),
            name: f.name,
            network: f.network,
            image: `https://finchpay.io/static/assets/${f.ticker.toLowerCase()}.svg`,
            buyPartner: "finchpay",
            mappedPartners: [],
            data: f,
            isFiat: false,
            isApproved: 0,
            isMapped: 0,
            isStandard: 0,
          });
        }
      }

      for (const d of guardarianFiatCoins) {
        for (const n of d.networks) {
          fiatCoins.push({
            standardTicker: d.ticker.toLowerCase(),
            ticker: d.ticker,
            name: d.name,
            network: null,
            image: `https://guardarian.com/${n.logo_url}`,
            buyPartner: "guardarian",
            mappedPartners: [],
            data: d,
            isFiat: true,
            isApproved: false,
            isMapped: false,
            isStandard: false,
          });
        }
      }

      for (const d of guardarianCryptoCoins) {
        for (const n of d.networks) {
          cryptoCoins.push({
            standardTicker: d.ticker.toLowerCase() + n.network.toLowerCase(),
            ticker: d.ticker,
            name: d.name,
            network: n.network,
            image: `https://guardarian.com/${n.logo_url}`,
            buyPartner: "guardarian",
            mappedPartners: [],
            data: d,
            isFiat: false,
            isApproved: false,
            isMapped: false,
            isStandard: false,
          });
        }
      }

      let fiatKeys = new Set();

      // ---------- GROUP SIMILAR FIAT COINS ----------
      for (const coin of fiatCoins) {
        const key = coin.standardTicker;

        if (fiatKeys.has(key)) continue;

        let alikeCoins = fiatCoins.filter((c) => c.standardTicker === key);

        if (alikeCoins.length > 1) {
          let baseCoin = {
            ...alikeCoins[0],
            mappedPartners: [],
          };

          for (const a of alikeCoins) {
            baseCoin.mappedPartners.push({
              buyPartner: a.buyPartner,
              ticker: a.ticker,
              name: a.name,
              network: null,
              isFiat: true,
            });
          }

          baseCoin.buyPartner = null;
          baseCoin.data = null;
          baseCoin.isStandard = true;

          mappedFiat.push(baseCoin);
        }

        fiatKeys.add(key);
      }

      let cryptoKeys = new Set();

      // ---------- GROUP SIMILAR CRYPTO COINS ----------
      for (const coin of cryptoCoins) {
        const key = coin.standardTicker;

        if (cryptoKeys.has(key)) continue;

        let alikeCoins = cryptoCoins.filter((c) => c.standardTicker === key);

        if (alikeCoins.length > 1) {
          let baseCoin = {
            ...alikeCoins[0],
            mappedPartners: [],
          };

          for (const a of alikeCoins) {
            baseCoin.mappedPartners.push({
              buyPartner: a.buyPartner,
              ticker: a.ticker,
              name: a.name,
              network: a.network,
              isFiat: false,
            });
          }

          baseCoin.buyPartner = null;
          baseCoin.data = null;
          baseCoin.isStandard = true;
          mappedCrypto.push(baseCoin);
        }

        cryptoKeys.add(key);
      }

      // ---------- COUNTERS ----------
      let updatedStandard = 0;
      let insertedStandard = 0;
      let insertedNormal = 0;

      // ---------- PROCESS STANDARD FIAT COINS ----------
      for (const m of mappedFiat) {
        const coin = await prisma.buy_crypto.findMany({
          where: {
            standardTicker: m.standardTicker,
            isStandard: true,
          },
        });

        if (coin.length > 1) {
          return res.status(500).json({
            success: false,
            message: "Multiple mapped standard coins found",
            error: "Duplicate standard coins in database",
          });
        }

        if (coin.length === 1) {
          // Update existing standard coin
          let dbPartners = JSON.parse(coin[0].mappedPartners || "[]");

          const missingPartners = m.mappedPartners.filter(
            (mp) => !dbPartners.some((db) => db.buyPartner === mp.buyPartner)
          );

          if (missingPartners.length > 0) {
            const combinedPartners = dbPartners.concat(missingPartners);

            await prisma.buy_crypto.update({
              where: { id: coin[0].id },
              data: {
                mappedPartners: JSON.stringify(combinedPartners),
              },
            });
            updatedStandard++;
          }
        } else {
          // Insert new standard coin
          await prisma.buy_crypto.create({
            data: {
              standardTicker: m.standardTicker,
              ticker: m.ticker,
              name: m.name,
              network: m.network,
              image: m.image,
              buyPartner: m.buyPartner,
              mappedPartners: JSON.stringify(m.mappedPartners),
              isFiat: m.isFiat,
              isApproved: true,
              isStandard: true,
            },
          });
          insertedStandard++;
        }
      }

      // ---------- PROCESS STANDARD CRYPTO COINS ----------
      for (const m of mappedCrypto) {
        const coin = await prisma.buy_crypto.findMany({
          where: {
            standardTicker: m.standardTicker,
            isStandard: true,
          },
        });

        if (coin.length > 1) {
          return res.status(500).json({
            success: false,
            message: "Multiple mapped standard coins found",
            error: "Duplicate standard coins in database",
          });
        }

        if (coin.length === 1) {
          // Update existing standard coin
          let dbPartners = JSON.parse(coin[0].mappedPartners || "[]");

          const missingPartners = m.mappedPartners.filter(
            (mp) => !dbPartners.some((db) => db.buyPartner === mp.buyPartner)
          );

          if (missingPartners.length > 0) {
            const combinedPartners = dbPartners.concat(missingPartners);

            await prisma.buy_crypto.update({
              where: { id: coin[0].id },
              data: {
                mappedPartners: JSON.stringify(combinedPartners),
              },
            });
            updatedStandard++;
          }
        } else {
          // Insert new standard coin
          await prisma.buy_crypto.create({
            data: {
              standardTicker: m.standardTicker,
              ticker: m.ticker,
              name: m.name,
              network: m.network,
              image: m.image,
              buyPartner: m.buyPartner,
              mappedPartners: JSON.stringify(m.mappedPartners),
              isFiat: m.isFiat,
              isApproved: true,
              isStandard: true,
            },
          });
          insertedStandard++;
        }
      }

      // ---------- PROCESS NON-STANDARD CRYPTO COINS ----------
      for (const c of fiatCoins) {
        const coin = await prisma.buy_crypto.findMany({
          where: {
            standardTicker: c.standardTicker,
            buyPartner: c.buyPartner,
            isStandard: false,
          },
        });

        if (coin.length === 0) {
          await prisma.buy_crypto.create({
            data: {
              standardTicker: c.standardTicker,
              ticker: c.ticker,
              name: c.name,
              network: c.network,
              image: c.image,
              buyPartner: c.buyPartner,
              data: JSON.stringify(c.data),
              isFiat: c.isFiat,
              isApproved: false,
              isStandard: false,
            },
          });

          insertedNormal++;
        }
      }

      // ---------- PROCESS NON-STANDARD CRYPTO COINS ----------
      for (const c of cryptoCoins) {
        const coin = await prisma.buy_crypto.findMany({
          where: {
            standardTicker: c.standardTicker,
            buyPartner: c.buyPartner,
            isStandard: false,
          },
        });

        if (coin.length === 0) {
          await prisma.buy_crypto.create({
            data: {
              standardTicker: c.standardTicker,
              ticker: c.ticker,
              name: c.name,
              network: c.network,
              image: c.image,
              buyPartner: c.buyPartner,
              data: JSON.stringify(c.data),
              isFiat: c.isFiat,
              isApproved: false,
              isStandard: false,
            },
          });

          insertedNormal++;
        }
      }

      return res.status(201).json({
        success: true,
        message: `Coins processed successfully. Total Inserted: ${
          insertedStandard + insertedNormal
        }, Total Updated: ${updatedStandard}.`,
        updatedStandard,
        insertedStandard,
        insertedNormal,
        totalInserted: insertedStandard + insertedNormal,
        totalUpdated: updatedStandard,
      });
    } catch (error) {
      console.log(error);
      // ---------- ERROR HANDLING ----------
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while processing coin data",
      });
    }
  };

  // Create or Delete Standard Coin
  static createStandardCoin = async (req, res) => {
    try {
      // ---------- CHECK AUTHENTICATION ----------
      if (!req.session.adminId) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const { action, unstandardCoinId, standardCoinId } = req.body;

      // ---------- VALIDATE INPUT ----------
      if (!action) {
        return res.status(400).json({
          success: false,
          message: "action is required (create or delete)",
        });
      }

      if (!["create", "delete"].includes(action)) {
        return res.status(400).json({
          success: false,
          message: "Invalid action. Must be 'create' or 'delete'",
        });
      }

      // ---------- CREATE STANDARD COIN ----------
      if (action === "create") {
        if (!unstandardCoinId) {
          return res.status(400).json({
            success: false,
            message: "unstandardCoinId is required for create action",
          });
        }

        // Fetch unstandard coin
        const unstandardCoin = await prisma.buy_crypto.findFirst({
          where: {
            id: parseInt(unstandardCoinId),
            isStandard: false,
          },
        });

        if (!unstandardCoin) {
          return res.status(404).json({
            success: false,
            message: "Unstandard coin not found",
          });
        }

        // Check if standard coin already exists
        const existingStandardCoin = await prisma.buy_crypto.findFirst({
          where: {
            standardTicker: unstandardCoin.standardTicker,
            isStandard: true,
          },
        });

        if (existingStandardCoin) {
          return res.status(400).json({
            success: false,
            message: `A standard coin with standardTicker '${unstandardCoin.standardTicker}' already exists`,
            existingStandardCoin: {
              id: existingStandardCoin.id,
              ticker: existingStandardCoin.ticker,
              name: existingStandardCoin.name,
              network: existingStandardCoin.network,
              standardTicker: existingStandardCoin.standardTicker,
            },
          });
        }

        // Create standard coin
        const mappedPartners = [
          {
            buyPartner: unstandardCoin.buyPartner,
            ticker: unstandardCoin.ticker,
            name: unstandardCoin.name,
            network: unstandardCoin.network,
            isFiat: unstandardCoin.isFiat,
          },
        ];

        const newStandardCoin = await prisma.buy_crypto.create({
          data: {
            standardTicker: unstandardCoin.standardTicker,
            ticker: unstandardCoin.ticker,
            name: unstandardCoin.name,
            network: unstandardCoin.network,
            image: unstandardCoin.image,
            buyPartner: null,
            mappedPartners: JSON.stringify(mappedPartners),
            isFiat: unstandardCoin.isFiat,
            isApproved: true,
            isStandard: true,
          },
        });

        return res.status(201).json({
          success: true,
          message: "Standard coin created successfully",
          standardCoin: {
            id: newStandardCoin.id,
            standardTicker: newStandardCoin.standardTicker,
            ticker: newStandardCoin.ticker,
            name: newStandardCoin.name,
            network: newStandardCoin.network,
            image: newStandardCoin.image,
            isFiat: newStandardCoin.isFiat,
            isApproved: newStandardCoin.isApproved,
            isStandard: newStandardCoin.isStandard,
            mappedPartners: JSON.parse(newStandardCoin.mappedPartners),
          },
        });
      }

      // ---------- DELETE STANDARD COIN ----------
      if (action === "delete") {
        if (!standardCoinId) {
          return res.status(400).json({
            success: false,
            message: "standardCoinId is required for delete action",
          });
        }

        // Fetch standard coin
        const standardCoin = await prisma.buy_crypto.findFirst({
          where: {
            id: parseInt(standardCoinId),
            isStandard: true,
          },
        });

        if (!standardCoin) {
          return res.status(404).json({
            success: false,
            message: "Standard coin not found",
          });
        }

        // Delete standard coin
        await prisma.buy_crypto.delete({
          where: {
            id: parseInt(standardCoinId),
          },
        });

        return res.status(200).json({
          success: true,
          message: "Standard coin deleted successfully",
          deletedCoin: {
            id: standardCoin.id,
            standardTicker: standardCoin.standardTicker,
            ticker: standardCoin.ticker,
            name: standardCoin.name,
            network: standardCoin.network,
          },
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while processing standard coin",
      });
    }
  };

  // This controller is responsible for adding and deleting coins form standard coins
  static addAndDeleteCoin = async (req, res) => {
    try {
      const { action, standardCoinId, unstandardCoinId, partnerName } =
        req.body;

      // ---------- VALIDATE INPUT ----------
      if (!action || !standardCoinId) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: action and standardCoinId are required",
        });
      }

      if (!["add", "delete"].includes(action)) {
        return res.status(400).json({
          success: false,
          message: "Invalid action. Must be 'add' or 'delete'",
        });
      }

      if (action === "add" && !unstandardCoinId) {
        return res.status(400).json({
          success: false,
          message: "unstandardCoinId is required for add action",
        });
      }

      if (action === "delete" && !partnerName) {
        return res.status(400).json({
          success: false,
          message: "partnerName is required for delete action",
        });
      }

      // ---------- FETCH STANDARD COIN ----------
      const standardCoin = await prisma.buy_crypto.findFirst({
        where: {
          id: parseInt(standardCoinId),
          isStandard: true,
        },
      });

      if (!standardCoin) {
        return res.status(404).json({
          success: false,
          message: "Standard coin not found",
        });
      }

      let mappedPartners = JSON.parse(standardCoin.mappedPartners || "[]");

      // ---------- ADD COIN TO MAPPED PARTNERS ----------
      if (action === "add") {
        const unstandardCoin = await prisma.buy_crypto.findFirst({
          where: {
            id: parseInt(unstandardCoinId),
            isStandard: false,
          },
        });

        if (!unstandardCoin) {
          return res.status(404).json({
            success: false,
            message: "Unstandard coin not found",
          });
        }

        const coin = unstandardCoin;

        // Check if already exists in mappedPartners
        const alreadyExists = mappedPartners.some(
          (mp) => mp.buyPartner === coin.buyPartner
        );

        if (alreadyExists) {
          return res.status(400).json({
            success: false,
            message: `Partner '${coin.buyPartner}' already exists in mappedPartners`,
          });
        }

        // Add to mappedPartners
        mappedPartners.push({
          buyPartner: coin.buyPartner,
          ticker: coin.ticker,
          name: coin.name,
          network: coin.network,
          isFiat: coin.isFiat,
        });

        await prisma.buy_crypto.update({
          where: { id: parseInt(standardCoinId) },
          data: {
            mappedPartners: JSON.stringify(mappedPartners),
          },
        });

        return res.status(200).json({
          success: true,
          message: `Successfully added ${coin.buyPartner} to standard coin`,
          mappedPartners,
        });
      }

      // ---------- DELETE COIN FROM MAPPED PARTNERS ----------
      if (action === "delete") {
        const updatedPartners = mappedPartners.filter(
          (mp) => mp.buyPartner !== partnerName
        );

        if (updatedPartners.length === mappedPartners.length) {
          return res.status(404).json({
            success: false,
            message: `Partner '${partnerName}' not found in mappedPartners`,
          });
        }

        await prisma.buy_crypto.update({
          where: { id: parseInt(standardCoinId) },
          data: {
            mappedPartners: JSON.stringify(updatedPartners),
          },
        });

        return res.status(200).json({
          success: true,
          message: `Successfully removed ${partnerName} from standard coin`,
          mappedPartners: updatedPartners,
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while processing add/delete operation",
      });
    }
  };

  // This controller is responsible for searching of standard and unstandard coins
  static searchCoins = async (req, res) => {
    try {
      const { ticker, isFiat, isStandard, page = 1, limit = 10 } = req.query;

      // ---------- VALIDATE INPUT ----------
      if (!ticker || ticker.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "ticker parameter is required for search",
        });
      }

      if (isFiat === undefined || isFiat === null || isFiat === "") {
        return res.status(400).json({
          success: false,
          message: "isFiat parameter is required for search",
        });
      }

      if (
        isStandard === undefined ||
        isStandard === null ||
        isStandard === ""
      ) {
        return res.status(400).json({
          success: false,
          message: "isStandard parameter is required for search",
        });
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const isFiatValue = parseInt(isFiat) === 1;
      const isStandardValue = parseInt(isStandard) === 1;

      // ---------- BUILD WHERE CLAUSE ----------
      const whereClause = {
        ticker: {
          contains: ticker,
        },
        isFiat: isFiatValue,
        isStandard: isStandardValue,
      };

      // ---------- EXECUTE QUERIES ----------
      const totalCoins = await prisma.buy_crypto.count({
        where: whereClause,
      });

      const coins = await prisma.buy_crypto.findMany({
        where: whereClause,
        orderBy: [
          {
            ticker: ticker === ticker ? "asc" : "asc", // Exact match prioritization done in app
          },
        ],
        skip: offset,
        take: limitNum,
      });

      // Sort to prioritize exact matches
      const sortedCoins = coins.sort((a, b) => {
        if (a.ticker === ticker && b.ticker !== ticker) return -1;
        if (a.ticker !== ticker && b.ticker === ticker) return 1;
        return a.ticker.localeCompare(b.ticker);
      });

      // ---------- PARSE MAPPED PARTNERS ----------
      const parsedCoins = sortedCoins.map((coin) => ({
        ...coin,
        mappedPartners: coin.mappedPartners
          ? JSON.parse(coin.mappedPartners)
          : [],
      }));

      // ---------- CALCULATE PAGINATION INFO ----------
      const totalPages = Math.ceil(totalCoins / limitNum);

      return res.status(200).json({
        success: true,
        totalCoins,
        totalPages,
        currentPage: pageNum,
        returnedCount: parsedCoins.length,
        coins: parsedCoins,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while searching coins",
      });
    }
  };
}

export default buyController;
