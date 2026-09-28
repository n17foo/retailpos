import React, { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuthContext } from '../contexts/AuthProvider';
import { useTheme } from '../contexts/ThemeProvider';
import { useTranslate } from '../hooks/useTranslate';
import { permissionService } from '../services/permissions/PermissionService';
import { spacing, typography } from '../utils/theme';

interface PermissionGateProps {
  action: string;
  children: ReactNode;
}

/**
 * Screen-level authorization guard.
 *
 * Menu composers only hide navigation entries; every privileged screen must
 * also resolve the action itself so a hidden route, stale menu, or programmatic
 * navigation cannot bypass role and permission-set checks.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({ action, children }) => {
  const { user } = useAuthContext();
  const { colors } = useTheme();
  const { t } = useTranslate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    setAllowed(null);
    if (!user?.id) {
      setAllowed(false);
      return;
    }
    permissionService.can(user.id, action).then(result => {
      if (active) setAllowed(result);
    });
    return () => {
      active = false;
    };
  }, [user?.id, action]);

  if (allowed === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!allowed) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.text, { color: colors.textSecondary }]}>{t('common.accessDenied')}</Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  text: {
    fontSize: typography.fontSize.md,
    textAlign: 'center',
  },
});
