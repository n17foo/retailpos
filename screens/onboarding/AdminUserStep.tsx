import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, Alert, ScrollView } from 'react-native';
import PinKeypad from '../../components/PinKeypad';
import PinDisplay from '../../components/PinDisplay';
import { useUsers } from '../../hooks/useUsers';

interface AdminUserStepProps {
  onBack: () => void;
  onComplete: () => void;
}

const PIN_LENGTH = 6;

const AdminUserStep: React.FC<AdminUserStepProps> = ({ onBack, onComplete }) => {
  const { createUser, isPinUnique, isLoading } = useUsers();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'info' | 'pin' | 'confirm'>('info');
  const [error, setError] = useState<string | null>(null);

  const handleKeyPress = (key: string) => {
    if (key === 'biometric') return;

    if (step === 'pin') {
      if (pin.length < PIN_LENGTH) {
        const newPin = pin + key;
        setPin(newPin);
        if (newPin.length === PIN_LENGTH) {
          // Auto-advance to confirm step
          setTimeout(() => setStep('confirm'), 300);
        }
      }
    } else if (step === 'confirm') {
      if (confirmPin.length < PIN_LENGTH) {
        const newConfirmPin = confirmPin + key;
        setConfirmPin(newConfirmPin);
        if (newConfirmPin.length === PIN_LENGTH) {
          // Auto-validate
          setTimeout(() => validateAndCreate(newConfirmPin), 300);
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 'pin') {
      setPin(pin.slice(0, -1));
    } else if (step === 'confirm') {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const validateInfo = () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your name.');
      return false;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return false;
    }
    return true;
  };

  const handleContinueToPin = () => {
    if (validateInfo()) {
      setStep('pin');
    }
  };

  const validateAndCreate = async (confirmedPin: string) => {
    setError(null);

    if (pin !== confirmedPin) {
      setError('PINs do not match. Please try again.');
      setPin('');
      setConfirmPin('');
      setStep('pin');
      return;
    }

    try {
      // Check if PIN is unique
      const isUnique = await isPinUnique(pin);
      if (!isUnique) {
        setError('This PIN is already in use. Please choose a different one.');
        setPin('');
        setConfirmPin('');
        setStep('pin');
        return;
      }

      // Create the admin user
      await createUser({
        name: name.trim(),
        email: email.trim() || null,
        pin,
        role: 'admin',
      });

      Alert.alert('Admin User Created', `Welcome, ${name}! Your admin account has been created. Use your 6-digit PIN to log in.`, [
        { text: 'Continue', onPress: onComplete },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create admin user');
      setPin('');
      setConfirmPin('');
      setStep('pin');
    }
  };

  const renderInfoStep = () => (
    <View style={styles.formContainer}>
      <Text style={styles.description}>
        Create your administrator account. This will be the primary user with full access to all settings.
      </Text>

      <Text style={styles.inputLabel}>Name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter your name" autoCapitalize="words" />

      <Text style={styles.inputLabel}>Email (Optional)</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <View style={styles.buttonContainer}>
        <Button title="Back" onPress={onBack} />
        <Button title="Set PIN" onPress={handleContinueToPin} />
      </View>
    </View>
  );

  const renderPinStep = () => (
    <View style={styles.pinContainer}>
      <Text style={styles.pinTitle}>Create Your PIN</Text>
      <Text style={styles.pinDescription}>Enter a 6-digit PIN. You'll use this to log in to the POS system.</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <PinDisplay pinLength={PIN_LENGTH} filledCount={pin.length} />
      <PinKeypad onKeyPress={handleKeyPress} onDeletePress={handleDelete} disableBiometric />

      <View style={styles.buttonContainer}>
        <Button title="Back" onPress={() => setStep('info')} />
      </View>
    </View>
  );

  const renderConfirmStep = () => (
    <View style={styles.pinContainer}>
      <Text style={styles.pinTitle}>Confirm Your PIN</Text>
      <Text style={styles.pinDescription}>Re-enter your 6-digit PIN to confirm.</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <PinDisplay pinLength={PIN_LENGTH} filledCount={confirmPin.length} />
      <PinKeypad onKeyPress={handleKeyPress} onDeletePress={handleDelete} disableBiometric />

      <View style={styles.buttonContainer}>
        <Button
          title="Back"
          onPress={() => {
            setConfirmPin('');
            setStep('pin');
          }}
        />
      </View>

      {isLoading && <Text style={styles.loadingText}>Creating account...</Text>}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Admin User</Text>

      {step === 'info' && renderInfoStep()}
      {step === 'pin' && renderPinStep()}
      {step === 'confirm' && renderConfirmStep()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  formContainer: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  pinContainer: {
    alignItems: 'center',
    width: '100%',
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  pinDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  loadingText: {
    color: '#007AFF',
    fontSize: 14,
    marginTop: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    width: '100%',
  },
});

export default AdminUserStep;
