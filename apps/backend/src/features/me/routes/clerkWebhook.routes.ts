import express, { Router } from "express";
import { AppError, sendError } from "../../../lib/errors.js";
import { verifyWebhook } from "@clerk/express/webhooks";
import { prisma } from "../../../lib/prisma.js";
import { deleteAccountData } from "../deleteAccount.js";

const router = Router();

// Clerk user.deleted: removes our data after a deletion in the Account Portal (spec §16.4)
router.post(
  "/clerk",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    // Forged or unsigned request (or a missing secret): 400.
    const event = await verifyWebhook(req).catch((error) => {
      console.error("Webhook verification failed:", error);
      throw new AppError("BAD_REQUEST");
    });

    // Nothing to do: other events, or already deleted in the app.
    const authSubject =
      event.type === "user.deleted" ? event.data.id : undefined;
    const user = authSubject
      ? await prisma.user.findUnique({ where: { authSubject } })
      : null;
    if (!user) return res.status(204).end();

    // 5xx so that Svix retries.
    await deleteAccountData(user.id).catch((error) => {
      console.error(
        `Account deletion failed`,
        { id: user.id, authSubject },
        error,
      );
      throw new AppError("ACCOUNT_DELETION_FAILED");
    });

    res.status(204).end();
  },
);

export default router;
