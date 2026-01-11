import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, Text, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ACHIEVEMENTS } from '@/constants/achievements';
import * as Notifications from 'expo-notifications';

export default function SettingsScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('userToken');
      if (!savedToken) {
        router.replace('/login');
        return;
      }

      // Fetch user profile
      const userResponse = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      const userData = await userResponse.json();
      setUser(userData);

      // Fetch stats for achievements
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
          Authorization: `Bearer ${savedToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { userName: userData.login },
        }),
      });

      const gqlData = await gqlResponse.json();
      const calendar = gqlData.data?.user?.contributionsCollection?.contributionCalendar;
      
      if (calendar) {
        const allDays = calendar.weeks.flatMap((w: any) => w.contributionDays).reverse();
        const now = new Date();
        const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        
        const todayObj = allDays.find((d: any) => d.date === todayStr);
        const todayCount = todayObj?.contributionCount || 0;

        let streakDays = 0;
        let streakFound = false;
        for (let i = 0; i < allDays.length; i++) {
          const day = allDays[i];
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
          streak: streakDays,
          day: todayCount,
        });
      }
    } catch (e) {
      console.error('Failed to load user data in settings', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('myUsername');
      router.replace('/login');
    } catch (e) {
      console.error('Failed to logout', e);
    }
  };

  const testNotification = async () => {
    try {
      console.log('DEBUG: Scheduling test notification...');
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "🚀 Test Success!",
          body: "Push notifications are working perfectly.",
          sound: true,
          priority: Notifications.AndroidImportance.HIGH,
        },
        trigger: {
          seconds: 5,
          type: 'timeInterval',
        } as any,
      });
      console.log('DEBUG: Notification scheduled with ID:', id);
      Alert.alert("Sent", "Check your phone in 5 seconds! Try locking your screen to see it in the background.");
    } catch (e) {
      console.error('DEBUG: Test Notification Error:', e);
      Alert.alert("Error", "Could not send notification. Check console for details.");
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#f1e05a" />
      </View>
    );
  }

  const earnedAchievements = ACHIEVEMENTS.filter(a => a.requirement(stats));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* User Info Section */}
        <View style={styles.userCard}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{user?.login?.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{user?.name || user?.login}</Text>
            <Text style={styles.userLogin}>@{user?.login}</Text>
          </View>
        </View>
        
        {/* Achievements Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
          <View style={styles.achievementsGrid}>
            {ACHIEVEMENTS.map(achievement => {
              const isEarned = earnedAchievements.some(a => a.id === achievement.id);
              return (
                <View key={achievement.id} style={[styles.achievementItem, !isEarned && styles.achievementLocked]}>
                  <View style={[styles.achievementBadge, { borderColor: isEarned ? achievement.color : '#30363d' }]}>
                    <Text style={[styles.achievementSymbol, { color: isEarned ? achievement.color : '#8b949e' }]}>
                      {achievement.symbol}
                    </Text>
                  </View>
                  <Text style={[styles.achievementTitle, !isEarned && styles.textMuted]}>
                    {achievement.title}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SYSTEM</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Test Notification</Text>
              <TouchableOpacity onPress={testNotification}>
                <Text style={styles.testText}>Send Test</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.row, { borderTopWidth: 1, borderTopColor: '#30363d' }]}>
              <Text style={styles.label}>Logout from GitHub</Text>
              <TouchableOpacity onPress={handleLogout}>
                <Text style={styles.logoutText}>Log out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Git Streaks v1.0.5</Text>
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
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#30363d',
    marginBottom: 32,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#30363d',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userLogin: {
    color: '#8b949e',
    fontSize: 14,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 16,
    marginLeft: 4,
    letterSpacing: 1.5,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementItem: {
    backgroundColor: '#161b22',
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  achievementLocked: {
    opacity: 0.4,
    backgroundColor: '#0d1117',
    borderStyle: 'dashed',
  },
  achievementBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  achievementSymbol: {
    fontSize: 10,
    fontWeight: '900',
  },
  achievementTitle: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  grayscale: {
    // Note: React Native doesn't have a simple grayscale filter for text/emoji
    // but the opacity on achievementLocked handles the visual "locked" state
  },
  textMuted: {
    color: '#8b949e',
  },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  testText: {
    color: '#f1e05a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutText: {
    color: '#ff7b72',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#30363d',
    fontSize: 12,
    fontWeight: '600',
  },
});
