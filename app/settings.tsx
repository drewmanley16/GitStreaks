import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SettingsScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      router.replace('/login');
    } catch (e) {
      console.error('Failed to logout', e);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Settings</ThemedText>
      
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Account</ThemedText>
        <ThemedText style={styles.description}>
          Manage your GitHub connection and data.
        </ThemedText>
        
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <ThemedText style={styles.logoutText}>Log Out</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <ThemedText type="link">Go Back</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  section: {
    marginTop: 30,
    gap: 10,
  },
  description: {
    opacity: 0.7,
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: '#ff3b3020',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#ff3b30',
    fontWeight: '600',
    fontSize: 16,
  },
  backButton: {
    marginTop: 'auto',
    marginBottom: 20,
    alignItems: 'center',
  },
});
