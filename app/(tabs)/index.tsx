import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { registerForPushNotificationsAsync, scheduleDailyReminder } from '@/hooks/useNotifications';
import * as Notifications from 'expo-notifications';
import { Logo } from '@/components/Logo';

export default function HomeScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [calendarDays, setCalendarDays] = useState<any[]>([]);
  const [recentCommits, setRecentCommits] = useState<any[]>([]);

  useEffect(() => {
    setupNotifications();

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('DEBUG: Notification Received in Foreground:', notification.request.content.title);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('DEBUG: Notification Tapped:', response.notification.request.content.title);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  const setupNotifications = async () => {
    const hasPermission = await registerForPushNotificationsAsync();
    if (hasPermission) {
      await scheduleDailyReminder();
    }
  };

  const fetchGitHubData = async (accessToken: string) => {
    try {
      const userResponse = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await userResponse.json();
      setUser(userData);
      await AsyncStorage.setItem('myUsername', userData.login);

      // Fetch Contribution Calendar (GraphQL)
      const query = `
        query($userName:String!) { 
          user(login: $userName) {
            contributionsCollection {
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    contributionCount
                    date
                    color
                  }
                }
              }
            }
          }
        }
      `;

      const gqlResponse = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { userName: userData.login },
        }),
      });

      const gqlData = await gqlResponse.json();
      const calendar = gqlData.data?.user?.contributionsCollection?.contributionCalendar;

      // Fetch Recent Commit History (Search API for real commit data across ALL branches)
      const searchResponse = await fetch(
        `https://api.github.com/search/commits?q=author:${userData.login}&sort=author-date&order=desc`, 
        {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json'
          },
        }
      );
      const searchData = await searchResponse.json();
      const liveCommits = searchData.items || [];

      if (calendar) {
        const processed = processStats(calendar, liveCommits);
        setCalendarDays(processed.slice(-21));
      }
      
      if (liveCommits.length > 0) {
        const commits = liveCommits.map((item: any) => ({
          repo: item.repository.name,
          message: item.commit.message,
          date: new Date(item.commit.author.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          sha: item.sha.substring(0, 7)
        })).slice(0, 10);
        setRecentCommits(commits);
      } else {
        setRecentCommits([]);
      }

    } catch (error) {
      console.error('DEBUG: Fetch Error', error);
    }
  };

  const processStats = (calendar: any, liveCommits: any[]) => {
    const allDays = calendar.weeks.flatMap((w: any) => w.contributionDays);
    const now = new Date();
    const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    
    // Map live commits to dates
    const liveMap: Record<string, number> = {};
    liveCommits.forEach((c: any) => {
      const d = new Date(c.commit.author.date).toISOString().split('T')[0];
      liveMap[d] = (liveMap[d] || 0) + 1;
    });

    // Merge official stats with live commit data
    const mergedDays = allDays.map((day: any) => {
      const liveCount = liveMap[day.date] || 0;
      return {
        ...day,
        contributionCount: Math.max(day.contributionCount, liveCount)
      };
    });

    // Re-reverse for streak calculation (descending order)
    const reversedDays = [...mergedDays].reverse();
    
    let todayCount = mergedDays.find((d: any) => d.date === todayStr)?.contributionCount || 0;
    let weekCount = 0;
    mergedDays.slice(-7).forEach((day: any) => {
      weekCount += day.contributionCount;
    });

    let streakDays = 0;
    let streakFound = false;

    for (let i = 0; i < reversedDays.length; i++) {
      const day = reversedDays[i];
      if (!streakFound) {
        if (day.contributionCount > 0) {
          streakFound = true;
          streakDays = 1;
        } else {
          if (day.date === todayStr) continue;
          else break;
        }
      } else {
        if (day.contributionCount > 0) streakDays++;
        else break;
      }
    }

    setStats({
      total: calendar.totalContributions,
      week: weekCount,
      day: todayCount,
      streak: streakDays,
    });

    return mergedDays; // Return for calendarDays state
  };

  const checkLogin = useCallback(async () => {
    setIsLoading(true);
    try {
      const savedToken = await AsyncStorage.getItem('userToken');
      if (!savedToken) {
        router.replace('/login');
      } else {
        await fetchGitHubData(savedToken);
      }
    } catch (e) {
      console.error('DEBUG: Token Error', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkLogin();
  }, [checkLogin]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    checkLogin();
  }, [checkLogin]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#f1e05a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#f1e05a" />
        }
      >
        <View style={styles.header}>
          <Logo size={32} />
          <Text style={styles.subGreeting}>Live Developer Dashboard</Text>
        </View>
        
        <View style={styles.streakCard}>
          <Text style={styles.streakLabel}>CURRENT STREAK</Text>
          <Text style={styles.streakValue}>{stats?.streak ?? '-'}</Text>
          <Text style={styles.streakDays}>Days in a row</Text>
        </View>

        <View style={styles.heatmapCard}>
          <Text style={styles.cardLabel}>LAST 21 DAYS</Text>
          <View style={styles.grid}>
            {calendarDays.map((day, i) => (
              <View 
                key={i} 
                style={[
                  styles.square, 
                  { 
                    backgroundColor: day.contributionCount > 0 ? '#f1e05a' : '#30363d', 
                    opacity: day.contributionCount > 0 ? Math.min(0.3 + (day.contributionCount * 0.2), 1) : 1 
                  }
                ]} 
              />
            ))}
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TODAY</Text>
            <Text style={styles.statValue}>{stats?.day ?? 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>WEEK</Text>
            <Text style={styles.statValue}>{stats?.week ?? 0}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.statBox, { borderColor: '#f1e05a' }]}
            onPress={() => router.push('/analytics')}
          >
            <Text style={[styles.statLabel, { color: '#f1e05a' }]}>ANALYTICS</Text>
            <Text style={styles.statValue}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENT HISTORY</Text>
            {recentCommits.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/history')}>
                <Text style={styles.seeMoreText}>See More</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentCommits.length > 0 ? (
            recentCommits.map((commit, index) => (
              <View key={`${commit.sha}-${index}`} style={styles.commitRow}>
                <View style={styles.commitInfo}>
                  <Text style={styles.repoName}>{commit.repo}</Text>
                  <Text style={styles.commitMessage} numberOfLines={1}>{commit.message}</Text>
                </View>
                <View style={styles.commitMeta}>
                  <Text style={styles.commitDate}>{commit.date}</Text>
                  <Text style={styles.commitSha}>{commit.sha}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyText}>No recent commit activity found.</Text>
            </View>
          )}
        </View>
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
    paddingTop: 40,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d1117',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  subGreeting: {
    color: '#8b949e',
    fontSize: 14,
    marginTop: 4,
  },
  streakCard: {
    backgroundColor: '#161b22',
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  streakLabel: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 1.5,
  },
  streakValue: {
    color: '#f1e05a',
    fontSize: 84,
    fontWeight: 'bold',
  },
  streakDays: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  heatmapCard: {
    backgroundColor: '#161b22',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  cardLabel: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  square: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statBox: {
    backgroundColor: '#161b22',
    width: '31%',
    paddingVertical: 20,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    color: '#8b949e',
    fontWeight: 'bold',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  historySection: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  seeMoreText: {
    color: '#f1e05a',
    fontSize: 12,
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
    borderDashOffset: 4,
    borderColor: '#30363d',
  },
  emptyText: {
    color: '#8b949e',
    fontSize: 14,
    fontWeight: '500',
  },
});
