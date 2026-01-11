import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [repoInfo, setRepoInfo] = useState<any>(null);

  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('userToken');
      if (!savedToken) {
        router.replace('/login');
      } else {
        setToken(savedToken);
        await fetchGitHubData(savedToken);
      }
    } catch (e) {
      console.error('Failed to load token', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGitHubData = async (accessToken: string) => {
    try {
      // 1. Fetch User Profile
      const userResponse = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await userResponse.json();
      setUser(userData);

      // 2. Fetch Specific Repo Data (GitStreaks)
      const repoResponse = await fetch('https://api.github.com/repos/drewmanley16/GitStreaks', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (repoResponse.ok) {
        const repoData = await repoResponse.json();
        setRepoInfo(repoData);
        // Save this as the active repo
        await AsyncStorage.setItem('connectedRepo', 'drewmanley16/GitStreaks');
      }
    } catch (error) {
      console.error('Error fetching GitHub data:', error);
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#24292e" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedView>
          <ThemedText type="title">Hello, {user?.login || 'Developer'}</ThemedText>
          <ThemedText style={styles.subtitle}>Let's track your streaks.</ThemedText>
        </ThemedView>
        <HelloWave />
      </ThemedView>
      
      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">Connected Repository</ThemedText>
        {repoInfo ? (
          <ThemedView style={styles.repoDetails}>
            <ThemedText style={styles.repoName}>drewmanley16/GitStreaks</ThemedText>
            <ThemedText style={styles.repoStatus}>
              {repoInfo.private ? '🔒 Private' : '🌐 Public'} • {repoInfo.stargazers_count} Stars
            </ThemedText>
          </ThemedView>
        ) : (
          <ThemedText style={styles.errorText}>Repository not found or inaccessible.</ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.linksContainer}>
        <Link href="/settings" asChild>
          <TouchableOpacity style={styles.secondaryButton}>
            <ThemedText type="defaultSemiBold">Settings</ThemedText>
          </TouchableOpacity>
        </Link>
        <TouchableOpacity 
          onPress={async () => {
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('connectedRepo');
            router.replace('/login');
          }}
          style={styles.logoutButton}
        >
          <ThemedText style={styles.logoutText}>Logout</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 80,
    backgroundColor: '#f6f8fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.6,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
  },
  repoDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  repoName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0969da',
  },
  repoStatus: {
    fontSize: 14,
    color: '#57606a',
    marginTop: 4,
  },
  errorText: {
    color: '#cf222e',
    marginTop: 10,
  },
  linksContainer: {
    marginTop: 'auto',
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d7de',
  },
  logoutButton: {
    padding: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: '#cf222e',
    fontWeight: '600',
  },
});

