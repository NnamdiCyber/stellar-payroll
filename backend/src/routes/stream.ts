import { Router, Request, Response } from 'express';
import { streamService } from '../services/stream.js';
import {
  StreamCreateSchema,
  StreamWithdrawSchema,
  StreamCancelSchema,
} from '../config/schemas.js';
import { toErrorMessage } from '../config/zod.js';

export const streamRoutes = Router();

streamRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const body = StreamCreateSchema.parse(req.body);
    const result = await streamService.createStream(
      body.senderSecretKey,
      body.recipientAddress,
      body.tokenAddress,
      body.amountPerSecond,
      body.maxAmount,
      body.durationSeconds,
      body.memo,
    );
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    res.status(400).json({ error: true, message: toErrorMessage(err) });
  }
});

streamRoutes.post('/:streamId/withdraw', async (req: Request, res: Response) => {
  try {
    const body = StreamWithdrawSchema.parse({
      ...req.body,
      streamId: parseInt(req.params.streamId),
    });
    const txHash = await streamService.withdraw(
      body.streamId,
      body.recipientSecretKey,
      body.amount,
    );
    res.json({
      success: true,
      data: { transactionHash: txHash },
    });
  } catch (err: unknown) {
    res.status(400).json({ error: true, message: toErrorMessage(err) });
  }
});

streamRoutes.post('/:streamId/cancel', async (req: Request, res: Response) => {
  try {
    const body = StreamCancelSchema.parse({
      ...req.body,
      streamId: parseInt(req.params.streamId),
    });
    const txHash = await streamService.cancelStream(
      body.streamId,
      body.senderSecretKey,
    );
    res.json({
      success: true,
      data: { transactionHash: txHash },
    });
  } catch (err: unknown) {
    res.status(400).json({ error: true, message: toErrorMessage(err) });
  }
});

streamRoutes.get('/:streamId', async (req: Request, res: Response) => {
  try {
    const stream = await streamService.getStream(
      parseInt(req.params.streamId),
    );
    res.json({ success: true, data: stream });
  } catch (err: unknown) {
    res.status(404).json({ error: true, message: 'Stream not found' });
  }
});
