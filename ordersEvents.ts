// Medusa Backend
// src/subscribers/ordersEvents.ts

import { 
  OrderService, 
  type SubscriberConfig, 
  type SubscriberArgs 
} from "@medusajs/medusa"
import nodemailer from "nodemailer";
import EmailTemplates from "email-templates";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

export default async function orderPlacedHandler({ 
  data, eventName, container, pluginOptions, 
}: SubscriberArgs<Record<string, any>>) {
  const orderService: OrderService = container.resolve("orderService")
  const cartService = container.resolve("cartService") // Fix cartService

  const { id } = data

  try {
    console.log("id : " + id);  
    const order = await orderService.retrieve(id || '', {
      relations: [
          "refunds",
          "items",
          "customer",
          "billing_address",
          "shipping_address",
          "discounts",
          "discounts.rule",
          "shipping_methods",
          "shipping_methods.shipping_option",
          "payments",
          "fulfillments",
          "fulfillments.tracking_links",
          "returns",
          "gift_cards",
          "gift_card_transactions",
      ]
  });
      let totalValue = (order.items.reduce((value, item) => {
          return value + item.unit_price * item.quantity;
      }, 0))
      for (const option of order.shipping_methods) {
          totalValue += option.shipping_option.amount;
      }
      const transport = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT,
          auth: {
              user: process.env.EMAIL_SENDER_ADDRESS,
              pass: process.env.EMAIL_SENDER_PASS, // Corrected environment variable
          }
      });

      const email = new EmailTemplates({
          message: {
              from: process.env.EMAIL_SENDER_ADDRESS,
          },
          transport: transport,
          views: {
              root: path.resolve("data/emails"), // Fix for path
              options: {
                  extension: 'pug',
              },
          },
      });
      await email.send({
          template: eventName,
          message: {
              to: order.email,
          },
          locals: {
              eventName,
              order,
              cart: await cartService.retrieve(order.cart_id || ''), // Corrected cart retrieval
              id: id,
              total_value: (totalValue / 100).toFixed(2),
          },
          send: true, // Moved send: true here
      });

  } catch (error) {
      console.error(`Error processing order placed event: ${error.message}`);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: {
      subscriberId: "order-placed-handler",
  },
}
