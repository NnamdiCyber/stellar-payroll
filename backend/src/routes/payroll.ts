import { Router, Request, Response } from 'express';
import { payrollService } from '../services/payroll.js';
import {
  CompanyCreateSchema,
  ContractorAddSchema,
  PayrollCreateSchema,
  PaymentAddSchema,
  PayrollApproveSchema,
} from '../config/schemas.js';
import { stellarService } from '../services/stellar.js';
import { toErrorMessage } from '../config/zod.js';

export const payrollRoutes = Router();

payrollRoutes.post('/companies', async (req: Request, res: Response) => {
  try {
    const body = CompanyCreateSchema.parse(req.body);
    const result = await payrollService.registerCompany(
      body.adminSecretKey,
      body.signers,
      body.minSigners,
      body.tokenAddress,
    );
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    res.status(400).json({ error: true, message: toErrorMessage(err) });
  }
});

payrollRoutes.post('/contractors', async (req: Request, res: Response) => {
  try {
    const body = ContractorAddSchema.parse(req.body);
    const txHash = await payrollService.addContractor(
      body.companyAddress,
      body.contractorAddress,
      body.name,
      body.email,
      body.adminSecretKey,
    );
    res.status(201).json({
      success: true,
      data: { transactionHash: txHash },
    });
  } catch (err: unknown) {
    res.status(400).json({ error: true, message: toErrorMessage(err) });
  }
});

payrollRoutes.delete('/contractors/:companyAddr/:contractorAddr', async (req: Request, res: Response) => {
  try {
    const { companyAddr, contractorAddr } = req.params;
    const authorization = req.headers.authorization ?? '';
    const adminSecretKey = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : authorization;
    const txHash = await payrollService.removeContractor(
      companyAddr,
      contractorAddr,
      adminSecretKey,
    );
    res.json({
      success: true,
      data: { transactionHash: txHash },
    });
  } catch (err: unknown) {
    res.status(400).json({ error: true, message: toErrorMessage(err) });
  }
});

payrollRoutes.post('/runs', async (req: Request, res: Response) => {
  try {
    const body = PayrollCreateSchema.parse(req.body);
    const result = await payrollService.createPayrollRun(
      body.companyAddress,
      body.periodStart,
      body.periodEnd,
      body.adminSecretKey,
    );
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    res.status(400).json({ error: true, message: toErrorMessage(err) });
  }
});

payrollRoutes.post('/payments', async (req: Request, res: Response) => {
  try {
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
    res.status(201).json({
      success: true,
      data: { transactionHash: txHash },
    });
  } catch (err: unknown) {
    res.status(400).json({ error: true, message: toErrorMessage(err) });
  }
});

payrollRoutes.post('/runs/approve', async (req: Request, res: Response) => {
  try {
    const body = PayrollApproveSchema.parse(req.body);
    const txHash = await payrollService.approvePayrollRun(
      body.companyAddress,
      body.runId,
      body.signerSecretKey,
    );
    res.json({
      success: true,
      data: { transactionHash: txHash },
    });
  } catch (err: unknown) {
    res.status(400).json({ error: true, message: toErrorMessage(err) });
  }
});

payrollRoutes.post('/runs/:runId/execute', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const { companyAddress, signerSecretKey } = req.body;

    if (!companyAddress || !signerSecretKey) {
      res.status(400).json({ error: true, message: 'companyAddress and signerSecretKey required' });
      return;
    }

    const txHash = await payrollService.executePayrollRun(
      companyAddress,
      parseInt(runId),
      signerSecretKey,
    );
    res.json({
      success: true,
      data: { transactionHash: txHash },
    });
  } catch (err: unknown) {
    res.status(400).json({ error: true, message: toErrorMessage(err) });
  }
});

payrollRoutes.get('/companies/:address', async (req: Request, res: Response) => {
  try {
    const company = await payrollService.getCompany(req.params.address);
    res.json({ success: true, data: company });
  } catch (err: unknown) {
    res.status(404).json({ error: true, message: 'Company not found' });
  }
});

payrollRoutes.post('/accounts/create', async (req: Request, res: Response) => {
  try {
    const account = stellarService.createAccount();
    if (process.env.STELLAR_NETWORK === 'testnet') {
      await stellarService.fundAccount(account.publicKey);
    }
    res.status(201).json({
      success: true,
      data: account,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: true, message: toErrorMessage(err) });
  }
});
