import { Router, Request, Response } from 'express';
import { streamService } from '../services/stream.js';
import {
  StreamCreateSchema,
  StreamWithdrawSchema,
  StreamCancelSchema,
  StreamIdParamsSchema,
  RecipientParamsSchema,
  SenderParamsSchema,
} from '../config/schemas.js';
import { ApiError, asyncHandler } from '../middleware/asyncHandler.js';

export const streamRoutes = Router();

streamRoutes.get(
  '/recipient/:recipient',
  asyncHandler(async (req: Request, res: Response) => {
    const { recipient } = RecipientParamsSchema.parse(req.params);
    res.json({
      success: true,
      data: await streamService.getRecipientStreams(recipient),
    });
  }),
);

streamRoutes.get(
  '/sender/:sender',
  asyncHandler(async (req: Request, res: Response) => {
    const { sender } = SenderParamsSchema.parse(req.params);
    res.json({
      success: true,
      data: await streamService.getSenderStreams(sender),
    });
  }),
);

streamRoutes.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
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
    res.status(201).json({ success: true, data: result });
  }),
);

streamRoutes.post(
  '/:streamId/withdraw',
  asyncHandler(async (req: Request, res: Response) => {
    const params = StreamIdParamsSchema.parse(req.params);
    const body = StreamWithdrawSchema.parse(req.body);
    const txHash = await streamService.withdraw(
      params.streamId,
      body.recipientSecretKey,
      body.amount,
    );
    res.json({ success: true, data: { transactionHash: txHash } });
  }),
);

streamRoutes.post(
  '/:streamId/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const params = StreamIdParamsSchema.parse(req.params);
    const body = StreamCancelSchema.parse(req.body);
    const txHash = await streamService.cancelStream(
      params.streamId,
      body.senderSecretKey,
    );
    res.json({ success: true, data: { transactionHash: txHash } });
  }),
);

streamRoutes.get(
  '/:streamId',
  asyncHandler(async (req: Request, res: Response) => {
    const params = StreamIdParamsSchema.parse(req.params);
    try {
      const stream = await streamService.getStream(params.streamId);
      res.json({
        success: true,
        data: {
          ...stream,
          availableAmount: streamService.getAvailableAmount(stream),
        },
      });
    } catch (err: unknown) {
      throw new ApiError(404, 'Stream not found');
    }
  }),
);