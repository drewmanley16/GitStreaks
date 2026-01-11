import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FullHistoryScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [commits, setCommits] = useState<any[]>([]);

  const fetchFullHistory = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('userToken');
      const username = await AsyncStorage.getItem('myUsername');
      
      if (!accessToken || !username) {
        router.replace('/login');
        return;
      }

      const searchResponse = await fetch(
        `https://api.github.com/search/commits?q=author:${username}&sort=author-date&order=desc&per_page=50`, 
        {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json'
          },
        }
      );
      const searchData = await searchResponse.json();
      
      if (searchData.items && Array.isArray(searchData.items)) {
        const fullCommits = searchData.items.map((item: any) => ({
          repo: item.repository.name,
          message: item.commit.message,
          date: new Date(item.commit.author.date).toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          }),
          sha: item.sha.substring(0, 7)
        }));
        setCommits(fullCommits);
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
        <Text style={styles.title}>Full History</Text>
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#f1e05a" />
        }
      >
        {commits.length > 0 ? (
          commits.map((commit, index) => (
            <View key={`${commit.sha}-${index}`} style={styles.commitRow}>
              <View style={styles.commitInfo}>
                <Text style={styles.repoName}>{commit.repo}</Text>
                <Text style={styles.commitMessage}>{commit.message}</Text>
              </View>
              <View style={styles.commitMeta}>
                <Text style={styles.commitDate}>{commit.date}</Text>
                <Text style={styles.commitSha}>{commit.sha}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyText}>No commit activity found.</Text>
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
  commitRow: {
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
  commitInfo: {
    flex: 1,
    marginRight: 16,
  },
  repoName: {
    color: '#f1e05a',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  commitMessage: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  commitMeta: {
    alignItems: 'flex-end',
  },
  commitDate: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  commitSha: {
    color: '#30363d',
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: 'bold',
  },
  emptyHistory: {
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

