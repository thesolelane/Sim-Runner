import { Router, type IRouter } from "express";
import healthRouter from "./health";
import simulationsRouter from "./simulations";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(simulationsRouter);

export default router;
