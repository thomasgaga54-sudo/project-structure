/**
 * Delete ALL products from the database.
 * Usage: node scripts/deleteAllProducts.js
 */
const path = require("path");
const fs = require("fs");

const rootEnv = path.join(__dirname, "../../.env");
const localEnv = path.join(__dirname, "../config/.env");
require("dotenv").config({ path: fs.existsSync(rootEnv) ? rootEnv : localEnv });

const mongoose = require("mongoose");
const Product = require("../models/product");

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URL;
  if (!uri) { console.error("No MongoDB URI found."); process.exit(1); }

  await mongoose.connect(uri, { dbName: "ZunnyMinMart" });
  console.log("Connected. Database:", mongoose.connection.db.databaseName);

  const count = await Product.countDocuments();
  console.log(`Found ${count} product(s). Deleting all...`);

  const result = await Product.deleteMany({});
  console.log(`✅ Deleted ${result.deletedCount} product(s). Products collection is now empty.`);

  await mongoose.disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
