import AsyncStorage from '@react-native-async-storage/async-storage';
import { exchangeCodeAsync, makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { Logo } from '@/components/Logo';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  revocationEndpoint: 'https://github.com/settings/connections/applications/Ov23lilG9wGRGMphXgtg',
};

export default function LoginScreen() {
  const router = useRouter();
  const clientId = 'Ov23lilG9wGRGMphXgtg';
  const clientSecret = 'e3e4b92381ba82862496a116e62c72fac21a0767';

  const redirectUri = makeRedirectUri();

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId,
      scopes: ['user', 'repo'],
      redirectUri,
      usePKCE: false,
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
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <Logo size={48} />
        </View>
        <Text style={styles.subtitle}>
          Secure your momentum. Track your GitHub contributions and streaks with the elite dev crew.
        </Text>

        <TouchableOpacity
          disabled={!request}
          onPress={() => {
            promptAsync();
          }}
          style={[styles.button, !request && styles.buttonDisabled]}
        >
          {request ? (
            <Text style={styles.buttonText}>Authenticate via GitHub</Text>
          ) : (
            <ActivityIndicator color="#0d1117" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    justifyContent: 'center',
    padding: 40,
  },
  content: {
    alignItems: 'center',
  },
  logoWrapper: {
    marginBottom: 24,
  },
  subtitle: {
    color: '#8b949e',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
    maxWidth: 280,
  },
  button: {
    backgroundColor: '#f1e05a',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#0d1117',
    fontSize: 16,
    fontWeight: '700',
  },
});
