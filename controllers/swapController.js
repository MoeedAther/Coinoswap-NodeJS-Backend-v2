import prisma from "../database/prisma.js";
import axios from "axios";
import crypto from "crypto";

class swapController {
  // This controller is responsible for updating swap coins into swap_crypto table
  static updateCoins = async (req, res) => {
    try {
      // ---------- API CALLS ----------
      // Changelly API
      const privateKeyString = process.env.CHANGELLY_PRIVATE_KEY;
      const privateKey = crypto.createPrivateKey({
        key: privateKeyString,
        format: "der",
        type: "pkcs8",
        encoding: "hex",
      });

      const publicKey = crypto.createPublicKey(privateKey).export({
        type: "pkcs1",
        format: "der",
      });

      const changellyMessage = {
        jsonrpc: "2.0",
        id: "test",
        method: "getCurrenciesFull",
        params: {},
      };

      const signature = crypto.sign(
        "sha256",
        Buffer.from(JSON.stringify(changellyMessage)),
        {
          key: privateKey,
          type: "pkcs8",
          format: "der",
        }
      );

      // Changelly API
      const changellyResp = await axios.post(
        "https://api.changelly.com/v2",
        changellyMessage,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": crypto
              .createHash("sha256")
              .update(publicKey)
              .digest("base64"),
            "X-Api-Signature": signature.toString("base64"),
          },
        }
      );

      // ChangeNow API
      const changenowResp = await axios.get(
        `https://api.changenow.io/v1/currencies?active=true`,
        {
          headers: {
            "x-changenow-api-key": process.env.CHANGENOW,
          },
        }
      );

      // Changehero API
      const changeheroMessage = {
        jsonrpc: "2.0",
        method: "getCurrenciesFull",
        params: {},
      };

      const changeheroResp = await axios.post(
        "https://api.changehero.io/v2/",
        changeheroMessage,
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": process.env.CHANGEHERO,
          },
        }
      );

      // Exolix API
      const exolixResp = await axios.get(
        "https://exolix.com/api/v2/currencies?withNetworks=true&all=true"
      );

      // StealthEX API
      const stealthexResp = await axios.get(
        `https://api.stealthex.io/api/v2/currency?api_key=${process.env.STEALTHEX}`
      );

      // Godex API
      const godexResp = await axios.get("https://api.godex.io/api/v1/coins");

      // LetsExchange API
      const letsexchangeResp = await axios.get(
        "https://api.letsexchange.io/api/v1/coins",
        {
          headers: {
            Authorization: process.env.LETSEXCHANGE,
          },
        }
      );

      // SimpleSwap API
      const simpleswapResp = await axios.get(
        `https://api.simpleswap.io/get_all_currencies?api_key=${process.env.SIMPLESWAP}`
      );

      // EasyBit API
      const easybitResp = await axios.get(
        "https://api.easybit.com/currencyList",
        {
          headers: {
            "API-KEY": process.env.EASYBIT,
          },
        }
      );

      let coins = [];
      let mappedCoins = [];

      // ---------- BUILD COIN OBJECTS ----------

      // Process Changelly coins
      if (changellyResp.data.result) {
        for (const c of changellyResp.data.result) {
          coins.push({
            standardTicker: c.name.toLowerCase(),
            ticker: c.name,
            requiresExtraId: false,
            name: c.fullName,
            network: c.blockchain || c.name,
            image: c.image || null,
            swapPartner: "changelly",
            mappedPartners: [],
            data: c,
            coinType: "other",
            isApproved: 0,
            isStandard: 0,
          });
        }
      }

      // Process ChangeNow coins
      if (changenowResp.data) {
        for (const c of changenowResp.data) {
          coins.push({
            standardTicker: c.ticker.toLowerCase(),
            ticker: c.ticker,
            requiresExtraId: c.isExtraIdSupported,
            name: c.name,
            network: c.network || c.ticker,
            image: c.image || null,
            swapPartner: "changenow",
            mappedPartners: [],
            data: c,
            coinType: "other",
            isApproved: 0,
            isStandard: 0,
          });
        }
      }

      // Process Changehero coins
      if (changeheroResp.data.result) {
        for (const c of changeheroResp.data.result) {
          let ticker = c.name;
          let network = c.blockchain || c.name;

          coins.push({
            standardTicker: ticker.toLowerCase(),
            ticker: ticker,
            requiresExtraId: false,
            name: c.fullName,
            network: network,
            shortName: c.publicTicker || c.name,
            image: c.image || null,
            swapPartner: "changehero",
            mappedPartners: [],
            data: c,
            coinType: "other",
            isApproved: 0,
            isStandard: 0,
          });
        }
      }

      // Process Exolix coins
      if (exolixResp.data.data) {
        for (const c of exolixResp.data.data) {
          const networks = c.networks || [];
          if (networks.length > 0) {
            for (const network of networks) {
              let standardTicker =
                c.code === network.network
                  ? c.code.toLowerCase()
                  : (c.code + network.network).toLowerCase();
              coins.push({
                standardTicker: standardTicker,
                ticker: c.code,
                requiresExtraId: network.memoNeeded,
                name: c.name,
                network: network.network,
                image: c.icon || null,
                swapPartner: "exolix",
                mappedPartners: [],
                data: c,
                coinType: "other",
                isApproved: 0,
                isStandard: 0,
              });
            }
          } else {
            // Fallback if no networks array
            coins.push({
              standardTicker: c.code.toLowerCase(),
              ticker: c.code,
              requiresExtraId: false,
              name: c.name,
              network: c.networkCode || c.code,
              image: c.icon || null,
              swapPartner: "exolix",
              mappedPartners: [],
              data: c,
              coinType: "other",
              isApproved: 0,
              isStandard: 0,
            });
          }
        }
      }

      // Process StealthEX coins
      if (stealthexResp.data) {
        for (const c of stealthexResp.data) {
          coins.push({
            standardTicker: c.symbol.toLowerCase(),
            ticker: c.symbol,
            requiresExtraId: c.has_extra_id,
            name: c.name,
            network: c.network || c.symbol,
            image: c.image || null,
            swapPartner: "stealthex",
            mappedPartners: [],
            data: c,
            coinType: "other",
            isApproved: 0,
            isStandard: 0,
          });
        }
      }

      // Process Godex coins
      if (godexResp.data) {
        for (const c of godexResp.data) {
          const networks = c.networks || [];
          if (networks.length > 0) {
            for (const network of networks) {
              let standardTicker =
                c.code === network.code
                  ? c.code.toLowerCase()
                  : (c.code + network.code).toLowerCase();
              coins.push({
                standardTicker: standardTicker,
                ticker: c.code,
                requiresExtraId: network.has_extra === 1 ? true : false,
                name: c.name,
                network: network.code,
                image: null,
                swapPartner: "godex",
                mappedPartners: [],
                data: c,
                coinType: "other",
                isApproved: 0,
                isStandard: 0,
              });
            }
          } else {
            // Fallback if no networks array
            coins.push({
              standardTicker: c.code.toLowerCase(),
              ticker: c.code,
              requiresExtraId: false,
              name: c.name,
              network: c.default_network_code || c.code,
              image: null,
              swapPartner: "godex",
              mappedPartners: [],
              data: c,
              coinType: "other",
              isApproved: 0,
              isStandard: 0,
            });
          }
        }
      }

      // Process LetsExchange coins
      if (letsexchangeResp.data) {
        for (const c of letsexchangeResp.data) {
          coins.push({
            standardTicker: c.code.toLowerCase(),
            ticker: c.code,
            requiresExtraId: c.has_extra === 1 ? true : false,
            name: c.name,
            network: c.network || c.code,
            image: c.icon || null,
            swapPartner: "letsexchange",
            mappedPartners: [],
            data: c,
            coinType: "other",
            isApproved: 0,
            isStandard: 0,
          });
        }
      }

      // Process SimpleSwap coins
      if (simpleswapResp.data) {
        for (const c of simpleswapResp.data) {
          coins.push({
            standardTicker: c.symbol.toLowerCase(),
            ticker: c.symbol,
            requiresExtraId: c.has_extra_id,
            name: c.name,
            network: c.network || c.symbol,
            image: c.image || null,
            swapPartner: "simpleswap",
            mappedPartners: [],
            data: c,
            coinType: "other",
            isApproved: 0,
            isStandard: 0,
          });
        }
      }

      // Process EasyBit coins
      if (easybitResp.data && easybitResp.data.data) {
        for (const c of easybitResp.data.data) {
          const networkList = c.networkList || [];
          if (networkList.length > 0) {
            for (const network of networkList) {
              let standardTicker =
                c.currency === network.network
                  ? c.currency.toLowerCase()
                  : (c.currency + network.network).toLowerCase();

              coins.push({
                standardTicker: standardTicker,
                ticker: c.currency,
                requiresExtraId: c.hasTag,
                name: c.name,
                network: network.network,
                image: null,
                swapPartner: "easybit",
                mappedPartners: [],
                data: c,
                coinType: "other",
                isApproved: 0,
                isStandard: 0,
              });
            }
          } else {
            // Fallback if no networkList
            coins.push({
              standardTicker: c.currency.toLowerCase(),
              ticker: c.currency,
              requiresExtraId: c.hasTag || false,
              name: c.name,
              network: c.currency,
              image: null,
              swapPartner: "easybit",
              mappedPartners: [],
              data: c,
              coinType: "other",
              isApproved: 0,
              isStandard: 0,
            });
          }
        }
      }

      // ---------- EXTRACT ALL NETWORK NAMES ----------
      let allNetworks = new Set();
      for (const coin of coins) {
        if (coin.network) {
          allNetworks.add(coin.network.toLowerCase());
        }
      }

      // ---------- PROCESS SHORTNAME ----------
      for (const coin of coins) {
        let coinName = coin.name || coin.ticker;
        let shortName = coinName;

        // Check if coin name ends with any network name and remove it
        for (const network of allNetworks) {
          const networkLower = network.toLowerCase();
          const coinNameLower = coinName.toLowerCase();

          if (
            coinNameLower.endsWith(networkLower) &&
            coinNameLower !== networkLower
          ) {
            // Remove network name from the end of coin name
            shortName = coinName
              .substring(0, coinName.length - network.length)
              .trim();
            break;
          }
        }

        coin.shortName = shortName || coinName;
      }

      // return res.json({ coins: coins, networks: Array.from(allNetworks) });

      let coinKeys = new Set();
      let standardCoinKeys = new Set();

      // ---------- GROUP SIMILAR COINS ----------
      for (const coin of coins) {
        console.log("Processing coin:", {
          standardTicker: coin.standardTicker,
          ticker: coin.ticker,
          network: coin.network,
          swapPartner: coin.swapPartner,
        });

        if (!coin.standardTicker || !coin.network) {
          console.log(
            "Skipping coin with missing standardTicker or network:",
            coin
          );
          continue;
        }

        const key = coin.standardTicker.toLowerCase();

        if (coinKeys.has(key)) continue;
        let alikeCoins = coins.filter(
          (c) => c.standardTicker && c.network && c.standardTicker === key
        );

        if (alikeCoins.length > 1) {
          let baseCoin = {
            ...alikeCoins[0],
            mappedPartners: [],
          };

          let requiresExtraIdFlag = false;

          for (const a of alikeCoins) {
            // Check if any coin requires extra ID
            if (a.requiresExtraId === true) {
              requiresExtraIdFlag = true;
            }

            baseCoin.mappedPartners.push({
              swapPartner: a.swapPartner,
              standardTicker: a.standardTicker,
              ticker: a.ticker,
              name: a.name,
              network: a.network,
              coinType: a.coinType,
              requiresExtraId: a.requiresExtraId,
              payInNotification: null,
              payOutNotification: null,
            });
          }

          baseCoin.swapPartner = null;
          baseCoin.data = null;
          baseCoin.isStandard = 1;
          baseCoin.isApproved = 1; // Standard coins are approved by default
          baseCoin.requiresExtraId = requiresExtraIdFlag;

          coinKeys.add(key);
          standardCoinKeys.add(key);
          mappedCoins.push(baseCoin);
        }
      }

      // ---------- COUNTERS ----------
      let updatedStandard = 0;
      let insertedStandard = 0;
      let insertedNormal = 0;

      // ---------- PROCESS STANDARD COINS ----------
      for (const m of mappedCoins) {
        const coin = await prisma.swap_crypto.findMany({
          where: {
            standardTicker: m.standardTicker,
            network: m.network,
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
            (mp) => !dbPartners.some((db) => db.swapPartner === mp.swapPartner)
          );

          if (missingPartners.length > 0) {
            const combinedPartners = dbPartners.concat(missingPartners);

            await prisma.swap_crypto.update({
              where: { id: coin[0].id },
              data: {
                mappedPartners: JSON.stringify(combinedPartners),
              },
            });
            updatedStandard++;
          }
        } else {
          // Insert new standard coin
          await prisma.swap_crypto.create({
            data: {
              standardTicker: m.standardTicker,
              name: m.name,
              network: m.network,
              shortName: m.shortName || m.name,
              image: m.image,
              swapPartner: m.swapPartner,
              mappedPartners: JSON.stringify(m.mappedPartners),
              coinType: m.coinType || "other",
              requiresExtraId: m.requiresExtraId,
              isApproved: m.isApproved === 1,
              isStandard: m.isStandard === 1,
            },
          });
          insertedStandard++;
        }
      }

      // ---------- PROCESS NON-STANDARD COINS ----------
      for (const c of coins) {
        // Skip coins that are part of standard coins
        const key = c.standardTicker.toLowerCase() + c.network.toLowerCase();
        if (standardCoinKeys.has(key)) {
          continue;
        }

        const coin = await prisma.swap_crypto.findMany({
          where: {
            standardTicker: c.standardTicker,
            network: c.network,
            swapPartner: c.swapPartner,
            isStandard: false,
          },
        });

        if (coin.length === 0) {
          await prisma.swap_crypto.create({
            data: {
              standardTicker: c.standardTicker,
              name: c.name,
              network: c.network,
              shortName: c.shortName || c.name,
              image: c.image,
              swapPartner: c.swapPartner,
              data: JSON.stringify(c.data),
              coinType: c.coinType || "other",
              requiresExtraId: c.requiresExtraId,
              isApproved: c.isApproved === 1,
              isStandard: c.isStandard === 1,
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

  // This controller is responsible for adding and deleting coins from standard coins
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
      const standardCoin = await prisma.swap_crypto.findFirst({
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
        const unstandardCoin = await prisma.swap_crypto.findFirst({
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
          (mp) => mp.swapPartner === coin.swapPartner
        );

        if (alreadyExists) {
          return res.status(400).json({
            success: false,
            message: `Partner '${coin.swapPartner}' already exists in mappedPartners`,
          });
        }

        // Add to mappedPartners
        mappedPartners.push({
          swapPartner: coin.swapPartner,
          standardTicker: coin.standardTicker,
          ticker: coin.ticker,
          name: coin.name,
          network: coin.network,
          coinType: coin.coinType,
          requiresExtraId: coin.requiresExtraId,
        });

        // Check if any partner requires extra ID
        const requiresExtraIdFlag = mappedPartners.some(
          (mp) => mp.requiresExtraId === true
        );

        await prisma.swap_crypto.update({
          where: { id: parseInt(standardCoinId) },
          data: {
            mappedPartners: JSON.stringify(mappedPartners),
            requiresExtraId: requiresExtraIdFlag,
          },
        });

        return res.status(200).json({
          success: true,
          message: `Successfully added ${coin.swapPartner} to standard coin`,
          mappedPartners,
        });
      }

      // ---------- DELETE COIN FROM MAPPED PARTNERS ----------
      if (action === "delete") {
        const updatedPartners = mappedPartners.filter(
          (mp) => mp.swapPartner !== partnerName
        );

        if (updatedPartners.length === mappedPartners.length) {
          return res.status(404).json({
            success: false,
            message: `Partner '${partnerName}' not found in mappedPartners`,
          });
        }

        // Recalculate requiresExtraId after deletion
        const requiresExtraIdFlag = updatedPartners.some(
          (mp) => mp.requiresExtraId === true
        );

        await prisma.swap_crypto.update({
          where: { id: parseInt(standardCoinId) },
          data: {
            mappedPartners: JSON.stringify(updatedPartners),
            requiresExtraId: requiresExtraIdFlag,
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

  // This controller is responsible for standardizing coins
  static standardizeCoin = async (req, res) => {
    try {
      const { coinIds } = req.body;

      // ---------- VALIDATE INPUT ----------
      if (!coinIds || !Array.isArray(coinIds) || coinIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "coinIds array is required and must not be empty",
        });
      }

      // ---------- FETCH ALL COINS ----------
      const coins = await prisma.swap_crypto.findMany({
        where: {
          id: { in: coinIds.map((id) => parseInt(id)) },
          isStandard: false,
        },
      });

      if (coins.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No unstandard coins found with provided IDs",
        });
      }

      // ---------- USE FIRST COIN AS BASE ----------
      const firstCoin = coins[0];

      let mappedPartners = [];
      let requiresExtraIdFlag = false;

      // ---------- BUILD MAPPED PARTNERS FROM SELECTED COINS ----------
      for (const coin of coins) {
        mappedPartners.push({
          swapPartner: coin.swapPartner,
          standardTicker: coin.standardTicker,
          ticker: coin.ticker,
          name: coin.name,
          network: coin.network,
          coinType: coin.coinType,
          requiresExtraId: coin.requiresExtraId,
          payInNotification: null,
          payOutNotification: null,
        });

        // Check if any coin requires extra ID
        if (coin.requiresExtraId === true) {
          requiresExtraIdFlag = true;
        }
      }

      // ---------- CREATE NEW STANDARD COIN ----------
      const result = await prisma.swap_crypto.create({
        data: {
          standardTicker: firstCoin.standardTicker,
          name: firstCoin.name,
          network: firstCoin.network,
          shortName: firstCoin.shortName || firstCoin.name,
          image: firstCoin.image,
          swapPartner: null,
          mappedPartners: JSON.stringify(mappedPartners),
          coinType: firstCoin.coinType || "other",
          requiresExtraId: requiresExtraIdFlag,
          isApproved: true,
          isStandard: true,
        },
      });
      const standardCoinId = result.id;

      return res.status(200).json({
        success: true,
        message: `Successfully standardized ${coins.length} coin(s)`,
        standardCoinId,
        mappedPartners,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while standardizing coins",
      });
    }
  };

  // This controller is responsible for destandardizing coins
  static destandardizeCoin = async (req, res) => {
    try {
      const { standardCoinId } = req.body;

      // ---------- VALIDATE INPUT ----------
      if (!standardCoinId) {
        return res.status(400).json({
          success: false,
          message: "standardCoinId is required",
        });
      }

      // ---------- FETCH STANDARD COIN ----------
      const standardCoin = await prisma.swap_crypto.findFirst({
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

      const coin = standardCoin;
      const mappedPartners = JSON.parse(coin.mappedPartners || "[]");

      if (mappedPartners.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Standard coin has no mapped partners to destandardize",
        });
      }

      // ---------- DELETE STANDARD COIN ----------
      await prisma.swap_crypto.delete({
        where: { id: parseInt(standardCoinId) },
      });

      return res.status(200).json({
        success: true,
        message: `Successfully destandardized coin. The standard coin has been removed.`,
        deletedStandardCoinId: standardCoinId,
        releasedPartnersCount: mappedPartners.length,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while destandardizing coin",
      });
    }
  };

  // This controller is responsible for getting standard coin data
  static getStandardCoin = async (req, res) => {
    try {
      const { standardCoinId } = req.query;

      // ---------- VALIDATE INPUT ----------
      if (!standardCoinId) {
        return res.status(400).json({
          success: false,
          message: "standardCoinId is required",
        });
      }

      // ---------- FETCH STANDARD COIN ----------
      const standardCoin = await prisma.swap_crypto.findFirst({
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

      const coin = standardCoin;
      const mappedPartners = JSON.parse(coin.mappedPartners || "[]");

      return res.status(200).json({
        success: true,
        coin: {
          id: coin.id,
          standardTicker: coin.standardTicker,
          name: coin.name,
          network: coin.network,
          shortName: coin.shortName,
          image: coin.image,
          coinType: coin.coinType,
          requiresExtraId: coin.requiresExtraId,
          isApproved: coin.isApproved,
          mappedPartners: mappedPartners,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while fetching standard coin",
      });
    }
  };

  // This controller is responsible for updating standard coin data
  static updateStandardCoin = async (req, res) => {
    try {
      const { standardCoinId, shortName, coinType, image, mappedPartners } =
        req.body;

      // ---------- VALIDATE INPUT ----------
      if (!standardCoinId) {
        return res.status(400).json({
          success: false,
          message: "standardCoinId is required",
        });
      }

      // Validate coinType if provided
      const validCoinTypes = ["stable", "stable&popular", "other"];
      if (coinType && !validCoinTypes.includes(coinType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid coinType. Must be one of: ${validCoinTypes.join(
            ", "
          )}`,
        });
      }

      // ---------- FETCH STANDARD COIN ----------
      const standardCoin = await prisma.swap_crypto.findFirst({
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

      const coin = standardCoin;
      let currentMappedPartners = JSON.parse(coin.mappedPartners || "[]");

      // ---------- UPDATE MAPPED PARTNERS PAYIN/PAYOUT ----------
      if (mappedPartners && Array.isArray(mappedPartners)) {
        for (const updatedPartner of mappedPartners) {
          const partnerIndex = currentMappedPartners.findIndex(
            (mp) => mp.swapPartner === updatedPartner.swapPartner
          );

          if (partnerIndex !== -1) {
            // Update payInNotification and payOutNotification
            if (updatedPartner.payInNotification !== undefined) {
              currentMappedPartners[partnerIndex].payInNotification =
                updatedPartner.payInNotification;
            }
            if (updatedPartner.payOutNotification !== undefined) {
              currentMappedPartners[partnerIndex].payOutNotification =
                updatedPartner.payOutNotification;
            }
          }
        }
      }

      // ---------- BUILD UPDATE DATA ----------
      const updateData = {};
      if (shortName !== undefined) updateData.shortName = shortName;
      if (coinType !== undefined) updateData.coinType = coinType;
      if (image !== undefined) updateData.image = image;
      if (mappedPartners && Array.isArray(mappedPartners)) {
        updateData.mappedPartners = JSON.stringify(currentMappedPartners);
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No fields to update",
        });
      }

      // ---------- UPDATE STANDARD COIN ----------

      await prisma.swap_crypto.update({
        where: { id: parseInt(standardCoinId) },
        data: updateData,
      });

      // ---------- FETCH UPDATED COIN ----------
      const updatedCoin = await prisma.swap_crypto.findUnique({
        where: { id: parseInt(standardCoinId) },
      });

      return res.status(200).json({
        success: true,
        message: "Standard coin updated successfully",
        coin: {
          id: updatedCoin[0].id,
          standardTicker: updatedCoin[0].standardTicker,
          name: updatedCoin[0].name,
          network: updatedCoin[0].network,
          shortName: updatedCoin[0].shortName,
          image: updatedCoin[0].image,
          coinType: updatedCoin[0].coinType,
          requiresExtraId: updatedCoin[0].requiresExtraId,
          isApproved: updatedCoin[0].isApproved,
          mappedPartners: JSON.parse(updatedCoin[0].mappedPartners || "[]"),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while updating standard coin",
      });
    }
  };

  // This controller is responsible for searching of standard and unstandard coins
  static searchCoins = async (req, res) => {
    try {
      const { ticker, isStandard, page = 1, limit = 10 } = req.query;

      // ---------- VALIDATE INPUT ----------
      if (!ticker || ticker.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "ticker parameter is required for search",
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
      const isStandardValue = parseInt(isStandard);

      // ---------- BUILD COUNT QUERY ----------
      let countQuery =
        "SELECT COUNT(*) as total FROM swap_crypto WHERE standardTicker LIKE ? AND isStandard=?";
      const searchPattern = `%${ticker}%`;

      // ---------- BUILD DATA QUERY ----------
      let dataQuery =
        "SELECT * FROM swap_crypto WHERE standardTicker LIKE ? AND isStandard=? ORDER BY " +
        "CASE WHEN standardTicker = ? THEN 0 ELSE 1 END, " + // Exact match first
        "standardTicker ASC " + // Then alphabetically
        "LIMIT ? OFFSET ?";

      // ---------- EXECUTE QUERIES ----------
      const [countResult] = await query(countQuery, [
        searchPattern,
        isStandardValue,
      ]);
      const totalCoins = countResult.total;

      const coins = await query(dataQuery, [
        searchPattern,
        isStandardValue,
        ticker, // For exact match priority
        limitNum,
        offset,
      ]);

      // ---------- PARSE MAPPED PARTNERS ----------
      const parsedCoins = coins.map((coin) => ({
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

export default swapController;
