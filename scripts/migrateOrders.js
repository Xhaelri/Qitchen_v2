// scripts/migrateOrders.js
// Run this script to migrate existing orders to new schema

import mongoose from "mongoose";
import Order from "../models/order.model.js";
import "dotenv/config";

const migrateOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const orders = await Order.find({});
    console.log(`Found ${orders.length} orders to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const order of orders) {
      // Check if order already has new fields
      if (order.subtotal !== undefined) {
        skippedCount++;
        continue;
      }

      // Migrate old structure to new structure
      order.subtotal = order.totalPrice || 0;
      order.deliveryFee = 0; // Default to 0 for existing orders
      // totalPrice stays the same (subtotal + deliveryFee = subtotal + 0)

      // Add empty deliveryLocation for Online orders if not present
      if (order.placeType === "Online" && !order.deliveryLocation) {
        order.deliveryLocation = {
          governorate: "Unknown",
          city: "Unknown",
        };
      }

      await order.save();
      migratedCount++;

      if (migratedCount % 100 === 0) {
        console.log(`Migrated ${migratedCount} orders...`);
      }
    }

    console.log(`✅ Migration completed!`);
    console.log(`   - Migrated: ${migratedCount} orders`);
    console.log(`   - Skipped: ${skippedCount} orders (already migrated)`);

    await mongoose.connection.close();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error migrating orders:", error);
    process.exit(1);
  }
};

migrateOrders();

// ================================================================
// Run this script with: node scripts/migrateOrders.js
// ================================================================