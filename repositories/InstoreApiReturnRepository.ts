import { ReturnRepository, ReturnRow, CreateReturnInput } from './ReturnRepository';
import { instoreApiClient } from '../services/clients/instoreapi/InstoreApiClient';

export class InstoreApiReturnRepository implements ReturnRepository {
  async create(input: CreateReturnInput): Promise<string> {
    return instoreApiClient.createReturn(input);
  }

  async findById(_id: string): Promise<ReturnRow | null> {
    return null; // not needed on client
  }

  async findByOrderId(orderId: string): Promise<ReturnRow[]> {
    return instoreApiClient.getReturnsByOrder(orderId);
  }

  async findAll(status?: string): Promise<ReturnRow[]> {
    return instoreApiClient.getReturns(status);
  }

  async findByDateRange(_from: number, _to: number): Promise<ReturnRow[]> {
    return instoreApiClient.getReturns();
  }

  async updateStatus(_id: string, _status: string, _processedBy?: string): Promise<void> {
    // Status is set by the server on create — no-op on client
  }

  async delete(_id: string): Promise<void> {
    // not needed on client
  }
}
