import express from "express";
import { webhook, webhookMiddleware } from '../controllers/stripeWebhook.controller.js';

const router = express.Router();

router.post('/webhook', webhookMiddleware, webhook);

export { router };