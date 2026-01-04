import { expect } from 'chai';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { createApp } from '../src/server/app';
import { initializeDatabase, closeDatabase, getTransactionCount } from '../src/db';

describe('API Server', () => {
  const testDbPath = path.join(__dirname, '..', 'db', 'test-api.db');
  const testFilePath = path.join(__dirname, '..', 'activity.xlsx');
  let app: any;

  before(() => {
    // Set up test database
    closeDatabase(); // Close any existing connection
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    initializeDatabase(testDbPath);
    app = createApp();
  });

  after(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Health Check', () => {
    it('GET /health should return 200', async () => {
      const res = await request(app).get('/health');
      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.status).to.equal('healthy');
    });
  });

  describe('POST /api/import', () => {
    it('should import XLSX file successfully', async () => {
      const res = await request(app)
        .post('/api/import')
        .attach('file', testFilePath);

      expect(res.status).to.be.oneOf([200, 207]); // 207 for partial success
      expect(res.body.success).to.be.true;
      expect(res.body.data.totalRecords).to.equal(164);
      expect(res.body.data.importedRecords).to.equal(164);
    });

    it('should handle missing file', async () => {
      const res = await request(app).post('/api/import');

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
      expect(res.body.code).to.equal('NO_FILE_UPLOADED');
    });

    it('should reject non-XLSX files', async () => {
      // Create a temporary non-XLSX file
      const tempFile = path.join(__dirname, '..', 'test.txt');
      fs.writeFileSync(tempFile, 'test content');

      const res = await request(app)
        .post('/api/import')
        .attach('file', tempFile);

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;

      fs.unlinkSync(tempFile);
    });
  });

  describe('POST /api/import/validate', () => {
    it('should validate XLSX file', async () => {
      const res = await request(app)
        .post('/api/import/validate')
        .attach('file', testFilePath);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.totalRecords).to.equal(164);
      expect(res.body.data.validRecords).to.equal(164);
      expect(res.body.data.invalidRecords).to.equal(0);
    });

    it('should handle missing file in validation', async () => {
      const res = await request(app).post('/api/import/validate');

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
    });
  });

  describe('GET /api/transactions', () => {
    it('should list transactions after import', async () => {
      // Ensure data is imported
      const count = getTransactionCount();
      if (count === 0) {
        await request(app).post('/api/import').attach('file', testFilePath);
      }

      const res = await request(app).get('/api/transactions');

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.transactions).to.be.an('array');
      expect(res.body.data.transactions.length).to.be.greaterThan(0);
      expect(res.body.data.total).to.be.greaterThan(0);
      expect(res.body.data.limit).to.equal(50);
      expect(res.body.data.offset).to.equal(0);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .query({ limit: 10, offset: 5 });

      expect(res.status).to.equal(200);
      expect(res.body.data.transactions.length).to.be.at.most(10);
      expect(res.body.data.limit).to.equal(10);
      expect(res.body.data.offset).to.equal(5);
    });

    it('should enforce limit bounds', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .query({ limit: 1000 });

      expect(res.body.data.limit).to.equal(500); // Max limit
    });
  });

  describe('GET /api/transactions/:reference', () => {
    it('should get transaction by reference', async () => {
      // Ensure data is imported
      const count = getTransactionCount();
      if (count === 0) {
        await request(app).post('/api/import').attach('file', testFilePath);
      }

      const listRes = await request(app).get('/api/transactions');
      const reference = listRes.body.data.transactions[0]?.reference;

      if (reference) {
        const res = await request(app).get(`/api/transactions/${reference}`);
        expect(res.status).to.equal(200);
        expect(res.body.success).to.be.true;
        expect(res.body.data.reference).to.equal(reference);
      }
    });

    it('should handle non-existent reference', async () => {
      const res = await request(app).get('/api/transactions/NONEXISTENT_REF_12345');

      expect(res.status).to.equal(404);
      expect(res.body.success).to.be.false;
      expect(res.body.code).to.equal('NOT_FOUND');
    });
  });

  describe('GET /api/import-history', () => {
    it('should list import history', async () => {
      // Ensure data is imported
      const count = getTransactionCount();
      if (count === 0) {
        await request(app).post('/api/import').attach('file', testFilePath);
      }

      const res = await request(app).get('/api/import-history');

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.logs).to.be.an('array');
      expect(res.body.data.logs.length).to.be.greaterThan(0);
    });

    it('should support pagination in history', async () => {
      const res = await request(app)
        .get('/api/import-history')
        .query({ limit: 5, offset: 0 });

      expect(res.status).to.equal(200);
      expect(res.body.data.limit).to.equal(5);
    });
  });

  describe('DELETE /api/transactions/:id', () => {
    it('should delete transaction by id', async () => {
      // Ensure data is imported
      const count = getTransactionCount();
      if (count === 0) {
        await request(app).post('/api/import').attach('file', testFilePath);
      }

      const listRes = await request(app).get('/api/transactions');
      const id = listRes.body.data.transactions[0]?.id;

      if (id) {
        const res = await request(app).delete(`/api/transactions/${id}`);
        expect(res.status).to.equal(200);
        expect(res.body.success).to.be.true;
        expect(res.body.data.deleted).to.be.true;
        expect(res.body.data.id).to.equal(id);
      }
    });

    it('should handle non-existent id', async () => {
      const res = await request(app).delete('/api/transactions/99999');

      expect(res.status).to.equal(404);
      expect(res.body.success).to.be.false;
    });

    it('should reject invalid id format', async () => {
      const res = await request(app).delete('/api/transactions/abc');

      expect(res.status).to.equal(400);
      expect(res.body.code).to.equal('INVALID_ID');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown');

      expect(res.status).to.equal(404);
      expect(res.body.success).to.be.false;
      expect(res.body.code).to.equal('NOT_FOUND');
    });

    it('should return error with timestamp', async () => {
      const res = await request(app).get('/api/unknown');

      expect(res.body.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Response Format', () => {
    it('should have consistent response structure', async () => {
      const res = await request(app).get('/health');

      expect(res.body).to.have.property('success');
      expect(res.body).to.have.property('timestamp');
    });

    it('should include data in success responses', async () => {
      const res = await request(app).get('/api/transactions');

      expect(res.body.success).to.be.true;
      expect(res.body).to.have.property('data');
      expect(res.body).to.have.property('timestamp');
    });

    it('should include error code in error responses', async () => {
      const res = await request(app).get('/api/unknown');

      expect(res.body.success).to.be.false;
      expect(res.body).to.have.property('error');
      expect(res.body).to.have.property('code');
    });
  });
});
