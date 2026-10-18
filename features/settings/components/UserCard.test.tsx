import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { UserCard } from './UserCard';
import type { User } from '../../authentication/hooks/useUsers';

const user: User = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'manager',
  platform_user_id: null,
  is_active: true,
  created_at: 0,
  updated_at: 0,
};

const baseProps = {
  user,
  onEdit: jest.fn(),
  onChangePin: jest.fn(),
  onToggleActive: jest.fn(),
};

describe('UserCard', () => {
  it('renders name, role label and email', async () => {
    const tree = await renderUi(<UserCard {...baseProps} />);
    expect(hasText(tree, 'Alice')).toBe(true);
    expect(hasText(tree, 'Manager')).toBe(true);
    expect(hasText(tree, 'alice@example.com')).toBe(true);
    expect(hasText(tree, 'Disable')).toBe(true);
  });

  it('shows Inactive and Enable for an inactive user', async () => {
    const tree = await renderUi(<UserCard {...baseProps} user={{ ...user, is_active: false }} />);
    expect(hasText(tree, 'Inactive')).toBe(true);
    expect(hasText(tree, 'Enable')).toBe(true);
  });

  it('fires the three action callbacks', async () => {
    const onEdit = jest.fn();
    const onChangePin = jest.fn();
    const onToggleActive = jest.fn();
    const tree = await renderUi(<UserCard {...baseProps} onEdit={onEdit} onChangePin={onChangePin} onToggleActive={onToggleActive} />);
    await pressByText(tree, 'Edit');
    expect(onEdit).toHaveBeenCalledWith(user);
    await pressByText(tree, 'PIN');
    expect(onChangePin).toHaveBeenCalledWith(user);
    await pressByText(tree, 'Disable');
    expect(onToggleActive).toHaveBeenCalledWith(user);
  });
});
