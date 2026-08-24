import express from 'express';
import { CompanyMemberRolesEntity } from '../entities/companyMemberRolesEntity';
import { ErrorCodes } from '../core/ErrorCodes';
import { StatusCode } from '../config';
import { GenericResponse } from '../core/GenericResponse';

/**
 * Middleware to validate company access.
 * 
 * Logic:
 * 1. If no company_id in body, skip and proceed (next).
 * 2. If company_id is provided, verify the authenticated member has an active role in that company
 *    via the company_member_roles table.
 * 3. If not associated, return 403.
 * 
 * This middleware must be placed AFTER authMiddleware in the chain.
 */
const companyAccessMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<any> => {
    try {
        const memberId = req.body?.decryptToken?.member_id;
        const companyId = req.body?.company_id;

        // If no company_id provided, skip validation and proceed
        if (!companyId) {
            return next();
        }

        // Validate company_id is a valid positive integer
        const parsedCompanyId = Number(companyId);
        if (isNaN(parsedCompanyId) || !Number.isFinite(parsedCompanyId) || !Number.isSafeInteger(parsedCompanyId) || parsedCompanyId <= 0) {
            const error = ErrorCodes['E10006'];
            const response = new GenericResponse<any>();
            response.setStatus(StatusCode.FAILURE);
            response.setError(error.message);
            return res.status(error.status).send(response);
        }
        req.body.company_id = parsedCompanyId;

        if (!memberId) {
            return next();
        }

        const membership = await CompanyMemberRolesEntity.findOneBy({
            member_id: memberId,
            company_id: parsedCompanyId,
            is_delete: 0
        });

        if (!membership) {
            const error = ErrorCodes['E10003'];
            const response = new GenericResponse<any>();
            response.setStatus(StatusCode.FAILURE);
            response.setError(error.message);
            return res.status(error.status).send(response);
        }

        next();
    } catch (err) {
        console.error('companyAccessMiddleware error:', err);
        const error = ErrorCodes['E10005'];
        const response = new GenericResponse<any>();
        response.setStatus(StatusCode.FAILURE);
        response.setError(error.message);
        return res.status(error.status).send(response);
    }
};

export default companyAccessMiddleware;
