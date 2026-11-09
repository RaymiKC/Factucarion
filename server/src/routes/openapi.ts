import { Router } from 'express';
import { config } from '../config';
import { getAdapter } from '../db';
import { asyncHandler } from '../http/errors';

export const openApiRouter = Router();

function tablePaths(table: string): Record<string, unknown> {
  const tag = table;
  return {
    [`/${table}`]: {
      get: {
        tags: [tag],
        summary: `List ${table}`,
        parameters: [
          { name: 'select', in: 'query', schema: { type: 'string' }, description: 'Comma separated columns' },
          { name: 'order', in: 'query', schema: { type: 'string' }, description: 'e.g. created_at.desc' },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'offset', in: 'query', schema: { type: 'integer' } },
          {
            name: 'column',
            in: 'query',
            schema: { type: 'string' },
            description: 'Any column can be filtered: ?company_id=eq.<uuid>&status=in.(draft,sent)',
          },
        ],
        responses: { '200': { description: `Array of ${table} rows` } },
      },
      post: {
        tags: [tag],
        summary: `Create ${table} row(s)`,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Created row(s)' } },
      },
    },
    [`/${table}/{id}`]: {
      get: {
        tags: [tag],
        summary: `Get ${table} by id`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Row' }, '404': { description: 'Not found' } },
      },
      put: {
        tags: [tag],
        summary: `Update ${table}`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '200': { description: 'Updated row' } },
      },
      delete: {
        tags: [tag],
        summary: `Delete ${table}`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Deleted row' } },
      },
    },
  };
}

openApiRouter.get(
  '/openapi.json',
  asyncHandler(async (_req, res) => {
    const db = await getAdapter();

    const paths: Record<string, unknown> = {
      '/health': {
        get: { tags: ['System'], summary: 'Service and database health', responses: { '200': { description: 'OK' } } },
      },
      '/api/tables': {
        get: { tags: ['System'], summary: 'List tables and columns', responses: { '200': { description: 'Schema' } } },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Password login',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: { email: { type: 'string' }, password: { type: 'string' } },
                },
              },
            },
          },
          responses: {
            '200': {
              description:
                'status = authenticated (token + user) | otp_required (otpId) | password_change_required (changeToken)',
            },
          },
        },
      },
      '/api/auth/otp/request': {
        post: {
          tags: ['Auth'],
          summary: 'Request an OTP for login or password reset',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email'],
                  properties: { email: { type: 'string' }, purpose: { type: 'string', enum: ['login', 'reset'] } },
                },
              },
            },
          },
          responses: { '200': { description: 'OTP created' } },
        },
      },
      '/api/auth/otp/verify': {
        post: {
          tags: ['Auth'],
          summary: 'Verify an OTP',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['otpId', 'token'],
                  properties: { otpId: { type: 'string' }, token: { type: 'string' }, purpose: { type: 'string' } },
                },
              },
            },
          },
          responses: { '200': { description: 'Token or changeToken' } },
        },
      },
      '/api/auth/password': {
        post: {
          tags: ['Auth'],
          summary: 'Finish a password change (requires the changeToken as bearer)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['password'],
                  properties: { password: { type: 'string' }, confirmPassword: { type: 'string' } },
                },
              },
            },
          },
          responses: { '200': { description: 'Authenticated session' } },
        },
      },
      '/api/auth/me': {
        get: { tags: ['Auth'], summary: 'Current user profile', responses: { '200': { description: 'User' } } },
      },
      '/api/db/{table}/select': {
        post: {
          tags: ['Query'],
          summary: 'Structured query used by the bundled client SDK',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { '200': { description: 'Rows' } },
        },
      },
      '/api/storage/{bucket}': {
        put: {
          tags: ['Storage'],
          summary: 'Upload a file (base64 or raw body)',
          parameters: [{ name: 'bucket', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '201': { description: 'Public URL' } },
        },
      },
      '/api/mail/send': {
        post: {
          tags: ['Mail'],
          summary: 'Send an email through the configured SMTP server',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { '200': { description: 'Sent' } },
        },
      },
    };

    for (const table of db.tables) {
      Object.assign(paths, tablePaths(table));
    }

    res.json({
      openapi: '3.0.3',
      info: {
        title: 'FacturaPro API',
        version: '1.0.0',
        description: `Self-hosted REST API. Active database provider: ${db.provider}.`,
      },
      servers: [{ url: config.publicUrl, description: 'FacturaPro API' }],
      components: {
        securitySchemes: {
          BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ BearerAuth: [] }],
      paths,
    });
  }),
);
