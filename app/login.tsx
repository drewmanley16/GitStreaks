import AsyncStorage from '@react-native-async-storage/async-storage';
import { exchangeCodeAsync, makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

WebBrowser.maybeCompleteAuthSession();

// Endpoint
const discovery = {
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  revocationEndpoint: 'https://github.com/settings/connections/applications/Ov23lilG9wGRGMphXgtg',
};

export default function LoginScreen() {
  const router = useRouter();

  // NOTE: In a real app, Client ID and Secret should be managed via environment variables.
  // The token exchange should ideally happen on a secure backend to keep the Client Secret private.
  const clientId = 'Ov23lilG9wGRGMphXgtg';
  const clientSecret = 'e3e4b92381ba82862496a116e62c72fac21a0767';

  const redirectUri = makeRedirectUri();

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId,
      scopes: ['user', 'repo'],
      redirectUri,
    },
    discovery
  );

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      handleTokenExchange(code);
    }
  }, [response]);

  const handleTokenExchange = async (code: string) => {
    try {
      const tokenResponse = await exchangeCodeAsync(
        {
          clientId,
          clientSecret,
          code,
          redirectUri,
        },
        discovery
      );

      if (tokenResponse.accessToken) {
        await AsyncStorage.setItem('userToken', tokenResponse.accessToken);
        router.replace('/');
      }
    } catch (error) {
      console.error('Failed to exchange code for token:', error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">GitHub Streaks</ThemedText>
      <ThemedText style={styles.subtitle}>
        Connect your GitHub account to track your contribution streaks and stay motivated.
      </ThemedText>

      <TouchableOpacity
        disabled={!request}
        onPress={() => {
          promptAsync();
        }}
        style={[styles.button, !request && styles.buttonDisabled]}
      >
        <ThemedText style={styles.buttonText}>Connect with GitHub</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 40,
    opacity: 0.8,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#24292e',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});
