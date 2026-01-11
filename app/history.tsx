import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FullHistoryScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const fetchFullHistory = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('userToken');
      const username = await AsyncStorage.getItem('myUsername');
      
      if (!accessToken || !username) {
        router.replace('/login');
        return;
      }

      const eventsResponse = await fetch(
        `https://api.github.com/users/${username}/events?per_page=100`, 
        {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json'
          },
        }
      );
      const eventsData = await eventsResponse.json();
      
      if (Array.isArray(eventsData)) {
        const fullHistory = eventsData.map((event: any) => {
          let typeLabel = event.type.replace('Event', '');
          let message = '';
          let repo = event.repo.name.split('/')[1] || event.repo.name;

          if (event.type === 'PushEvent') {
            const commitCount = event.payload.commits?.length || 0;
            message = `Pushed ${commitCount} commit${commitCount !== 1 ? 's' : ''}`;
          } else if (event.type === 'PullRequestEvent') {
            message = `${event.payload.action.charAt(0).toUpperCase() + event.payload.action.slice(1)} PR #${event.payload.pull_request.number}`;
          } else if (event.type === 'IssuesEvent') {
            message = `${event.payload.action.charAt(0).toUpperCase() + event.payload.action.slice(1)} Issue #${event.payload.issue.number}`;
          } else if (event.type === 'PullRequestReviewEvent') {
            message = `Reviewed PR #${event.payload.pull_request.number}`;
          } else if (event.type === 'CreateEvent') {
            message = `Created ${event.payload.ref_type} ${event.payload.ref || ''}`;
          } else {
            message = `Activity in ${repo}`;
          }

          return {
            repo,
            message,
            type: typeLabel,
            date: new Date(event.created_at).toLocaleDateString(undefined, { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            }),
            id: event.id
          };
        });
        setHistory(fullHistory);
      }
    } catch (error) {
      console.error('DEBUG: Fetch History Error', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFullHistory();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchFullHistory();
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#f1e05a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Activity History</Text>
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#f1e05a" />
        }
      >
        {history.length > 0 ? (
          history.map((item, index) => (
            <View key={`${item.id}-${index}`} style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.repoName}>{item.repo}</Text>
                <Text style={styles.message}>{item.message}</Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.date}>{item.date}</Text>
                <Text style={styles.type}>{item.type}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No activity found.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    marginRight: 16,
  },
  backText: {
    color: '#8b949e',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#161b22',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  info: {
    flex: 1,
    marginRight: 16,
  },
  repoName: {
    color: '#f1e05a',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  meta: {
    alignItems: 'flex-end',
  },
  date: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  type: {
    color: '#30363d',
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: {
    backgroundColor: '#161b22',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  emptyText: {
    color: '#8b949e',
    fontSize: 14,
    fontWeight: '500',
  },
});
