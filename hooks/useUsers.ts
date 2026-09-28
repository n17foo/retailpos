import { useState, useCallback, useEffect } from 'react';
import { userRepository, User, UserRole, CreateUserInput } from '../repositories/UserRepository';
import { useLogger } from './useLogger';
import { validatePinFormat } from '../utils/userPin.utils';
import { useAuthContext } from '../contexts/AuthProvider';
import { permissionService } from '../services/permissions/PermissionService';

type UserManagementAction = 'user:create' | 'user:edit' | 'user:delete';

interface UseUsersReturn {
  users: User[];
  isLoading: boolean;
  error: string | null;
  loadUsers: () => Promise<void>;
  createUser: (input: CreateUserInput) => Promise<string>;
  updateUser: (id: string, data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  updatePin: (id: string, newPin: string) => Promise<boolean>;
  deleteUser: (id: string) => Promise<void>;
  deactivateUser: (id: string) => Promise<void>;
  activateUser: (id: string) => Promise<void>;
  validatePin: (pin: string) => Promise<User | null>;
  isPinUnique: (pin: string, excludeUserId?: string) => Promise<boolean>;
  hasAdminUser: () => Promise<boolean>;
}

export const useUsers = (): UseUsersReturn => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logger = useLogger('useUsers');
  const { user: actor } = useAuthContext();

  /**
   * Enforce user-management permissions at the data boundary, not only in
   * navigation. The single unauthenticated exception is onboarding creating
   * the first admin when no active admin exists yet.
   */
  const authorize = useCallback(
    async (action: UserManagementAction): Promise<void> => {
      if (actor?.id) {
        if (await permissionService.can(actor.id, action)) return;
      } else if (action === 'user:create' && !(await userRepository.hasAdminUser())) {
        return;
      }
      throw new Error('You do not have permission to manage users');
    },
    [actor?.id]
  );

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allUsers = await userRepository.findAll();
      setUsers(allUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
      logger.error({ message: 'Error loading users' }, err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [logger]);

  const createUser = useCallback(
    async (input: CreateUserInput): Promise<string> => {
      setIsLoading(true);
      setError(null);
      try {
        await authorize('user:create');
        if (!actor?.id && input.role !== 'admin') {
          throw new Error('The first account must be an admin');
        }

        // Check PIN uniqueness
        const isUnique = await userRepository.isPinUnique(input.pin);
        if (!isUnique) {
          throw new Error('PIN is already in use by another user');
        }

        const id = await userRepository.create(input);
        await loadUsers(); // Refresh the list
        return id;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create user';
        setError(message);
        throw new Error(message, { cause: err });
      } finally {
        setIsLoading(false);
      }
    },
    [loadUsers, authorize, actor?.id]
  );

  const updateUser = useCallback(
    async (id: string, data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await authorize('user:edit');
        await userRepository.update(id, data);
        permissionService.invalidateCache(id);
        await loadUsers();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update user');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUsers, authorize]
  );

  const updatePin = useCallback(
    async (id: string, newPin: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await authorize('user:edit');

        // Validate PIN format
        const pinValidation = validatePinFormat(newPin);
        if (!pinValidation.isValid) {
          throw new Error(pinValidation.error);
        }

        // Check uniqueness
        const isUnique = await userRepository.isPinUnique(newPin, id);
        if (!isUnique) {
          throw new Error('PIN is already in use by another user');
        }

        await userRepository.updatePin(id, newPin);
        await loadUsers();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update PIN');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUsers, authorize]
  );

  const deleteUser = useCallback(
    async (id: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await authorize('user:delete');
        await userRepository.delete(id);
        permissionService.invalidateCache(id);
        await loadUsers();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete user');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUsers, authorize]
  );

  const deactivateUser = useCallback(
    async (id: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await authorize('user:edit');
        await userRepository.deactivate(id);
        permissionService.invalidateCache(id);
        await loadUsers();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to deactivate user');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUsers, authorize]
  );

  const activateUser = useCallback(
    async (id: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await authorize('user:edit');
        await userRepository.activate(id);
        permissionService.invalidateCache(id);
        await loadUsers();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to activate user');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUsers, authorize]
  );

  const validatePin = useCallback(
    async (pin: string): Promise<User | null> => {
      try {
        return await userRepository.findByPin(pin);
      } catch (err) {
        logger.error({ message: 'Error validating PIN' }, err instanceof Error ? err : new Error(String(err)));
        return null;
      }
    },
    [logger]
  );

  const isPinUnique = useCallback(
    async (pin: string, excludeUserId?: string): Promise<boolean> => {
      try {
        return await userRepository.isPinUnique(pin, excludeUserId);
      } catch (err) {
        logger.error({ message: 'Error checking PIN uniqueness' }, err instanceof Error ? err : new Error(String(err)));
        return false;
      }
    },
    [logger]
  );

  const hasAdminUser = useCallback(async (): Promise<boolean> => {
    try {
      return await userRepository.hasAdminUser();
    } catch (err) {
      logger.error({ message: 'Error checking for admin user' }, err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }, [logger]);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return {
    users,
    isLoading,
    error,
    loadUsers,
    createUser,
    updateUser,
    updatePin,
    deleteUser,
    deactivateUser,
    activateUser,
    validatePin,
    isPinUnique,
    hasAdminUser,
  };
};

export type { User, UserRole, CreateUserInput };
