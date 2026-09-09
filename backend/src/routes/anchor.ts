import { Router, Request, Response } from 'express';
import { stellarService } from '../services/stellar.js';
import { Keypair } from '@stellar/stellar-sdk';
import {
  AnchorCreateTrustlineSchema,
  PublicKeyParamsSchema,
} from '../config/schemas.js';
import { ApiError, asyncHandler } from '../middleware/asyncHandler.js';

export const anchorRoutes = Router();

anchorRoutes.post(
  '/create-account',
  asyncHandler(async (req: Request, res: Response) => {
    const account = stellarService.createAccount();
    if (stellarService.getNetwork() === 'testnet') {
      await stellarService.fundAccount(account.publicKey);
    }
    res.status(201).json({
      success: true,
      data: { publicKey: account.publicKey, secretKey: account.secretKey },
    });
  }),
);

anchorRoutes.get(
  '/balance/:publicKey',
  asyncHandler(async (req: Request, res: Response) => {
    const { publicKey } = PublicKeyParamsSchema.parse(req.params);
    try {
      const balance = await stellarService.getAccountBalance(publicKey);
      res.json({ success: true, data: { publicKey, balance } });
    } catch (err: unknown) {
      throw new ApiError(404, 'Account not found');
    }
  }),
);

anchorRoutes.post(
  '/create-trustline',
  asyncHandler(async (req: Request, res: Response) => {
    const body = AnchorCreateTrustlineSchema.parse(req.body);
    const kp = Keypair.fromSecret(body.secretKey);
    await stellarService.createTrustline(body.assetCode, body.issuerPublicKey, kp);
    res.json({
      success: true,
      data: { assetCode: body.assetCode, issuerPublicKey: body.issuerPublicKey },
    });
  }),
);