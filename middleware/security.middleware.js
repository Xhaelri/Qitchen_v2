import helmet from "helmet";
// import hpp from "hpp";
import cors from "cors";
import rateLimit from "express-rate-limit";

import compression from "compression";
import express from "express";
import { xss } from "express-xss-sanitizer";

export const applySecurity = (app) => {
  const corsConfig = {
    origin: ["http://localhost:5173","https://omar-mazen-qitchen.vercel.app"],
    credentials: true,
  };
  
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later",
  });

  
  app.use(helmet());

  //   app.use(
  //     hpp({
  //       whitelist: ["tags", "filters"], // allow multiple values only for these params
  //     })
  //   );


  app.use(cors(corsConfig));


  app.use("/api", limiter);

  app.use(xss());

  app.use(compression());

  app.use(express.json({ limit: "16kb" }));

  app.use(express.urlencoded({ extended: true, limit: "16kb" }));
};
