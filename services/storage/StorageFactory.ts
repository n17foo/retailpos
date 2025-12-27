import { storage, Storage } from '../../utils/storage';
import { sqliteStorage, SQLiteStorageService } from './SQLiteStorageService';

export enum StorageType {
  KEY_VALUE,
  RELATIONAL,
}

export class StorageFactory {
  private static instance: StorageFactory;

  private constructor() {}

  public static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory();
    }
    return StorageFactory.instance;
  }

  public getStorage(type: StorageType): Storage | SQLiteStorageService {
    switch (type) {
      case StorageType.KEY_VALUE:
        return storage;
      case StorageType.RELATIONAL:
        return sqliteStorage;
      default:
        throw new Error(`Unknown storage type: ${type}`);
    }
  }
}

export const storageFactory = StorageFactory.getInstance();
