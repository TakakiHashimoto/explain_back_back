import { Router } from "express";
import { requireUser } from "../../../middleware/requireUser.js";
import { deleteAccountData, deleteClerkUser } from "../deleteAccount.js";
import { AppError } from "../../../lib/errors.js";

const router = Router();

router.use(requireUser);

router.get("/", (req, res) => {
  res.json({ id: req.user!.id });
});

router.delete("/", async (req, res) => {
  const { id, authSubject } = req.user!;

  try {
    // RevenueCat → OneSignal → DB
    await deleteAccountData(id);

    // Clerk last; 404 means it is already gone, which counts as success.
    await deleteClerkUser(authSubject);
  } catch (error) {
    console.error("Account deletion failed", { id, authSubject }, error);
    throw new AppError("ACCOUNT_DELETION_FAILED");
  }

  res.status(204).end();
});

export default router;
