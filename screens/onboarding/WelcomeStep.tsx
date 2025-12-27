import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';

interface WelcomeStepProps {
  onNext: () => void;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to RetailPOS</Text>
      <Text style={styles.subtitle}>The last POS system you'll ever need.</Text>
      <Text style={styles.description}>We'll guide you through a quick setup process to get your store up and running.</Text>
      <Button title="Get Started" onPress={onNext} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#333',
    marginBottom: 40,
    textAlign: 'center',
  },
});

export default WelcomeStep;
