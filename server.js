import { applySecurity } from "./middleware/security.middleware.js";
import { errorHandler, notFound } from "./middleware/errorHandler.middlware.js";

import cookieParser from "cookie-parser";
import express from "express";
import connectDB from "./db/db.js";
import "dotenv/config";
import { router as userRouter } from "./routes/user.route.js";
import { router as productRouter } from "./routes/product.route.js";
import { router as categoryRouter } from "./routes/category.route.js";
import { router as reviewRouter } from "./routes/review.route.js";
import { router as cartRouter } from "./routes/cart.route.js";
import { router as addressRouter } from "./routes/address.route.js";
import { router as orderRouter } from "./routes/order.route.js";
import { router as tableRouter } from "./routes/table.route.js";
import { router as reservationRouter } from "./routes/reservation.route.js";
import { router as srtipeRouter } from "./routes/stripe.route.js";
import { router as homeRouter } from "./routes/home.route.js";
import { router as adminRouter } from "./routes/admin.route.js";
import { router as paymobRouter } from "./routes/paymob.route.js";
import { router as paymobConfigRouter } from "./routes/paymobConfig.route.js";
import { router as stripeConfigRouter } from "./routes/stripeConfig.route.js";

const app = express();


// Paymob webhook route
app.use("/api/v2/paymob", paymobRouter);
// stripe webhook route
app.use("/api/v2/stripe", srtipeRouter);

app.use(cookieParser());
applySecurity(app);

app.get("/", (req, res) => {
  res.send("Qitchen API is working!");
});

app.use("/api/v2/user", userRouter);
app.use("/api/v2/product", productRouter);
app.use("/api/v2/category", categoryRouter);
app.use("/api/v2/review", reviewRouter);
app.use("/api/v2/cart", cartRouter);
app.use("/api/v2/address", addressRouter);
app.use("/api/v2/order", orderRouter);
app.use("/api/v2/table", tableRouter);
app.use("/api/v2/reservation", reservationRouter);
app.use("/api/v2/home", homeRouter);
app.use("/api/v2/admin", adminRouter);

app.use("/api/v2/paymob", paymobRouter);
app.use("/api/v2/stripe", srtipeRouter);

app.use("/api/v2/paymob-config", paymobConfigRouter);
app.use("/api/v2/stripe-config", stripeConfigRouter);

app.use(notFound);
app.use(errorHandler);

connectDB();

// For local development
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

// For Vercel
export default app;