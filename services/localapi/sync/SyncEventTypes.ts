/**
 * Event types exchanged between registers via the local API sync layer.
 */
export type SyncEventType =
  | 'order:created'
  | 'order:updated'
  | 'order:paid'
  | 'inventory:updated'
  | 'product:updated'
  | 'shift:opened'
  | 'shift:closed'
  | 'user:updated'
  | 'return:created'
  | 'config:updated';

export interface SyncEvent {
  id: string;
  type: SyncEventType;
  registerId: string;
  registerName: string;
  payload: any;
  timestamp: number;
}

export interface SyncAck {
  eventId: string;
  registerId: string;
  receivedAt: number;
}
