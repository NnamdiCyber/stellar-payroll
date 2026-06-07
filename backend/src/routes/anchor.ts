import { Router, Request, Response } from 'express';
import { stellarService } from '../services/stellar.js';
import { Keypair } from '@stellar/stellar-sdk';

export const anchorRoutes = Router();

anchorRoutes.post('/create-account', async (req: Request, res: Response) => {
  try {
    const account = stellarService.createAccount();
    if (process.env.STELLAR_NETWORK === 'testnet') {
      await stellarService.fundAccount(account.publicKey);
    }
    res.status(201).json({
      success: true,
      data: {
        publicKey: account.publicKey,
        secretKey: account.secretKey,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

anchorRoutes.get('/balance/:publicKey', async (req: Request, res: Response) => {
  try {
    const balance = await stellarService.getAccountBalance(req.params.publicKey);
    res.json({
      success: true,
      data: { publicKey: req.params.publicKey, balance },
    });
  } catch (err: any) {
    res.status(404).json({ error: true, message: 'Account not found' });
  }
});

anchorRoutes.post('/create-trustline', async (req: Request, res: Response) => {
  try {
    const { assetCode, issuerPublicKey, secretKey } = req.body;
    if (!assetCode || !issuerPublicKey || !secretKey) {
      res.status(400).json({
        error: true,
        message: 'assetCode, issuerPublicKey, and secretKey required',
      });
      return;
    }

    const kp = Keypair.fromSecret(secretKey);
    await stellarService.createTrustline(assetCode, issuerPublicKey, kp);

    res.json({
      success: true,
      data: { assetCode, issuerPublicKey },
    });
  } catch (err: any) {
    res.status(400).json({ error: true, message: err.message });
  }
});
