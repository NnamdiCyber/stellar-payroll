import { Router, Request, Response } from 'express';
import { payrollService } from '../services/payroll.js';
import {
  CompanyCreateSchema,
  ContractorAddSchema,
  ContractorRemoveParamsSchema,
  PayrollCreateSchema,
  PaymentAddSchema,
  PayrollApproveSchema,
  PayrollExecuteSchema,
  PayrollRunIdParamsSchema,
  AddressParamsSchema,
} from '../config/schemas.js';
import { ApiError, asyncHandler } from '../middleware/asyncHandler.js';
import { stellarService } from '../services/stellar.js';

export const payrollRoutes = Router();

payrollRoutes.post(
  '/companies',
  asyncHandler(async (req: Request, res: Response) => {
    const body = CompanyCreateSchema.parse(req.body);
    const result = await payrollService.registerCompany(
      body.adminSecretKey,
      body.signers,
      body.minSigners,
      body.tokenAddress,
    );
    res.status(201).json({ success: true, data: result });
  }),
);

payrollRoutes.post(
  '/contractors',
  asyncHandler(async (req: Request, res: Response) => {
    const body = ContractorAddSchema.parse(req.body);
    const txHash = await payrollService.addContractor(
      body.companyAddress,
      body.contractorAddress,
      body.name,
      body.email,
      body.adminSecretKey,
    );
    res.status(201).json({ success: true, data: { transactionHash: txHash } });
  }),
);

payrollRoutes.delete(
  '/contractors/:companyAddr/:contractorAddr',
  asyncHandler(async (req: Request, res: Response) => {
    const params = ContractorRemoveParamsSchema.parse(req.params);
    const authorization = req.headers.authorization ?? '';
    const adminSecretKey = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : authorization;
    if (!adminSecretKey) {
      throw new ApiError(401, 'Missing Bearer token with admin secret key');
    }
    const txHash = await payrollService.removeContractor(
      params.companyAddr,
      params.contractorAddr,
      adminSecretKey,
    );
    res.json({ success: true, data: { transactionHash: txHash } });
  }),
);

payrollRoutes.post(
  '/runs',
  asyncHandler(async (req: Request, res: Response) => {
    const body = PayrollCreateSchema.parse(req.body);
    const result = await payrollService.createPayrollRun(
      body.companyAddress,
      body.periodStart,
      body.periodEnd,
      body.adminSecretKey,
    );
    res.status(201).json({ success: true, data: result });
  }),
);

payrollRoutes.post(
  '/payments',
  asyncHandler(async (req: Request, res: Response) => {
    const body = PaymentAddSchema.parse(req.body);
    const txHash = await payrollService.addPayment(
      body.companyAddress,
      body.runId,
      body.contractorAddress,
      body.amount,
      body.currency,
      body.memo,
      body.adminSecretKey,
    );
    res.status(201).json({ success: true, data: { transactionHash: txHash } });
  }),
);

payrollRoutes.post(
  '/runs/approve',
  asyncHandler(async (req: Request, res: Response) => {
    const body = PayrollApproveSchema.parse(req.body);
    const txHash = await payrollService.approvePayrollRun(
      body.companyAddress,
      body.runId,
      body.signerSecretKey,
    );
    res.json({ success: true, data: { transactionHash: txHash } });
  }),
);

payrollRoutes.post(
  '/runs/:runId/execute',
  asyncHandler(async (req: Request, res: Response) => {
    const { runId } = PayrollRunIdParamsSchema.parse(req.params);
    const body = PayrollExecuteSchema.parse(req.body);
    const txHash = await payrollService.executePayrollRun(
      body.companyAddress,
      runId,
      body.signerSecretKey,
    );
    res.json({ success: true, data: { transactionHash: txHash } });
  }),
);

payrollRoutes.get(
  '/companies/:address',
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = AddressParamsSchema.parse(req.params);
    try {
      const company = await payrollService.getCompany(address);
      res.json({ success: true, data: company });
    } catch (err: unknown) {
      throw new ApiError(404, 'Company not found');
    }
  }),
);

payrollRoutes.post(
  '/accounts/create',
  asyncHandler(async (req: Request, res: Response) => {
    const account = stellarService.createAccount();
    if (stellarService.getNetwork() === 'testnet') {
      await stellarService.fundAccount(account.publicKey);
    }
    res.status(201).json({ success: true, data: account });
  }),
);